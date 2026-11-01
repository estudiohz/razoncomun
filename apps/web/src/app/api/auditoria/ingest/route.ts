import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { columnasDesdeExtraccion, confianzas } from '@/lib/vigia/extraccion';
import { autorPorDefecto, limpiarUrlReel } from '@/lib/vigia/casos';
import { RASTRO_BASE, citaElRastro, descargarExpedientes, elegir, esNifPersonaFisica, puntuar } from '@/lib/vigia/rastro';
import { copiarOrigen, verificarEnFuentes } from '@/lib/vigia/verificar';

/**
 * Entrada del bot de Telegram (n8n) cuando alguien pulsa "🔍 Es una auditoría"
 * (docs/auditoria-tiempo-real/07-decisiones.md, D-A17).
 *
 * `Authorization: Bearer $VIGIA_INGEST_SECRET`. Body JSON:
 * `{ chat_id, message_id, from?, text?, video_file_id?, transcript?, ai_model?, extraction? }`.
 * Idempotente por (chat_id, message_id): si n8n reintenta, devuelve el mismo id.
 *
 * Sergio (01-11-2026): el caso se rellena a partir del reel y el auditor solo
 * supervisa. Así que, además de guardar el envío en la bandeja, se abre el
 * caso ya relleno con la extracción de Gemini (validada en
 * lib/vigia/extraccion.ts: es salida de un modelo sobre texto ajeno, se trata
 * como dato). Sin extracción, el caso se abre igual, vacío.
 */
export const dynamic = 'force-dynamic';

