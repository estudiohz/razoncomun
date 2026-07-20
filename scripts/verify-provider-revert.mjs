#!/usr/bin/env node
// scripts/verify-provider-revert.mjs
//
// Prueba end-to-end del mecanismo de reversión automática de proveedor de IA
// (D-016, lib/brain/service/src/providerWatcher.mjs) contra el Supabase REAL
// (dev-api.razoncomun.com) -- separado de gate-brain.mjs porque este script
// SÍ escribe en la base de datos (aunque se autolimpia al final) y hace
// llamadas HTTP reales a la API de Anthropic, cosa que gate-brain.mjs
// deliberadamente evita para poder correrse en cualquier momento sin efectos
// secundarios.
//
// Qué demuestra, paso a paso:
//   1. Activa una credencial 'anthropic' de prueba con una clave DUMMY
//      (inválida a propósito) vía ai_credentials_set() -- fila #1.
//   2. Activa una SEGUNDA credencial, también con clave dummy inválida --
//      fila #2, con previous_credential_id = fila #1. Esto es exactamente
//      lo que hace el panel admin al cambiar de proveedor.
//   3. Llama a providerWatcher.checkAndRevertIfUnsafe() SIN forzar -- el
//      mismo camino que usa la vigilancia periódica real (startProviderWatch,
//      setInterval). Debe:
//        a. detectar que la credencial activa cambió desde la última
//           observación,
//        b. correr neutralitySuite.runNeutralitySuite() DE VERDAD -- 16
//           pares, hasta 64 llamadas HTTP reales a api.anthropic.com. Como
//           la clave es inválida, Anthropic responde 401 real; classifyJson
//           (llm.mjs) lo trata como fallo de clasificación en vez de abortar
//           la suite entera -- las 16 filas se completan con passed:false,
//        c. escribir esas 16 filas en `ai_evals` (comportamiento real, sin
//           mockear la cadena BD/HTTP),
//        d. calcular pct=0% < AI_NEUTRALITY_MIN_PCT (95% por defecto) y
//           llamar a ai_credentials_revert() de verdad.
//   4. Verifica en la BD (consulta independiente) que la fila activa volvió
//      a ser la #1.
//   5. Limpieza: borra las 2 filas de credenciales de prueba y las 16 filas
//      sintéticas de ai_evals que dejó este test, para no ensuciar la tabla
//      pública de transparencia con datos de un test de fontanería. Si el
//      script falla a mitad de camino, imprime los IDs para poder limpiar a
//      mano.
//
// Uso:
//   node scripts/verify-provider-revert.mjs
//   RC_BRAIN_GATE_ENV=/ruta/a/supabase.env node scripts/verify-provider-revert.mjs
//
// Requiere SUPABASE_PUBLIC_URL + SERVICE_ROLE_KEY (igual que gate-brain.mjs).
// NO requiere ANTHROPIC_API_KEY real -- el punto del test es justo que la
// clave sea inválida. Tarda entre 15 y 60 segundos (32-64 llamadas HTTP
// reales a Anthropic, todas rechazadas por auth casi instantáneamente).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_SRC = path.join(__dirname, "..", "lib", "brain", "service", "src");
const importSrc = (file) => import(pathToFileURL(path.join(SERVICE_SRC, file)).href);

