import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { Input } from '@/components/ui/Input';

/**
 * Lectura del `audit_log` (I6, revision-seguridad.md) con filtros. Tabla
 * compartida por TODOS los agentes (blog, participación, afiliación...) —
 * por eso los filtros de entidad/acción son dinámicos (se listan los
 * valores que de verdad existen) en vez de una lista fija solo con las
 * acciones que escribe este panel.
 */
export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; q?: string; desde?: string; hasta?: string }>;
}) {
  const { entity, action, q, desde, hasta } = await searchParams;
  const { supabase } = await requireAdmin('/admin/actividad');

  const [{ data: entidades }, { data: acciones }] = await Promise.all([
    supabase.from('audit_log').select('entity').limit(5000),
    supabase.from('audit_log').select('action').limit(5000),
  ]);
  const entidadesUnicas = Array.from(new Set((entidades ?? []).map((r) => r.entity))).sort();
  const accionesUnicas = Array.from(new Set((acciones ?? []).map((r) => r.action))).sort();

  let query = supabase
    .from('audit_log')
    .select('id, actor_id, action, entity, entity_id, meta, created_at, profiles(display_name, email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (entity) query = query.eq('entity', entity);
  if (action) query = query.eq('action', action);
  if (desde) query = query.gte('created_at', desde);
  if (hasta) query = query.lte('created_at', hasta);

  const { data: filas, error } = await query;

  const filasFiltradasPorQ = q
    ? (filas ?? []).filter((f) => {
        const perfil = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
        const texto = `${perfil?.display_name ?? ''} ${perfil?.email ?? ''}`.toLowerCase();
        return texto.includes(q.toLowerCase());
      })
    : filas ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-extrabold">Actividad</h1>
        <p className="mt-1 text-[13.5px] text-gris">
          Registro append-only de todo lo escrito desde el panel (y desde los webhooks de otros
          módulos). No se puede editar ni borrar ninguna fila, ni siquiera con el rol de servicio.
        </p>
      </div>

      <Tarjeta className="p-4">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-[12px] font-bold text-gris">Buscar actor</label>
            <Input name="q" defaultValue={q ?? ''} placeholder="Nombre o email" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Entidad</label>
            <select name="entity" defaultValue={entity ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]">
              <option value="">Todas</option>
              {entidadesUnicas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Acción</label>
            <select name="action" defaultValue={action ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]">
              <option value="">Todas</option>
              {accionesUnicas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Desde</label>
            <input type="date" name="desde" defaultValue={desde ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Hasta</label>
            <input type="date" name="hasta" defaultValue={hasta ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]" />
          </div>
          <button type="submit" className="rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white">
            Filtrar
          </button>
          {(entity || action || q || desde || hasta) && (
            <Link href="/admin/actividad" className="text-[13px] text-gris underline">
              Limpiar
            </Link>
          )}
        </form>
      </Tarjeta>

      {error && <p className="text-[13px] text-red-600">Error al cargar auditoría: {error.message}</p>}

      <Tarjeta className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Entidad</th>
              <th className="px-4 py-3">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradasPorQ.map((f) => {
              const perfil = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
              return (
                <tr key={f.id} className="border-b border-linea align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-gris">
                    {new Date(f.created_at).toLocaleString('es-ES')}
                  </td>
                  <td className="px-4 py-3">
                    {perfil ? (perfil.display_name ?? perfil.email) : f.actor_id ? f.actor_id : 'sistema'}
                  </td>
                  <td className="px-4 py-3 font-semibold">{f.action}</td>
                  <td className="px-4 py-3 text-cuerpo">
                    {f.entity}
                    {f.entity_id ? ` · ${String(f.entity_id).slice(0, 8)}…` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <pre className="max-w-[360px] overflow-x-auto whitespace-pre-wrap text-[11.5px] text-gris">
                      {f.meta ? JSON.stringify(f.meta) : '—'}
                    </pre>
                  </td>
                </tr>
              );
            })}
            {filasFiltradasPorQ.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gris">
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
