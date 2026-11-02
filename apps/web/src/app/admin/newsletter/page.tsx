import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { urlSitio } from '@/lib/supabase/env';
import { tokenWebhook } from '@/lib/newsletter/brevo';
import { LIMITE_DIARIO, nombreMes } from '@/lib/newsletter/campanas';
import { BotonPrueba } from './BotonPrueba';
import { ESTADO, TIPO, pct, type Stats } from './comun';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Newsletter',
  descripcion: 'Correos de participación enviados y sus estadísticas.',
  ruta: '/admin/newsletter',
  noindex: true,
});

export const dynamic = 'force-dynamic';

const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });

/**
 * Panel de la newsletter (docs/tecnico/newsletter.md, N2). Las cifras salen
 * de `newsletter_stats()` (0079): envíos de la cola + eventos del webhook de
 * Brevo. Aperturas y clics son personas únicas, no eventos.
 */
export default async function AdminNewsletterPage() {
  const { supabase, esAdmin, user } = await requireAdminOrEditor('/admin/newsletter');
  const [{ data: campanas, error }, { data: stats }, { count: hoy }] = await Promise.all([
    supabase
      .from('newsletter_campaigns')
      .select('id, tipo, mes, asunto, estado, destinatarios, creada_at, enviada_at')
      .order('creada_at', { ascending: false })
      .limit(200),
    supabase.rpc('newsletter_stats'),
    supabase
      .from('newsletter_envios')
      .select('id', { count: 'exact', head: true })
      .gte('enviado_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
  ]);
  const porCampana = new Map(((stats ?? []) as Stats[]).map((s) => [s.campaign_id, s]));
  const webhook = esAdmin ? `${urlSitio().replace(/\/$/, '')}/api/newsletter/brevo?k=${tokenWebhook()}` : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-extrabold text-titular">Newsletter</h1>
        <p className="mt-1 max-w-[70ch] text-[13.5px] text-cuerpo">
          Avisos de participación: la encuesta del mes (salen los días 1-10, en cuanto está abierta) y el recordatorio
          del día 25 a quien no ha terminado. Cupo: {LIMITE_DIARIO} correos al día; hoy van <strong>{hoy ?? 0}</strong>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <BotonPrueba email={user.email ?? null} />
      </div>

      {error ? (
        <p className="rounded-boton border border-magenta/40 bg-magenta/5 p-4 text-[13.5px] text-magenta">{error.message}</p>
      ) : !campanas?.length ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-[13.5px] text-cuerpo">
          Todavía no se ha enviado ninguna. La primera saldrá cuando haya una encuesta marcada como «del mes» y esté
          abierta.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-tarjeta border border-linea bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold uppercase tracking-wide text-gris">
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Asunto</th>
                <th className="px-3 py-2.5 text-right">Enviados</th>
                <th className="px-3 py-2.5 text-right">Entregados</th>
                <th className="px-3 py-2.5 text-right">Abiertos</th>
                <th className="px-3 py-2.5 text-right">Clics</th>
                <th className="px-3 py-2.5 text-right">Rebotes</th>
                <th className="px-3 py-2.5 text-right">Bajas</th>
                <th className="px-3 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {campanas.map((c) => {
                const s = porCampana.get(c.id);
                const env = Number(s?.enviados ?? 0);
                return (
                  <tr key={c.id} className="border-t border-linea align-top text-[13px] text-cuerpo">
                    <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-gris">{fecha.format(new Date(c.creada_at))}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {TIPO[c.tipo] ?? c.tipo}
                      <span className="block text-[12px] text-gris">{nombreMes(String(c.mes).slice(0, 7))}</span>
                    </td>
                    <td className="max-w-[340px] px-3 py-3">
                      <Link href={`/admin/newsletter/${c.id}`} className="font-semibold text-accion no-underline hover:underline">
                        {c.asunto}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {env}
                      <span className="block text-[11.5px] text-gris">de {c.destinatarios}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{Number(s?.entregados ?? 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {Number(s?.abiertos ?? 0)} <span className="text-[11.5px] text-gris">{pct(Number(s?.abiertos ?? 0), env)}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {Number(s?.clics ?? 0)} <span className="text-[11.5px] text-gris">{pct(Number(s?.clics ?? 0), env)}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{Number(s?.rebotes ?? 0)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{Number(s?.bajas ?? 0)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${ESTADO[c.estado]?.clase ?? ''}`}>
                        {ESTADO[c.estado]?.texto ?? c.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {webhook && (
        <details className="rounded-tarjeta border border-linea bg-white p-4 text-[13px] text-cuerpo">
          <summary className="cursor-pointer font-bold text-titular">Configuración del webhook de Brevo (solo admin)</summary>
          <p className="mt-2">
            Las entregas, aperturas, clics y rebotes llegan desde Brevo. En Brevo → Transactional → Settings → Webhooks,
            crea uno con esta URL y marca todos los eventos:
          </p>
          <code className="mt-2 block break-all rounded-boton bg-gris/10 p-2 text-[12px]">{webhook}</code>
          <p className="mt-2 text-[12px] text-gris">No la compartas: la clave del final es lo que impide que otro meta datos falsos.</p>
        </details>
      )}
    </div>
  );
}
