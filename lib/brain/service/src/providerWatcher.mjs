// lib/brain/service/src/providerWatcher.mjs
//
// El mecanismo que protege la neutralidad declarada del partido frente a un
// cambio de proveedor de IA sin medir (D-016, encargo explícito de Sergio):
// tras activar un proveedor nuevo desde el panel, corre la suite de
// neutralidad (neutralitySuite.mjs, 16 pares izquierda/derecha), escribe el
// resultado en `ai_evals` (tabla pública de transparencia -- eso ya lo hace
// runNeutralitySuite()) y, si el % de pares equivalentes cae por debajo del
// umbral (95% por defecto, config.aiNeutralityMinPct), llama a
// ai_credentials_revert() automáticamente -- sin que nadie tenga que
// notarlo ni intervenir a mano.
//
// Dos formas de disparo:
//   1. Vigilancia periódica (startProviderWatch): cada
//      config.aiProviderWatchIntervalMs compara la credencial activa contra
//      la última vista. Si cambió, corre la comprobación. Detecta cambios
//      hechos desde el panel admin SIN que ese panel tenga que conocer ni
//      llamar a este servicio -- desacoplado a propósito, porque el panel
//      (rc-wt-ajustes) lo construye otro agente en paralelo y no debemos
//      depender de su forma exacta de guardar.
//   2. Disparo manual (checkAndRevertIfUnsafe con force:true), expuesto en
//      server.mjs como POST /provider/verify (interno) -- útil para que el
//      panel pida una comprobación inmediata en vez de esperar al siguiente
//      ciclo, y es lo que usa el gate de esta ola para demostrar la
//      reversión sin depender del temporizador.
//
// Diseño defensivo:
//   - Primera observación tras arrancar el servicio (lastSeen === undefined):
//     NO se trata como "cambio" -- evita gastar 32 llamadas al LLM en cada
//     reinicio del contenedor sin que Sergio haya tocado nada.
//   - Si la credencial activa es el fallback de entorno (ENV_FALLBACK_
//     CREDENTIAL_ID, no una fila real de ai_provider_credentials), no hay
//     nada que revertir (no tiene previous_credential_id) ni sentido en
//     escribir en ai_evals un resultado contra ANTHROPIC_API_KEY de entorno
//     puro -- se sale sin correr la suite.
//   - Si la suite entera falla en ejecutarse (p.ej. sin credencial válida
//     para ningún proveedor), se registra el fallo y NO se llama a revert()
//     a ciegas -- revertir sobre una suite que no corrió no protege nada,
//     solo esconde el problema real.

import { config } from "./config.mjs";
import {
  getActiveProviderConfig,
  invalidateCredentialCache,
  peekLastSeenCredentialId,
  markSeenCredentialId,
  ENV_FALLBACK_CREDENTIAL_ID,
} from "./credentialStore.mjs";
import { runNeutralitySuite } from "./neutralitySuite.mjs";
import { pgQuery } from "./pgClient.mjs";
import { escapeStringLiteral } from "./sqlLiteral.mjs";

let watchTimer = null;

/**
 * Corre la comprobación de neutralidad si (y solo si) detecta que el
 * proveedor activo cambió desde la última vez -- o siempre, si force:true.
 * Devuelve un resumen legible pensado para loguear y para exponer por HTTP
 * (POST /provider/verify), nunca lanza salvo error de programación.
 */
export async function checkAndRevertIfUnsafe({ force = false } = {}) {
  let cred;
  try {
    // forceRefresh:true -- no queremos comparar contra un valor cacheado
    // potencialmente viejo; esta comprobación es precisamente la que debe
    // ver el estado más fresco posible de la BD.
    cred = await getActiveProviderConfig({ forceRefresh: true });
  } catch (err) {
    return { checked: false, reverted: false, reason: `sin credencial activa (${err.message})` };
  }

  const lastSeen = peekLastSeenCredentialId();
  const isFirstObservation = lastSeen === undefined;
  const changed = force || (!isFirstObservation && lastSeen !== cred.credentialId);
  markSeenCredentialId(cred.credentialId);

  if (isFirstObservation && !force) {
    return { checked: false, reverted: false, reason: "estado inicial del servicio, sin cambio que evaluar" };
  }
  if (!changed) {
    return { checked: false, reverted: false, reason: "sin cambio de proveedor desde la última comprobación" };
  }
  if (cred.credentialId === ENV_FALLBACK_CREDENTIAL_ID) {
    return {
      checked: false,
      reverted: false,
      reason: "la credencial activa es el fallback de entorno (ANTHROPIC_API_KEY), no una fila de ai_provider_credentials -- nada que revertir",
    };
  }

  console.log(
    `[providerWatcher] cambio de proveedor detectado (credencial ${cred.credentialId}, ${cred.provider}/${cred.model}) -- corriendo suite de neutralidad...`
  );

  let summary;
  try {
    summary = await runNeutralitySuite();
  } catch (err) {
    console.error("[providerWatcher] la suite de neutralidad falló al ejecutarse (NO se revierte a ciegas):", err.message);
    return { checked: true, reverted: false, suiteFailed: true, error: err.message };
  }

  console.log(
    `[providerWatcher] suite de neutralidad: ${summary.passed}/${summary.total} (${summary.pct.toFixed(1)}%), umbral=${config.aiNeutralityMinPct}%`
  );

  if (summary.pct >= config.aiNeutralityMinPct) {
    return { checked: true, reverted: false, summary };
  }

  console.warn(
    `[providerWatcher] tasa de neutralidad ${summary.pct.toFixed(1)}% < ${config.aiNeutralityMinPct}% -- revirtiendo proveedor automáticamente.`
  );
  try {
    const reason = `auto-revert: neutralidad ${summary.pct.toFixed(1)}% < ${config.aiNeutralityMinPct}% tras cambio de proveedor`;
    const sql = `select public.ai_credentials_revert(${escapeStringLiteral(reason)}, NULL) as reverted_id;`;
    const rows = await pgQuery(sql);
    const revertedId = rows?.[0]?.reverted_id ?? null;

    // Invalida la caché para que la siguiente petición de chat/Opina use YA
    // el proveedor revertido, sin esperar al TTL normal -- y refresca
    // "última vista" contra el estado real post-revert para no volver a
    // disparar la suite en el próximo ciclo sobre el mismo cambio.
    invalidateCredentialCache();
    try {
      const postRevert = await getActiveProviderConfig({ forceRefresh: true });
      markSeenCredentialId(postRevert.credentialId);
    } catch {
      markSeenCredentialId(undefined);
    }

    console.warn(`[providerWatcher] revertido a la credencial ${revertedId}.`);
    return { checked: true, reverted: true, revertedTo: revertedId, summary };
  } catch (err) {
    console.error("[providerWatcher] FALLO al revertir tras neutralidad insuficiente -- requiere intervención manual:", err.message);
    return { checked: true, reverted: false, revertError: err.message, summary };
  }
}

/** Arranca la vigilancia periódica. Idempotente -- llamar dos veces no duplica el temporizador. */
export function startProviderWatch() {
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    checkAndRevertIfUnsafe().catch((err) =>
      console.error("[providerWatcher] error inesperado en ciclo de vigilancia:", err.message)
    );
  }, config.aiProviderWatchIntervalMs);
  watchTimer.unref?.();
}

/** Solo para pruebas/gate: parar el temporizador y resetear el estado "visto". */
export function _stopForTests() {
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = null;
  markSeenCredentialId(undefined);
}
