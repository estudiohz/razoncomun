import { createClient } from '@/lib/supabase/server';
import { MencionOrigen } from './MencionOrigen';

const euros = (c: number) => (c / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 });

/**
 * "Esta propuesta nace de una auditoría" (0072). Se lee con el cliente del
 * visitante: la RLS solo devuelve el caso si está PUBLICADO, así que un caso
 * en revisión no asoma en la web pública. Para el equipo, el enlace interno
 * vive en la ficha del caso.
 */
export async function OrigenAuditoria({ alertId }: { alertId: string | null }) {
  if (!alertId) return null;
  const supabase = await createClient();
  const [{ data: caso }, { data: prueba }] = await Promise.all([
    supabase
      .from('watchdog_alerts')
      .select('title, organismo, importe_oficial_cents, status, slug, reel_url, reel_autor, reel_autor_url')
      .eq('id', alertId)
      .eq('status', 'published')
      .maybeSingle(),
    supabase.from('watchdog_evidence').select('url, source_kind, expediente').eq('alert_id', alertId).eq('selected', true).maybeSingle(),
  ]);
  if (!caso) return null;

  return (
    <div className="mt-5 rounded-tarjeta border border-teal-texto/40 bg-teal-texto/5 p-5 text-[14.5px] text-cuerpo">
      <p className="text-[12px] font-extrabold uppercase tracking-[.08em] text-titular">🔍 Nace de una auditoría del gasto público</p>
      <p className="mt-2">
        <strong>{caso.title}</strong>
        {caso.organismo && ` · ${caso.organismo}`}
        {caso.importe_oficial_cents != null && ` · ${euros(caso.importe_oficial_cents)} €`}
      </p>
      <MencionOrigen url={caso.reel_url} autor={caso.reel_autor} autorUrl={caso.reel_autor_url} className="mt-2" />
      {prueba?.url && (
        <a href={prueba.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold underline">
          Ver la fuente oficial{prueba.expediente ? ` (${prueba.source_kind.toUpperCase()} ${prueba.expediente})` : ''} ↗
        </a>
      )}
    </div>
  );
}
