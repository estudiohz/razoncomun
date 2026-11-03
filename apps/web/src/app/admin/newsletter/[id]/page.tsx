import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { nombreMes, respondidasPorUsuario } from '@/lib/newsletter/campanas';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelarCampana } from '../actions';
import { ESTADO, TIPO, pct, type Stats } from '../comun';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Newsletter',
  descripcion: 'Detalle de una campaña.',
  ruta: '/admin/newsletter',
  noindex: true,
});

export const dynamic = 'force-dynamic';

const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });

const NOMBRE_EVENTO: Record<string, string> = {
  hard_bounce: 'Rebote permanente',
  soft_bounce: 'Rebote temporal',
  invalid_email: 'Dirección no válida',
  blocked: 'Bloqueado',
  unsubscribed: 'Baja',
  spam: 'Marcado como spam',
};

export default async function CampanaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, esAdmin } = await requireAdminOrEditor(`/admin/newsletter/${id}`);

  const [{ data: c }, { data: stats }, { data: clics }, { data: incidencias }, { data: omitidos }] = await Promise.all([
    supabase.from('newsletter_campaigns').select('*').eq('id', id).maybeSingle(),
    supabase.rpc('newsletter_stats'),
    supabase.from('newsletter_eventos').select('url, envio_id').eq('campaign_id', id).eq('tipo', 'click').limit(5000),
    supabase
      .from('newsletter_eventos')
      .select('tipo, email, ocurrido_at')
      .eq('campaign_id', id)
      .in('tipo', Object.keys(NOMBRE_EVENTO))
      .order('ocurrido_at', { ascending: false })
      .limit(200),
    supabase.from('newsletter_envios').select('error').eq('campaign_id', id).in('estado', ['omitido', 'fallido']).limit(5000),
  ]);
  if (!c) notFound();

  // Destinatarios uno a uno. Las respuestas a encuestas se leen con la service
  // role: la RLS no deja a un editor ver las de otros.
  const admin = createAdminClient();
  const { data: envios } = await admin
    .from('newsletter_envios')
    .select('id, user_id, email, estado, enviado_at, perfil:profiles(display_name, first_name)')
    .eq('campaign_id', id)
    .order('enviado_at', { ascending: false, nullsFirst: false })
    .limit(5000);
  const { data: evs } = await admin.from('newsletter_eventos').select('envio_id, tipo').eq('campaign_id', id).in('tipo', ['opened', 'unique_opened', 'click']).limit(20000);
  const abiertos = new Set((evs ?? []).map((e) => e.envio_id));
  const conClic = new Set((evs ?? []).filter((e) => e.tipo === 'click').map((e) => e.envio_id));
  let totalPreguntas = 0;
  let respondidas = new Map<string, number>();
  if (c.survey_id) {
    const { count } = await admin.from('survey_questions').select('id', { count: 'exact', head: true }).eq('survey_id', c.survey_id);
    totalPreguntas = count ?? 0;
    respondidas = await respondidasPorUsuario(admin, c.survey_id, (envios ?? []).map((e) => e.user_id));
  }

  const s = ((stats ?? []) as Stats[]).find((x) => x.campaign_id === id);
  const n = (k: keyof Stats) => Number(s?.[k] ?? 0);
  const env = n('enviados');

  // Clics por enlace, en personas únicas.
  const porUrl = new Map<string, Set<string>>();
  for (const e of clics ?? []) {
    if (!e.url) continue;
    if (!porUrl.has(e.url)) porUrl.set(e.url, new Set());
    porUrl.get(e.url)!.add(e.envio_id ?? Math.random().toString());
  }
  const enlaces = [...porUrl].map(([url, set]) => ({ url, n: set.size })).sort((a, b) => b.n - a.n);

  const motivos = new Map<string, number>();
  for (const o of omitidos ?? []) motivos.set(o.error ?? 'sin motivo', (motivos.get(o.error ?? 'sin motivo') ?? 0) + 1);

  const cifras: [string, string | number, string?][] = [
    ['Destinatarios', c.destinatarios],
    ['Enviados', env, n('pendientes') ? `${n('pendientes')} en cola` : undefined],
    ['Entregados', n('entregados'), pct(n('entregados'), env)],
    ['Abiertos', n('abiertos'), pct(n('abiertos'), env)],
    ['Clics', n('clics'), pct(n('clics'), env)],
    ['Rebotes', n('rebotes'), pct(n('rebotes'), env)],
    ['Bajas', n('bajas')],
    ['Spam', n('spam')],
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/newsletter" className="text-[13px] font-semibold text-accion no-underline hover:underline">
        ← Newsletter
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">
            {TIPO[c.tipo] ?? c.tipo} · {nombreMes(String(c.mes).slice(0, 7))}
          </p>
          <h1 className="mt-1 text-[22px] font-extrabold text-titular">{c.asunto}</h1>
          <p className="mt-1 text-[12.5px] text-gris">
            Creada el {fecha.format(new Date(c.creada_at))}
            {c.enviada_at ? ` · terminada el ${fecha.format(new Date(c.enviada_at))}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${ESTADO[c.estado]?.clase ?? ''}`}>
            {ESTADO[c.estado]?.texto ?? c.estado}
          </span>
          {esAdmin && c.estado === 'enviando' && (
            <form action={cancelarCampana.bind(null, c.id)}>
              <button type="submit" className="rounded-boton border border-magenta/40 px-3 py-1.5 text-[12.5px] font-bold text-magenta">
                Cancelar lo pendiente
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cifras.map(([k, v, extra]) => (
          <div key={k} className="rounded-tarjeta border border-linea bg-white p-4">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-gris">{k}</p>
            <p className="mt-1 text-[22px] font-extrabold tabular-nums text-titular">{v}</p>
            {extra && <p className="text-[12px] text-gris">{extra}</p>}
          </div>
        ))}
      </div>
      <p className="text-[12px] text-gris">
        Abiertos y clics son personas, no veces. Las aperturas son aproximadas: algunos clientes de correo (Apple Mail)
        las marcan solos y otros bloquean las imágenes.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-tarjeta border border-linea bg-white p-4">
          <h2 className="text-[15px] font-bold text-titular">Clics por enlace</h2>
          {enlaces.length ? (
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {enlaces.map((e) => (
                  <tr key={e.url} className="border-t border-linea">
                    <td className="break-all py-2 pr-3 text-cuerpo">{e.url}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{e.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-[13px] text-gris">Sin clics todavía.</p>
          )}
        </section>

        <section className="rounded-tarjeta border border-linea bg-white p-4">
          <h2 className="text-[15px] font-bold text-titular">Rebotes, bajas y spam</h2>
          {incidencias?.length ? (
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {incidencias.map((e, i) => (
                  <tr key={i} className="border-t border-linea">
                    <td className="py-2 pr-3 text-cuerpo">{e.email ?? '—'}</td>
                    <td className="py-2 pr-3 text-gris">{NOMBRE_EVENTO[e.tipo] ?? e.tipo}</td>
                    <td className="whitespace-nowrap py-2 text-right text-[12px] text-gris">{fecha.format(new Date(e.ocurrido_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-[13px] text-gris">Ninguno.</p>
          )}
          {motivos.size > 0 && (
            <>
              <h3 className="mt-4 text-[13px] font-bold text-titular">No enviados</h3>
              <ul className="mt-1 text-[13px] text-cuerpo">
                {[...motivos].map(([m, k]) => (
                  <li key={m}>
                    {m}: <strong>{k}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="rounded-tarjeta border border-linea bg-white p-4">
        <h2 className="text-[15px] font-bold text-titular">Destinatarios ({envios?.length ?? 0})</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-bold uppercase tracking-wide text-gris">
                <th className="py-2 pr-3">Persona</th>
                <th className="py-2 pr-3">Recibido</th>
                <th className="py-2 pr-3">Abierto</th>
                {c.survey_id && <th className="py-2">Encuesta</th>}
              </tr>
            </thead>
            <tbody>
              {(envios ?? []).map((e) => {
                const p = (Array.isArray(e.perfil) ? e.perfil[0] : e.perfil) as { display_name: string | null; first_name: string | null } | null;
                const hechas = respondidas.get(e.user_id) ?? 0;
                return (
                  <tr key={e.id} className="border-t border-linea">
                    <td className="py-2 pr-3">
                      <span className="font-semibold text-titular">{p?.display_name || p?.first_name || '—'}</span>
                      <span className="block text-[12px] text-gris">{e.email}</span>
                    </td>
                    <td className="py-2 pr-3 text-cuerpo">
                      {e.estado === 'enviado' && e.enviado_at ? fecha.format(new Date(e.enviado_at)) : <span className="text-gris">{e.estado}</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {abiertos.has(e.id) ? <span className="font-semibold text-teal-texto">Sí{conClic.has(e.id) ? ' · clic' : ''}</span> : <span className="text-gris">No</span>}
                    </td>
                    {c.survey_id && (
                      <td className="py-2">
                        {totalPreguntas > 0 && hechas >= totalPreguntas ? (
                          <span className="font-semibold text-teal-texto">Completada</span>
                        ) : hechas > 0 ? (
                          <span className="text-naranja">{hechas}/{totalPreguntas}</span>
                        ) : (
                          <span className="text-gris">No</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-tarjeta border border-linea bg-white p-4">
        <h2 className="text-[15px] font-bold text-titular">Contenido enviado</h2>
        <p className="mt-1 text-[12.5px] text-gris">Tal cual salió, con un destinatario de muestra («Nombre»).</p>
        {/* sandbox sin permisos: el HTML no puede ejecutar nada ni navegar el panel. */}
        <iframe title="Contenido del correo" srcDoc={c.html} sandbox="" className="mt-3 h-[900px] w-full rounded-boton border border-linea bg-white" />
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-titular">Versión en texto plano</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words text-[12.5px] text-cuerpo">{c.texto}</pre>
        </details>
      </section>
    </div>
  );
}
