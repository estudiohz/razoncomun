import Link from 'next/link';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { requireFinanzas } from '@/lib/afiliacion/acceso';

const ESTADO_LABEL: Record<string, string> = {
  active: 'Activo',
  past_due: 'Impago',
  canceled: 'Baja',
};

const PERIODO_LABEL: Record<string, string> = {
  monthly: 'Mensual',
  annual: 'Anual',
};

function euros(cents: number | null): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

/**
 * Listado de afiliados (rc-07). Panel SOLO LECTURA de Stripe (docs/tecnico/
 * afiliados-y-transparencia.md): las operaciones de cobro/reembolso/cambio
 * de método de pago viven en el Customer Portal de Stripe, no aquí — este
 * panel espeja `members` (sincronizado por el webhook) para buscar,
 * filtrar y exportar, nunca para escribir hacia Stripe.
 */
export default async function AfiliadosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; provincia?: string; periodo?: string; q?: string }>;
}) {
  const { estado, provincia, periodo, q } = await searchParams;
  const { supabase } = await requireFinanzas();

  const { data: provincias } = await supabase
    .from('territories')
    .select('id, name')
    .eq('type', 'province')
    .order('name');

  let query = supabase
    .from('members')
    .select(
      'id, user_id, status, billing_period, amount_cents, payment_method, sepa_mandate_id, started_at, canceled_at, profiles(display_name, email, origin_province_id)',
    )
    .order('started_at', { ascending: false })
    .limit(300);

  if (estado) query = query.eq('status', estado);
  if (periodo) query = query.eq('billing_period', periodo);
  if (provincia) query = query.eq('profiles.origin_province_id', Number(provincia));

  const { data: miembros, error } = await query;

  const provinciaPorId = new Map((provincias ?? []).map((p) => [p.id, p.name]));

  const filaQ = q?.toLowerCase().trim();
  const filas = (miembros ?? []).filter((m) => {
    if (!filaQ) return true;
    const perfil = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return (
      perfil?.display_name?.toLowerCase().includes(filaQ) || perfil?.email?.toLowerCase().includes(filaQ)
    );
  });

  const activos = filas.filter((m) => m.status === 'active').length;
  const impagos = filas.filter((m) => m.status === 'past_due').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold">Afiliados</h1>
          <p className="mt-1 text-[13.5px] text-gris">
            {activos} activos · {impagos} en impago · {filas.length} en el listado. Espejo de Stripe —
            los cobros y cambios de método de pago se gestionan en Stripe, no aquí.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/admin/afiliados/export.csv"
            className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular hover:border-titular"
          >
            Exportar CSV
          </a>
          <a
            href="/api/admin/afiliados/modelo182.csv"
            className="rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white shadow-boton hover:-translate-y-0.5"
          >
            Export Modelo 182
          </a>
        </div>
      </div>

      <Tarjeta className="p-4">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-[12px] font-bold text-gris">Buscar</label>
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Nombre o email"
              className="w-full rounded-boton border border-linea px-3 py-3 text-[14px]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Estado</label>
            <select name="estado" defaultValue={estado ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]">
              <option value="">Todos</option>
              <option value="active">Activo</option>
              <option value="past_due">Impago</option>
              <option value="canceled">Baja</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Periodo</label>
            <select name="periodo" defaultValue={periodo ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]">
              <option value="">Todos</option>
              <option value="monthly">Mensual</option>
              <option value="annual">Anual</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Provincia</label>
            <select name="provincia" defaultValue={provincia ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]">
              <option value="">Todas</option>
              {(provincias ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white">
            Filtrar
          </button>
          {(estado || provincia || periodo || q) && (
            <Link href="/admin/afiliados" className="text-[13px] text-gris underline">
              Limpiar
            </Link>
          )}
        </form>
      </Tarjeta>

      {error && <p className="text-[13px] text-red-600">Error al cargar afiliados: {error.message}</p>}

      <Tarjeta className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
              <th className="px-4 py-3">Afiliado</th>
              <th className="px-4 py-3">Provincia</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3">Cuota</th>
              <th className="px-4 py-3">Mandato SEPA</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => {
              const perfil = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              return (
                <tr key={m.id} className="border-b border-linea last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{perfil?.display_name ?? '—'}</p>
                    <p className="text-[12px] text-gris">{perfil?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-cuerpo">
                    {perfil?.origin_province_id ? provinciaPorId.get(perfil.origin_province_id) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${
                        m.status === 'active'
                          ? 'bg-fondo text-titular'
                          : m.status === 'past_due'
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {ESTADO_LABEL[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cuerpo">{PERIODO_LABEL[m.billing_period ?? ''] ?? '—'}</td>
                  <td className="px-4 py-3 text-cuerpo">{euros(m.amount_cents)}</td>
                  <td className="px-4 py-3 text-cuerpo">
                    {m.sepa_mandate_id ? (
                      <span title={m.sepa_mandate_id}>✅</span>
                    ) : (
                      <span className="text-red-500" title="Sin mandato registrado todavía">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-cuerpo">
                    {m.started_at
                      ? new Date(m.started_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/afiliados/${m.id}`} className="font-semibold text-titular no-underline hover:underline">
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gris">
                  Sin resultados para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
