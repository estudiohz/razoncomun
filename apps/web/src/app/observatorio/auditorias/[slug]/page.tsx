import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CtaAfiliacion } from '@/components/blog/CtaAfiliacion';
import { generarCaptcha } from '@/lib/antibot/captcha';
import { sanearHtml } from '@/lib/blog/html';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import {
  NOMBRE_CATEGORIA,
  NOMBRE_VERIFICACION,
  auditoriaAbierta,
  casoPublico,
  euros,
  eurosEnteros,
  fechaLarga,
  listarCasosPublicos,
  type CasoPublico,
} from '@/lib/vigia/publico';
import { FormularioRectificacion } from './FormularioRectificacion';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const caso = await casoPublico(await createClient(), slug);
  return metadatosPagina({
    titulo: caso?.title ?? 'Caso de auditoría',
    descripcion: caso
      ? `${caso.organismo ?? ''} · ${euros(caso.importe_oficial_cents)}. Verificado contra la fuente oficial por Razón Común.`
      : 'Caso de auditoría del gasto público.',
    ruta: `/observatorio/auditorias/${slug}`,
    noindex: !auditoriaAbierta(),
  });
}

const NIVEL: Record<string, string> = { estatal: 'Estatal', autonomico: 'Autonómico', local: 'Local', otro: 'Otro' };
const FUENTE: Record<string, string> = { placsp: 'Plataforma de Contratación', boe: 'BOE', bdns: 'BDNS', borme: 'BORME', autonomica: 'Boletín autonómico', otro: 'Fuente oficial' };

/**
 * Ficha pública de un caso (F2). Medidas del doc 03 visibles en pantalla:
 * M1 firma y fecha · M2 prueba oficial con copia sellada · M3 hechos y
 * valoración separados · M6 réplica · M7 rectificación e historial · M8 aviso
 * de IA · origen citado (0073).
 */