function loadEnvFile(p) {
  if (!p || !existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
if (process.env.RC_BRAIN_GATE_ENV) loadEnvFile(process.env.RC_BRAIN_GATE_ENV);

if (!process.env.SUPABASE_PUBLIC_URL || !process.env.SERVICE_ROLE_KEY) {
  console.error(
    "Faltan SUPABASE_PUBLIC_URL / SERVICE_ROLE_KEY en el entorno. Usa RC_BRAIN_GATE_ENV=<ruta al .env con las claves>."
  );
  process.exit(1);
}

// Clave maestra de prueba -- solo vive en este proceso, nunca se guarda en
// ningún archivo ni se persiste en la BD (pgp_sym_encrypt(api_key, master_key),
// master_key nunca se almacena -- ver 0016_ai_provider_credentials.sql).
const TEST_MASTER_KEY = `test-master-key-${crypto.randomBytes(8).toString("hex")}`;
process.env.AI_CREDENTIALS_MASTER_KEY = TEST_MASTER_KEY;
delete process.env.ANTHROPIC_API_KEY; // fuerza a usar SIEMPRE la fila de BD, nunca el fallback

const { pgQuery } = await importSrc("pgClient.mjs");
const { escapeStringLiteral } = await importSrc("sqlLiteral.mjs");
const { checkAndRevertIfUnsafe } = await importSrc("providerWatcher.mjs");
const { PROMPT_VERSION, TEST_PAIRS } = await importSrc("neutralitySuite.mjs");

let totalOk = 0;
let totalTests = 0;
function check(label, ok, detail = "") {
  totalTests += 1;
  if (ok) totalOk += 1;
  console.log(`  [${ok ? "OK" : "FALLO"}] ${label}${detail ? " -- " + detail : ""}`);
  return ok;
}

async function setCredential(model, apiKey) {
  const sql = `select public.ai_credentials_set(${escapeStringLiteral("anthropic")}, ${escapeStringLiteral(
    model
  )}, ${escapeStringLiteral(apiKey)}, ${escapeStringLiteral(TEST_MASTER_KEY)}, NULL) as id;`;
  const rows = await pgQuery(sql);
  return rows[0]?.id;
}

async function cleanup(credIds, { silent = false } = {}) {
  // Orden importa: la fila más reciente referencia a la anterior vía
  // previous_credential_id (FK) -- hay que borrar de la más nueva a la más
  // vieja.
  for (const id of [...credIds].reverse()) {
    if (!id) continue;
    try {
      await pgQuery(`delete from ai_provider_credentials where id = ${escapeStringLiteral(id)}::uuid;`);
    } catch (err) {
      if (!silent) console.error(`  no se pudo borrar la credencial de prueba ${id}: ${err.message}`);
    }
  }
  try {
    await pgQuery(
      `delete from ai_evals where prompt_version = ${escapeStringLiteral(PROMPT_VERSION)} and passed = false and notes like ${escapeStringLiteral(
        "Fallo de clasificación:%"
      )};`
    );
  } catch (err) {
    if (!silent) console.error(`  no se pudieron borrar los ai_evals sintéticos de este test: ${err.message}`);
  }
}

console.log("\n=== Paso 1-2: activando dos credenciales de prueba (claves dummy, inválidas a propósito) ===\n");

const dummyKey1 = `sk-ant-test-dummy-${crypto.randomBytes(6).toString("hex")}`;
const dummyKey2 = `sk-ant-test-dummy-${crypto.randomBytes(6).toString("hex")}`;
let cred1Id, cred2Id;

try {
  cred1Id = await setCredential("claude-haiku-4-5-20251001", dummyKey1);
  console.log(`Credencial #1 activada: ${cred1Id}`);

  // Observación de referencia ("el servicio ya estaba corriendo con la #1
  // activa antes de que nadie tocara el panel"): checkAndRevertIfUnsafe()
  // en un proceso recién arrancado trata su PRIMERA observación como estado
  // inicial, nunca como "cambio" -- por diseño (ver providerWatcher.mjs: no
  // gastar 32 llamadas al LLM en cada reinicio del contenedor). Sin esta
  // llamada de referencia, la siguiente comprobación (tras activar la #2)
  // sería TAMBIÉN la primera observación del proceso y no detectaría nada --
  // no por un fallo del mecanismo, sino porque este script arrancó un
  // proceso nuevo sin que el "vigilante" hubiera visto nunca la #1 activa.
  const baseline = await checkAndRevertIfUnsafe();
  check(
    "observación de referencia (proceso recién arrancado, credencial #1 ya activa): NO dispara nada",
    baseline.checked === false,
    JSON.stringify(baseline)
  );

  cred2Id = await setCredential("claude-haiku-4-5-20251001", dummyKey2);
  console.log(`Credencial #2 activada (simula "cambio de proveedor" desde el panel): ${cred2Id}`);

  const activeBefore = await pgQuery("select id, previous_credential_id from ai_provider_credentials where active = true;");
  check("la credencial activa antes de verificar es la #2", activeBefore[0]?.id === cred2Id);
  check("la #2 registra previous_credential_id = #1 (necesario para poder revertir)", activeBefore[0]?.previous_credential_id === cred1Id);

  console.log(
    "\n=== Paso 3: checkAndRevertIfUnsafe() SIN forzar -- el mismo camino que la vigilancia periódica real ===\n" +
      "(hasta 64 llamadas HTTP reales a api.anthropic.com con clave inválida; puede tardar hasta ~1 minuto)\n"
  );
  const result = await checkAndRevertIfUnsafe();

  check("checked === true (la suite SÍ llegó a correr, no abortó por error de red sin capturar)", result.checked === true);
  check("summary.total === 16 (los 16 pares corrieron, ninguno abortó el bucle)", result.summary?.total === 16);
  check("summary.pct === 0 (clave inválida -> las 16 clasificaciones fallan -> 0% equivalente)", result.summary?.pct === 0);
  check("reverted === true (0% < umbral -> revierte automáticamente)", result.reverted === true);
  check("revertedTo === credencial #1 (vuelve exactamente a la anterior, sin pedir clave de nuevo)", result.revertedTo === cred1Id);

  console.log("\n=== Paso 4: verificando el estado de la BD tras la reversión (consulta independiente) ===\n");
  const activeAfter = await pgQuery("select id from ai_provider_credentials where active = true;");
  check("la fila activa en la BD es la #1 otra vez", activeAfter[0]?.id === cred1Id);

  const evalsWritten = await pgQuery(
    `select count(*)::int as n from ai_evals where prompt_version = ${escapeStringLiteral(PROMPT_VERSION)} and passed = false;`
  );
  check(
    `runNeutralitySuite() escribió las ${TEST_PAIRS.length} filas reales en ai_evals antes de revertir`,
    evalsWritten[0]?.n >= TEST_PAIRS.length,
    `encontradas=${evalsWritten[0]?.n}`
  );
} finally {
  console.log("\n=== Paso 5: limpieza (borrando credenciales de prueba + ai_evals sintéticos de este test) ===\n");
  await cleanup([cred1Id, cred2Id]);
  const leftoverCreds = await pgQuery("select count(*)::int as n from ai_provider_credentials;");
  const leftoverEvals = await pgQuery(
    `select count(*)::int as n from ai_evals where prompt_version = ${escapeStringLiteral(PROMPT_VERSION)} and passed = false;`
  );
  check("ai_provider_credentials sin restos de este test", leftoverCreds[0]?.n === 0, `filas restantes=${leftoverCreds[0]?.n}`);
  check("ai_evals sin restos de este test", leftoverEvals[0]?.n === 0, `filas restantes=${leftoverEvals[0]?.n}`);
}

console.log(`\n=== RESUMEN: ${totalOk}/${totalTests} comprobaciones pasadas ===`);
if (totalOk !== totalTests) {
  console.error("HAY FALLOS -- revisar arriba. Si quedaron filas de prueba sin limpiar, sus IDs están impresos más arriba.");
  process.exit(1);
}
console.log("Reversión automática de proveedor (D-016) verificada de extremo a extremo contra la BD real.");