function autorizado(req: Request): boolean {
  const esperado = process.env.VIGIA_INGEST_SECRET?.trim();
  if (!esperado) return false;
  const recibido = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

function texto(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const chatId = texto(body.chat_id, 64);
  const messageId = texto(body.message_id, 64);
  if (!chatId || !messageId) {
    return NextResponse.json({ error: 'faltan chat_id y message_id' }, { status: 400 });
  }

  const mensaje = texto(body.text, 4000);
  const videoFileId = texto(body.video_file_id, 256);
  if (!mensaje && !videoFileId) {
    return NextResponse.json({ error: 'el mensaje no trae texto ni vídeo' }, { status: 400 });
  }

  const enlace = mensaje?.match(/https?:\/\/\S+/)?.[0] ?? null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('watchdog_sources')
    .upsert(
      {
        kind: 'telegram',
        telegram_chat_id: chatId,
        telegram_message_id: messageId,
        telegram_from: texto(body.from, 128),
        message_text: mensaje,
        permalink: enlace,
        video_file_id: videoFileId,
        transcript: texto(body.transcript, 20000),
        ai_model: texto(body.ai_model, 100),
      },
      { onConflict: 'telegram_chat_id,telegram_message_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (error) {
    console.error('[auditoria/ingest]', error.message);
    return NextResponse.json({ error: 'no se pudo guardar' }, { status: 500 });
  }

  // Un caso por envío: si n8n reintenta, no se duplica.
  let casoId: string | null = null;
  let diagnostico: { encontrados: number; errores: string[] } | null = null;
  const { data: existente } = await admin.from('watchdog_alerts').select('id').eq('source_id', data.id).maybeSingle();
  if (existente) {
    casoId = existente.id;
  } else {
    const extraccion = body.extraction && typeof body.extraction === 'object' ? body.extraction : null;
    const columnas = extraccion ? columnasDesdeExtraccion(extraccion) : null;
    const resumen = (mensaje ?? enlace ?? 'Vídeo enviado por Telegram').trim();
    const { data: caso, error: errCaso } = await admin
      .from('watchdog_alerts')
      .insert({
        ...(columnas ?? {}),
        title: columnas?.title ?? resumen.slice(0, 120),
        description: resumen.slice(0, 4000),
        status: columnas ? 'analyzed' : 'flagged',
        source_id: data.id,
        // Mención del origen (0073): reel, artículo o web. Si cita El Rastro
        // del Dinero, el autor es su creador; si es una web, su dominio; si
        // no, lo completa el auditor.
        reel_url: limpiarUrlReel(enlace),
        ...(citaElRastro(mensaje, texto(body.transcript, 20000))
          ? { reel_autor: '@elrastrodeldinero', reel_autor_url: 'https://www.instagram.com/elrastrodeldinero/' }
          : { reel_autor: autorPorDefecto(enlace) }),
        ai_extraction: extraccion ? { ...extraccion, _confianzas: confianzas(extraccion) } : null,
        ai_model: texto(body.ai_model, 100),
      })
      .select('id')
      .single();
    if (errCaso) {
      // El envío ya está en la bandeja: el auditor puede abrir el caso a mano.
      console.error('[auditoria/ingest] caso', errCaso.message);
    } else {
      casoId = caso.id;
      await admin.from('watchdog_sources').update({ status: 'en_revision' }).eq('id', data.id);

      const transcript = texto(body.transcript, 20000);
      const textoReel = [transcript, mensaje, columnas?.title].filter(Boolean).join(' ');
      const pista = {
        importeCents: columnas?.importe_denunciado_cents ?? null,
        organismo: columnas?.organismo ?? null,
        texto: textoReel,
      };

      // 1. Pista de El Rastro del Dinero (si el reel la cita): NIF y código BDNS.
      const rastro = citaElRastro(mensaje, transcript)
        ? await pistaDelRastro(pista).catch((e) => {
            console.error('[auditoria/ingest] rastro', e instanceof Error ? e.message : e);
            return null;
          })
        : null;

      // 2. Comprobación contra la fuente oficial (BDNS), con copia sellada.
      const verif = await verificarEnFuentes(admin, caso.id, {
        ...pista,
        nif: rastro?.nif ?? null,
        beneficiario: rastro?.beneficiario ?? columnas?.adjudicatario ?? null,
        codigoBdns: rastro?.bdns ?? null,
      }).catch((e) => {
        console.error('[auditoria/ingest] verificar', e instanceof Error ? e.message : e);
        return null;
      });
      if (verif?.errores.length) console.error('[auditoria/ingest] verificar', verif.errores.join(' | '));
      diagnostico = { encontrados: verif?.encontrados ?? 0, errores: (verif?.errores ?? ['la verificación no respondió']).slice(0, 5) };

      // 3. Si la BDNS no respondió pero El Rastro sí encontró el caso, sus
      //    candidatos entran como pruebas (con el enlace oficial que dan).
      if (!verif?.encontrados && rastro) {
        await enlazarConElRastro(admin, caso.id, pista).catch((e) =>
          console.error('[auditoria/ingest] rastro', e instanceof Error ? e.message : e),
        );
      }

      // 4. Copia de respaldo del origen (artículos y webs; el vídeo lo sube n8n).
      await copiarOrigen(admin, caso.id, limpiarUrlReel(enlace));
    }
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://razoncomun.com';
  const ruta = casoId ? `/admin/presupuesto/auditorias/${casoId}` : '/admin/presupuesto/auditorias';
  return NextResponse.json({ ok: true, id: data.id, caso_id: casoId, admin_url: `${base}${ruta}`, verificacion: diagnostico });
}

/**
 * El reel cita elrastrodeldinero.com (el creador nos ha dado permiso, D-A03):
 * se busca su expediente allí. Los candidatos entran como pruebas BDNS con el
 * enlace oficial; si uno encaja claramente, rellena el caso con sus datos
 * (beneficiario, NIF, importe, fecha) y queda como prueba principal. El
 * auditor sigue siendo quien confirma contra la fuente oficial y firma.
 */
async function enlazarConElRastro(
  admin: SupabaseClient,
  casoId: string,
  pista: { importeCents: number | null; organismo: string | null; texto: string },
) {
  const expedientes = await descargarExpedientes();
  if (!expedientes.length) return;

  const { mejores, claro } = elegir(expedientes.map((e) => puntuar(e, pista)));
  if (!mejores.length) return;

  const filas = mejores.map((c) => {
    const e = c.expediente;
    const pagina = `${RASTRO_BASE}/ministerio/${encodeURIComponent(e.ministerioSlug)}`;
    return {
      alert_id: casoId,
      source_kind: 'bdns',
      expediente: e.bdns,
      organo: e.ministerio || null,
      adjudicatario: e.beneficiario,
      nif: e.nif,
      importe_cents: e.importeCents,
      fecha: e.fechaConcesion,
      url: e.fuentes[0] ?? pagina,
      raw: { origen: 'elrastrodeldinero', pagina, ...e.raw },
      match_score: c.score,
      matched_by: 'auto',
      selected: c === claro,
      notes: `Encontrado en El Rastro del Dinero (${pagina}). ${c.señales.join('; ')}.`.slice(0, 2000),
    };
  });
  const { error } = await admin.from('watchdog_evidence').insert(filas);
  if (error) throw new Error(error.message);

  if (claro) {
    const e = claro.expediente;
    await admin
      .from('watchdog_alerts')
      .update({
        organismo: e.ministerio || undefined,
        adjudicatario: e.beneficiario,
        adjudicatario_nif: e.nif,
        es_persona_fisica: esNifPersonaFisica(e.nif),
        importe_oficial_cents: e.importeCents,
        fecha_adjudicacion: e.fechaConcesion,
        categoria: /subvenci/i.test(`${e.tipoConvocatoria} ${e.titulo}`) ? 'subvencion' : undefined,
      })
      .eq('id', casoId);
  }
}

/** Lo que El Rastro del Dinero sabe del caso del reel: solo si el emparejamiento es claro. */
async function pistaDelRastro(pista: { importeCents: number | null; organismo: string | null; texto: string }) {
  const { claro } = elegir((await descargarExpedientes()).map((e) => puntuar(e, pista)));
  if (!claro) return null;
  return { bdns: claro.expediente.bdns, nif: claro.expediente.nif, beneficiario: claro.expediente.beneficiario };
}
