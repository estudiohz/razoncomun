import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { auditoriaAbierta, euros, listarCasosPublicos, totales } from '@/lib/vigia/publico';

/**
 * Bloque «Auditoría del gasto público» en la portada del Observatorio
 * (D-A12). No aparece hasta que la sección se abre (AUDITORIA_PUBLICA) y haya
 * al menos un caso publicado.
 */
export async function BloqueAuditoriasObservatorio() {
  if (!auditoriaAbierta()) return null;
  const supabase = await createClient();
  const [casos, total] = await Promise.all([listarCasosPublicos(supabase), totales(supabase)]);
  if (!casos.length) return null;

  return (
    <section className="mx-auto mt-10 w-full max-w-[1100px] rounded-tarjeta border border-linea bg-panel p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[.12em] text-gris">Auditoría del gasto público</p>
          <p className="mt-1 text-[28px] font-extrabold text-titular">{euros(total.importe_cents)}</p>
          <p className="text-[13.5px] text-cuerpo">
            señalados en {total.casos} caso{total.casos === 1 ? '' : 's'} verificado{total.casos === 1 ? '' : 's'} contra
            fuentes oficiales
          </p>
        </div>
        <Link href="/observatorio/auditorias" className="text-[14px] font-bold">
          Ver todos los casos →
        </Link>
      </div>
      <ul className="mt-4 grid gap-3 min-[720px]:grid-cols-3">
        {casos.slice(0, 3).map((c) => (
          <li key={c.id} className="rounded-boton border border-linea bg-white p-4">
            <Link href={`/observatorio/auditorias/${c.slug}`} className="text-[14.5px] font-bold text-titular no-underline hover:underline">
              {c.title}
            </Link>
            <p className="mt-1 text-[13px] text-gris">{euros(c.importe_oficial_cents)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
