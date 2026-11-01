import { createClient } from '@/lib/supabase/server';

const euros = (c: number) => (c / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 });

interface Fila {
  partida_id: string;
  nota: string | null;
  caso: {
    id: string;
    title: string;
    organismo: string | null;
    importe_oficial_cents: number | null;
    status: string;
    evidencia: { url: string; selected: boolean }[];
  } | null;
}

/**
 * Casos de auditoría que caen en estas partidas del Simulador del País (0072).
 * En /pais solo aparecen los casos publicados (lo filtra la RLS). En el admin
 * (`interno`), los auditores ven todos y enlazan a la ficha del caso.
 */
export async function CasosEnPartidas({ partidaIds, interno = false }: { partidaIds: string[]; interno?: boolean }) {
  if (!partidaIds.length) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('watchdog_alert_partidas')
    .select(
      'partida_id, nota, caso:watchdog_alerts(id, title, organismo, importe_oficial_cents, status, evidencia:watchdog_evidence(url, selected))',
    )
    .in('partida_id', partidaIds.slice(0, 300));

  const vistos = new Set<string>();
  const filas = ((data ?? []) as unknown as Fila[]).filter((f) => {
    if (!f.caso || vistos.has(f.caso.id)) return false;
    if (!interno && f.caso.status !== 'published') return false;
    vistos.add(f.caso.id);
    return true;
  });
  if (!filas.length) return null;

  const total = filas.reduce((s, f) => s + (f.caso?.importe_oficial_cents ?? 0), 0);

  return (
    <section className="mt-10 rounded-tarjeta border border-linea bg-panel p-6">
      <h2 className="text-[20px] font-extrabold text-titular">🔍 Gasto auditado en estas partidas</h2>
      <p className="mt-1 text-[13.5px] text-cuerpo">
        {filas.length} caso{filas.length === 1 ? '' : 's'} verificado{filas.length === 1 ? '' : 's'} contra fuentes oficiales
        {total > 0 && ` · ${euros(total)} €`}
      </p>
      <ul className="mt-4 space-y-3">
        {filas.map((f) => {
          const c = f.caso!;
          const oficial = c.evidencia.find((e) => e.selected)?.url;
          return (
            <li key={c.id} className="rounded-boton border border-linea bg-white p-4 text-[14px] text-cuerpo">
              <p className="font-bold text-titular">
                {interno ? <a href={`/admin/presupuesto/auditorias/${c.id}`}>{c.title}</a> : c.title}
                {interno && c.status !== 'published' && (
                  <span className="ml-2 text-[11.5px] font-semibold text-naranja">({c.status})</span>
                )}
              </p>
              <p className="mt-1 text-[13px] text-gris">
                {[c.organismo, c.importe_oficial_cents != null && `${euros(c.importe_oficial_cents)} €`, f.nota]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {oficial && (
                <a href={oficial} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[13px] font-semibold">
                  Fuente oficial ↗
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
