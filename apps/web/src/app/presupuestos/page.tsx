import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { SimuladorPresupuesto } from '@/components/participacion/SimuladorPresupuesto';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { listarMinisterios, obtenerAgregadoPresupuestoGente } from '@/lib/participacion/budget';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Simulador del presupuesto',
  descripcion: 'Reparte tú el Presupuesto General del Estado, ministerio a ministerio, y compara con "El Presupuesto de la Gente".',
  ruta: '/presupuestos',
});

function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export default async function PresupuestosPage() {
  const supabase = await createClient();
  const [ministerios, agregado] = await Promise.all([
    listarMinisterios(supabase),
    obtenerAgregadoPresupuestoGente(supabase),
  ]);

  const porMinisterio = new Map<number, { afiliados?: number; publico?: number }>();
  for (const fila of agregado) {
    const actual = porMinisterio.get(fila.ministry_id) ?? {};
    if (fila.is_member) actual.afiliados = fila.median_value;
    else actual.publico = fila.median_value;
    porMinisterio.set(fila.ministry_id, actual);
  }

  return (
    <Contenedor as="section" className="py-14">
      <header className="mx-auto max-w-[760px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Tú decides</span>
        <h1 className="mt-3 text-[clamp(28px,4vw,42px)] font-extrabold leading-[1.12]">
          Simulador del presupuesto
        </h1>
        <p className="mx-auto mt-3 max-w-[62ch] text-[15.5px] text-cuerpo">
          Parte del Presupuesto General del Estado real y reparte tú el gasto entre ministerios.
          Verás la desviación en vivo respecto al PGE y qué paga cada partida.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-[760px]">
        {ministerios.length === 0 ? (
          <p className="text-center text-[14.5px] text-gris">
            Todavía no hay datos del PGE cargados para simular.
          </p>
        ) : (
          <SimuladorPresupuesto ministerios={ministerios} />
        )}
      </div>

      {porMinisterio.size > 0 && (
        <section className="mx-auto mt-16 max-w-[760px]">
          <h2 className="text-[20px] font-extrabold text-titular">El Presupuesto de la Gente</h2>
          <p className="mt-1.5 text-[13.5px] text-gris">
            Mediana agregada de todos los escenarios guardados, separando afiliados de público
            general.
          </p>
          <div className="mt-5 overflow-x-auto rounded-tarjeta border border-linea">
            <table className="w-full min-w-[480px] text-left text-[13.5px]">
              <thead className="bg-fondo text-[12px] uppercase tracking-[.04em] text-gris">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Ministerio</th>
                  <th className="px-4 py-2.5 font-bold">Mediana afiliados</th>
                  <th className="px-4 py-2.5 font-bold">Mediana público</th>
                </tr>
              </thead>
              <tbody>
                {ministerios.map((m) => {
                  const fila = porMinisterio.get(m.id);
                  return (
                    <tr key={m.id} className="border-t border-linea">
                      <td className="px-4 py-2.5 font-semibold text-titular">{m.name}</td>
                      <td className="px-4 py-2.5">{fila?.afiliados !== undefined ? euros(fila.afiliados) : '—'}</td>
                      <td className="px-4 py-2.5">{fila?.publico !== undefined ? euros(fila.publico) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Contenedor>
  );
}
