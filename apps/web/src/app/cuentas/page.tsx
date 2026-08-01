import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Cuentas al céntimo',
  descripcion:
    'Transparencia financiera total de Razón Común: ingresos por cuotas y cada gasto del partido, con saldo real. Porque predicamos con el ejemplo.',
  ruta: '/cuentas',
});

export const revalidate = 3600; // datos alimentados por n8n (finanzas-sync) varias veces al día

function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

const CATEGORIA_LABEL: Record<string, string> = {
  infraestructura: 'Infraestructura',
  herramientas: 'Herramientas',
  comisiones: 'Comisiones',
  difusion: 'Difusión',
  otros: 'Otros',
};

export default async function CuentasPage() {
  const supabase = await createClient();

  const [{ data: snapshot }, { data: gastos }] = await Promise.all([
    supabase
      .from('finance_snapshots')
      .select('taken_at, balance_cents, income_month_cents, members_count')
      .order('taken_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('finance_expenses').select('dated, concept, amount_cents, category').order('dated', { ascending: false }),
  ]);

  // Libro bancario publicado (T4). Vista `finance_movements_public` (0035): sin
  // contraparte, solo las filas que tesorería ha aprobado una a una. `edited_at`
  // permite marcar las líneas corregidas — si se anonimiza a un particular, el
  // ciudadano ve que esa línea se tocó en vez de que desaparezca sin más.
  const { data: movimientos } = await supabase
    .from('finance_movements_public')
    .select('id, dated, description, amount_cents, direction, category, edited_at')
    .order('dated', { ascending: false })
    .limit(200);

  const totalGastosMes = (gastos ?? []).reduce((acc, g) => acc + g.amount_cents, 0);
  const proximoHito = snapshot ? Math.ceil(((snapshot.members_count ?? 0) + 1) / 100) * 100 : 100;

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[880px] space-y-10">
        <header className="text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Transparencia</span>
          <h1 className="mt-2 text-[clamp(30px,5vw,44px)] font-extrabold">Nuestras cuentas, al céntimo</h1>
          <p className="mx-auto mt-3 max-w-[560px] text-[15px] text-cuerpo">
            Somos el primer partido español que enseña sus cuentas en abierto, actualizadas varias
            veces al día. Ningún gasto oculto, ninguna donación opaca: solo cuotas de afiliados.
          </p>
          {snapshot && (
            <p className="mt-2 text-[12px] text-gris">
              Última actualización:{' '}
              {new Date(snapshot.taken_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          )}
        </header>

        {!snapshot ? (
          <Tarjeta className="p-8 text-center text-[14px] text-cuerpo">
            Aún no hay datos financieros publicados — el primer volcado del workflow n8n
            «finanzas-sync» aparecerá aquí.
          </Tarjeta>
        ) : (
          <>
            {/* MÉTRICAS PRINCIPALES */}
            <section className="grid gap-4 sm:grid-cols-3">
              <Tarjeta className="p-6 text-center">
                <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Saldo actual (Wise)</p>
                <p className="mt-2 text-[30px] font-extrabold text-titular">{euros(snapshot.balance_cents)}</p>
              </Tarjeta>
              <Tarjeta className="p-6 text-center">
                <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Ingresos del mes</p>
                <p className="mt-2 text-[30px] font-extrabold text-titular">{euros(snapshot.income_month_cents)}</p>
                <p className="mt-1 text-[12px] text-gris">{snapshot.members_count} afiliados de cuota activos</p>
              </Tarjeta>
              <Tarjeta className="p-6 text-center">
                <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Gastos del mes</p>
                <p className="mt-2 text-[30px] font-extrabold text-titular">{euros(totalGastosMes)}</p>
                <p className="mt-1 text-[12px] text-gris">Presupuesto operativo: 0-30 €/mes</p>
              </Tarjeta>
            </section>

            {/* TERMÓMETRO DE OBJETIVOS */}
            <Tarjeta className="p-6">
              <p className="text-[13px] font-bold text-titular">
                Con {proximoHito - (snapshot.members_count ?? 0)} afiliados más → campaña de difusión provincial
              </p>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-fondo">
                <div
                  className="h-full rounded-full bg-grad"
                  style={{ width: `${Math.min(100, ((snapshot.members_count ?? 0) / proximoHito) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] text-gris">
                {snapshot.members_count} / {proximoHito} afiliados
              </p>
            </Tarjeta>

            {/* GASTOS LÍNEA A LÍNEA */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[18px] font-extrabold text-titular">Cada gasto, línea a línea</h2>
                <a
                  href="/api/cuentas/export.csv"
                  className="text-[13px] font-semibold text-titular underline"
                >
                  Descargar histórico (CSV)
                </a>
              </div>
              <Tarjeta className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13.5px]">
                  <thead>
                    <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Concepto</th>
                      <th className="px-4 py-3">Categoría</th>
                      <th className="px-4 py-3 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(gastos ?? []).map((g, i) => (
                      <tr key={i} className="border-b border-linea last:border-0">
                        <td className="px-4 py-3 text-cuerpo">
                          {new Date(g.dated).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-titular">{g.concept}</td>
                        <td className="px-4 py-3 text-cuerpo">{CATEGORIA_LABEL[g.category] ?? g.category}</td>
                        <td className="px-4 py-3 text-right text-cuerpo">{euros(g.amount_cents)}</td>
                      </tr>
                    ))}
                    {(gastos ?? []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gris">
                          Sin gastos registrados todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Tarjeta>
            </section>

            {(movimientos ?? []).length > 0 && (
              <section>
                <h2 className="mb-1 text-[20px] font-extrabold text-titular">Movimientos bancarios</h2>
                <p className="mb-4 max-w-[640px] text-[13.5px] text-cuerpo">
                  Apuntes de la cuenta del partido, tal y como los da el banco. Un movimiento nunca
                  se elimina: si hace falta corregirlo o quitar el nombre de un particular, la línea
                  se marca como corregida y el importe y la fecha se conservan.
                </p>
                <Tarjeta className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[13.5px]">
                    <thead>
                      <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Concepto</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(movimientos ?? []).map((m) => (
                        <tr key={m.id} className="border-b border-linea last:border-0">
                          <td className="whitespace-nowrap px-4 py-3 text-cuerpo">
                            {new Date(m.dated).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-titular">{m.description}</span>
                            {m.edited_at && (
                              <span className="ml-2 rounded-full bg-fondo px-2 py-0.5 text-[11px] font-bold text-gris">
                                corregido
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-cuerpo">
                            {m.category ? CATEGORIA_LABEL[m.category] ?? m.category : '—'}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${m.direction === 'in' ? 'text-titular' : 'text-cuerpo'}`}
                          >
                            {m.direction === 'in' ? '+' : '−'}
                            {euros(m.amount_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Tarjeta>
              </section>
            )}

            <p className="text-center text-[12px] text-gris">
              Los ingresos se muestran agregados (número de cuotas), nunca con nombres de afiliados.
              Los gastos van línea a línea porque no contienen datos personales.
            </p>
          </>
        )}
      </div>
    </Contenedor>
  );
}
