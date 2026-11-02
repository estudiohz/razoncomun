import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { createClient } from '@/lib/supabase/server';
import {
  auditoriaAbierta,
  boeIndexado,
  eurosEnteros,
  fechaLarga,
  listarCasosPublicos,
  totales,
  type CasoPublico,
} from '@/lib/vigia/publico';

const tarjeta = 'rounded-tarjeta border border-linea bg-white p-5';
const rotulo = 'text-[12px] font-bold uppercase tracking-[.12em] text-gris';
// Espectro del aro, nunca monocolor azul.
const COLORES = ['#16B8A0', '#8B30D9', '#C3369E', '#E8792F', '#2BC7E8', '#777777'];

/**
 * Panel «Auditoría del gasto público» en la portada del Observatorio
 * (D-A12): tres cifras arriba. No aparece hasta que la sección se abre
 * (AUDITORIA_PUBLICA) y haya al menos un caso publicado.
 */
export async function BloqueAuditoriasObservatorio() {
  if (!auditoriaAbierta()) return null;
  const supabase = await createClient();
  const [casos, total, boe] = await Promise.all([listarCasosPublicos(supabase), totales(supabase), boeIndexado(supabase)]);
  if (!casos.length) return null;

  return (
    <Contenedor as="section" className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className={rotulo}>Auditoría del gasto público</p>
        <Link href="/observatorio/auditorias" className="text-[14px] font-bold">
          Ver todos los casos →
        </Link>
      </div>
      <div className="grid gap-4 min-[820px]:grid-cols-3">
        <div className={tarjeta}>
          <p className={rotulo}>Euros señalados</p>
          <p className="mt-2 text-[32px] font-extrabold leading-none text-titular">{eurosEnteros(total.importe_cents)}</p>
          <p className="mt-2 text-[13.5px] text-cuerpo">
            en {total.casos} caso{total.casos === 1 ? '' : 's'} verificado{total.casos === 1 ? '' : 's'} contra fuentes oficiales
          </p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>BOE escaneado</p>
          <p className="mt-2 text-[32px] font-extrabold leading-none text-titular">{boe.total.toLocaleString('es-ES')}</p>
          <p className="mt-2 text-[13.5px] text-cuerpo">
            disposiciones del BOE revisadas{boe.desde ? ` desde el ${fechaLarga(boe.desde)}` : ''}
          </p>
        </div>
        <div className={tarjeta}>
          <p className={rotulo}>Lo más señalado</p>
          <Categorias casos={casos} />
        </div>
      </div>
    </Contenedor>
  );
}

/** Reparto del gasto señalado por categoría del Observatorio (0081); si no hay importes, por nº de casos. */
function Categorias({ casos }: { casos: CasoPublico[] }) {
  const porImporte = casos.some((c) => (c.importe_oficial_cents ?? 0) > 0);
  const suma = new Map<string, number>();
  for (const c of casos) {
    const k = c.categoria_blog?.name ?? 'Sin categoría';
    suma.set(k, (suma.get(k) ?? 0) + (porImporte ? c.importe_oficial_cents ?? 0 : 1));
  }
  const filas = [...suma.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = filas.reduce((s, [, v]) => s + v, 0) || 1;

  // Donut con stroke-dasharray sobre un círculo de perímetro 100.
  let acumulado = 0;
  const r = 15.9155;
  return (
    <div className="mt-3 flex items-center gap-4">
      <svg viewBox="0 0 42 42" className="h-[104px] w-[104px] shrink-0 -rotate-90" role="img" aria-label="Reparto por categoría">
        <circle cx="21" cy="21" r={r} fill="none" stroke="#EEF0F4" strokeWidth="7" />
        {filas.map(([k, v], i) => {
          const pct = (v / total) * 100;
          const arco = (
            <circle
              key={k}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={COLORES[i % COLORES.length]}
              strokeWidth="7"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-acumulado}
            />
          );
          acumulado += pct;
          return arco;
        })}
      </svg>
      <ul className="min-w-0 space-y-1 text-[13px] text-cuerpo">
        {filas.slice(0, 5).map(([k, v], i) => (
          <li key={k} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
            <span className="truncate">{k}</span>
            <span className="ml-auto pl-2 font-bold text-titular">{Math.round((v / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Listado de casos publicados, en la zona de contenido de la portada o de una categoría. */
export function ListadoAuditoriasObservatorio({ casos }: { casos: CasoPublico[] }) {
  if (!casos.length) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[20px] font-extrabold text-tinta">Casos de auditoría</h2>
      <ul className="divide-y divide-linea rounded-tarjeta border border-linea bg-white">
        {casos.map((c) => (
          <li key={c.id}>
            <Link
              href={`/observatorio/auditorias/${c.slug}`}
              className="grid gap-1 px-5 py-4 no-underline hover:bg-panel min-[720px]:grid-cols-[1fr_auto] min-[720px]:items-center min-[720px]:gap-6"
            >
              <span className="min-w-0">
                <span className="block text-[15.5px] font-bold text-titular">{c.title}</span>
                <span className="block text-[13px] text-gris">
                  {[c.organismo, c.categoria_blog?.name, fechaLarga(c.published_at)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="text-[16px] font-extrabold text-titular">{eurosEnteros(c.importe_oficial_cents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