export default async function CasoPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const caso = await casoPublico(supabase, slug);
  if (!caso) notFound();

  const [{ data: prueba }, { data: versiones }, { data: propuestas }, { data: partidas }] = await Promise.all([
    supabase
      .from('watchdog_evidence')
      .select('source_kind, expediente, url, snapshot_sha256, snapshot_at, raw')
      .eq('alert_id', caso.id)
      .eq('selected', true)
      .maybeSingle(),
    supabase.from('watchdog_alert_versions').select('version, reason, changed_at').eq('alert_id', caso.id).order('version'),
    supabase.from('proposals').select('title, slug, id, status').eq('source_alert_id', caso.id).not('status', 'in', '(draft,archived)'),
    supabase.from('watchdog_alert_partidas').select('partida:sim_partidas(nombre, slug, parent_id, publicado)').eq('alert_id', caso.id),
  ]);
  const captcha = generarCaptcha();
  const urlBases = (prueba?.raw as { urlBases?: string } | null)?.urlBases;

  const otros = (await listarCasosPublicos(supabase)).filter((c) => c.id !== caso.id).slice(0, 3);

  // Misma plantilla que una noticia (FichaArticulo): cabecera a la izquierda a
  // 1200px con foto 21:9, metadatos debajo y rejilla 75/25 con sidebar sticky.
  return (
    <>
      <div className="mx-auto max-w-[1200px] px-4 min-[720px]:px-8">
        <header className="pt-8 min-[981px]:pt-10">
          <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
            <Link href="/observatorio/auditorias" className="rounded-full bg-grad px-3 py-1 text-white no-underline">
              Auditoría del gasto público
            </Link>
            {caso.verificacion && (
              <span className="rounded-full bg-teal-texto/10 px-2.5 py-1 text-teal-texto">
                {NOMBRE_VERIFICACION[caso.verificacion] ?? caso.verificacion}
              </span>
            )}
            {caso.categoria && (
              <span className="rounded-full bg-fondo px-2.5 py-1 text-cuerpo">{NOMBRE_CATEGORIA[caso.categoria] ?? caso.categoria}</span>
            )}
            {caso.organismo_nivel && <span className="rounded-full bg-fondo px-2.5 py-1 text-cuerpo">{NIVEL[caso.organismo_nivel]}</span>}
          </div>
          <h1 className="mt-4 text-[clamp(28px,3.8vw,44px)] font-extrabold leading-[1.16] text-tinta">{caso.title}</h1>
          <p className="mt-[18px] text-[18px] leading-[1.55] text-cuerpo">
            {[caso.organismo, euros(caso.importe_oficial_cents)].filter((x) => x && x !== '—').join(' · ')}
          </p>
        </header>

        {caso.cover_image && (
          <div className="mt-8 overflow-hidden rounded-[22px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={caso.cover_image}
              alt=""
              className="aspect-[21/9] w-full object-cover shadow-[0_24px_60px_rgba(27,61,156,.12)]"
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-b border-linea pb-7 text-[13.5px] font-semibold text-gris">
          <span className="flex items-center gap-[9px]">
            <span aria-hidden className="h-[30px] w-[30px] rounded-full bg-grad" />
            Verificado{caso.verified_at && ` el ${fechaLarga(caso.verified_at)}`}
          </span>
          <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-gris" />
          <span>
            Publicado el <time dateTime={caso.published_at}>{fechaLarga(caso.published_at)}</time>
          </span>
        </div>
      </div>

      <div className="mx-auto mb-[60px] mt-[40px] grid max-w-[1200px] grid-cols-1 gap-10 px-4 min-[720px]:px-8 min-[981px]:grid-cols-[75%_25%] min-[981px]:gap-0">
        <article className="min-w-0 space-y-8 min-[981px]:pr-14">
        {caso.rectificado_at && (
          <div className="rounded-tarjeta border border-naranja bg-naranja/10 p-5 text-[14.5px] text-cuerpo">
            <p className="text-[12px] font-extrabold uppercase tracking-[.08em] text-naranja">
              Rectificado el {fechaLarga(caso.rectificado_at)}
            </p>
            <p className="mt-2 whitespace-pre-line">{caso.rectificacion_nota}</p>
            <p className="mt-2 text-[12.5px] text-gris">Este caso ya no suma en el contador. Las versiones anteriores están en el historial.</p>
          </div>
        )}


        <section>
          <h2 className="text-[13px] font-extrabold uppercase tracking-[.1em] text-titular">Hechos verificados</h2>
          <p className="mt-1 text-[12.5px] text-gris">Lo que dicen los documentos oficiales, sin valoraciones.</p>
          <div className="prosa mt-3 text-[15.5px] text-cuerpo" dangerouslySetInnerHTML={{ __html: sanearHtml(caso.hechos_html ?? '') }} />
        </section>

        {caso.valoracion_html && (
          <section className="rounded-tarjeta border border-linea bg-fondo p-6">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[.1em] text-titular">Valoración de Razón Común</h2>
            <p className="mt-1 text-[12.5px] text-gris">Nuestra opinión, separada de los hechos.</p>
            <div className="prosa mt-3 text-[15.5px] text-cuerpo" dangerouslySetInnerHTML={{ __html: sanearHtml(caso.valoracion_html) }} />
          </section>
        )}

        {prueba && (
          <section className="rounded-tarjeta border border-teal-texto/40 bg-teal-texto/5 p-6 text-[14.5px] text-cuerpo">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[.1em] text-titular">Prueba oficial</h2>
            <p className="mt-2">
              {FUENTE[prueba.source_kind] ?? 'Fuente oficial'}
              {prueba.expediente && ` · ${prueba.expediente}`}
            </p>
            <a href={prueba.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-semibold underline">
              Ver el documento en la fuente oficial ↗
            </a>
            {urlBases && (
              <a href={urlBases} target="_blank" rel="noopener noreferrer" className="ml-4 inline-block font-semibold underline">
                Bases en el BOE ↗
              </a>
            )}
            {prueba.snapshot_sha256 && (
              <p className="mt-3 break-all text-[12px] text-gris">
                Guardamos una copia sellada del documento tal como estaba el {fechaLarga(prueba.snapshot_at)} · huella SHA-256{' '}
                {prueba.snapshot_sha256}
              </p>
            )}
          </section>
        )}

        <section className="space-y-2 text-[14.5px] text-cuerpo">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[.1em] text-titular">Derecho de réplica</h2>
          {caso.replica_texto ? (
            <blockquote className="border-l-4 border-linea pl-4 whitespace-pre-line">{caso.replica_texto}</blockquote>
          ) : caso.replica_solicitada_at ? (
            <p>Pedimos su versión a la entidad afectada el {fechaLarga(caso.replica_solicitada_at)}. No hemos recibido respuesta.</p>
          ) : (
            <p>Este caso solo nombra a un organismo público. Si es usted parte afectada, puede pedir la rectificación abajo.</p>
          )}
        </section>

        {(propuestas?.length || partidas?.length) ? (
          <section className="space-y-2 text-[14.5px] text-cuerpo">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[.1em] text-titular">Qué proponemos</h2>
            {propuestas?.map((p) => (
              <p key={p.id}>
                💡 <Link href={`/propuestas/${p.slug ?? p.id}`} className="font-semibold">{p.title}</Link> — vótala en el tablero.
              </p>
            ))}
            {partidas?.map((x, i) => {
              const p = (Array.isArray(x.partida) ? x.partida[0] : x.partida) as { nombre: string; slug: string | null; publicado: boolean } | null;
              return p?.publicado ? (
                <p key={i}>
                  📊 Partida del presupuesto: {p.slug ? <Link href={`/pais/${p.slug}`}>{p.nombre}</Link> : p.nombre}
                </p>
              ) : null;
            })}
          </section>
        ) : null}

        <footer className="space-y-2 border-t border-linea pt-6 text-[13px] text-gris">
          <p>
            {/* El nombre de quien firma queda interno (decisión de Sergio, 02/11/2026). */}
            <strong className="text-cuerpo">Verificado{caso.verified_at && ` el ${fechaLarga(caso.verified_at)}`}.</strong> Publicado el{' '}
            {fechaLarga(caso.published_at)}.
          </p>
          <p>
            Uso de inteligencia artificial: la transcripción y una primera extracción de datos se hicieron con IA
            {caso.ai_model ? ` (${caso.ai_model})` : ''}. Todo lo publicado lo ha comprobado y firmado una persona contra la
            fuente oficial. <Link href="/observatorio/auditorias/metodologia">Metodología</Link>.
          </p>
          {versiones && versiones.length > 0 && (
            <details>
              <summary className="cursor-pointer font-semibold text-cuerpo">Historial de versiones ({versiones.length})</summary>
              <ul className="mt-2 space-y-1">
                {versiones.map((v) => (
                  <li key={v.version}>
                    v{v.version} · {fechaLarga(v.changed_at)} · {v.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </footer>

        <section className="rounded-tarjeta border border-linea bg-white p-6">
          <h2 className="text-[17px] font-extrabold text-titular">¿Hay un error? Pide la rectificación</h2>
          <p className="mt-1 mb-4 text-[13.5px] text-cuerpo">
            Si eres parte afectada o has encontrado un dato incorrecto, cuéntanoslo. Respondemos en 3 días como máximo.
          </p>
          <FormularioRectificacion slug={caso.slug} pregunta={captcha.pregunta} token={captcha.token} />
        </section>
        </article>

        <aside>
          <div className="flex flex-col gap-[22px] min-[981px]:sticky min-[981px]:top-24">
            <ReelOrigen caso={caso} />
            <dl className="grid gap-4 rounded-tarjeta border border-linea bg-panel p-5">
              <Dato titulo="Organismo">{caso.organismo ?? '—'}</Dato>
              <Dato titulo="Beneficiario o adjudicatario">
                {caso.adjudicatario ?? '—'}
                {caso.adjudicatario_nif && <span className="block text-[12.5px] text-gris">NIF/ID {caso.adjudicatario_nif}</span>}
              </Dato>
              <Dato titulo="Importe oficial">{euros(caso.importe_oficial_cents)}</Dato>
              <Dato titulo="Fecha">{fechaLarga(caso.fecha_adjudicacion)}</Dato>
              {caso.importe_denunciado_cents != null && caso.importe_denunciado_cents !== caso.importe_oficial_cents && (
                <Dato titulo="Importe que se difundió">{euros(caso.importe_denunciado_cents)}</Dato>
              )}
            </dl>
            {otros.length > 0 && (
              <div className="rounded-tarjeta border border-linea bg-white p-5">
                <p className="text-[12px] font-bold uppercase tracking-[.08em] text-gris">Otros casos</p>
                <ul className="mt-3 space-y-3">
                  {otros.map((c) => (
                    <li key={c.id}>
                      <Link href={`/observatorio/auditorias/${c.slug}`} className="text-[14px] font-bold text-titular no-underline hover:underline">
                        {c.title}
                      </Link>
                      <span className="block text-[12.5px] text-gris">{eurosEnteros(c.importe_oficial_cents)}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/observatorio/auditorias" className="mt-3 inline-block text-[13px] font-bold">
                  Ver todos →
                </Link>
              </div>
            )}
            <CtaAfiliacion />
          </div>
        </aside>
      </div>
    </>
  );
}

/** Primer widget del lateral: fotograma del reel de origen, enlace y cuenta (0073/0080). */
function ReelOrigen({ caso }: { caso: CasoPublico }) {
  if (!caso.reel_url && !caso.reel_autor) return null;
  const esVideo = Boolean(caso.reel_url && /instagram\.com|tiktok\.com|youtube\.com|youtu\.be/i.test(caso.reel_url));
  const marco = (
    <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-boton bg-grad">
      {caso.reel_frame && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={caso.reel_frame} alt="" className="h-full w-full object-cover" />
      )}
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-[22px] text-white">▶</span>
      </span>
    </span>
  );
  return (
    <div className="rounded-tarjeta border border-linea bg-white p-4">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-[.08em] text-gris">Origen del caso</p>
      {caso.reel_url ? (
        <a href={caso.reel_url} target="_blank" rel="noopener noreferrer nofollow" aria-label="Ver el reel">
          {marco}
        </a>
      ) : (
        marco
      )}
      {caso.reel_url && (
        <a
          href={caso.reel_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-3 block text-[14px] font-bold"
        >
          {esVideo ? 'Ver el reel ↗' : 'Ver la publicación ↗'}
        </a>
      )}
      {caso.reel_autor && (
        <p className="mt-1 text-[13px] text-gris">
          De{' '}
          {caso.reel_autor_url ? (
            <a href={caso.reel_autor_url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold">
              {caso.reel_autor}
            </a>
          ) : (
            <strong className="text-cuerpo">{caso.reel_autor}</strong>
          )}
        </p>
      )}
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-bold uppercase tracking-[.08em] text-gris">{titulo}</dt>
      <dd className="mt-1 text-[15.5px] font-semibold text-titular">{children}</dd>
    </div>
  );
}
