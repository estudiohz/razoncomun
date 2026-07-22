import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { Input } from '@/components/ui/Input';
import { EliminarUsuarioBoton } from './EliminarUsuarioBoton';

const NOMBRE_NIVEL: Record<string, string> = {
  registered: 'Registrado',
  member: 'Afiliado',
  verified: 'Afiliado verificado',
};

const CARGOS = [
  { value: 'president', label: 'Presidente' },
  { value: 'treasurer', label: 'Tesorero' },
  { value: 'vocal', label: 'Vocal' },
  { value: 'council_member', label: 'Consejero' },
  { value: 'coordinator', label: 'Coordinador' },
  { value: 'moderator', label: 'Moderador' },
];

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ nivel?: string; provincia?: string; cargo?: string; q?: string }>;
}) {
  const { nivel, provincia, cargo, q } = await searchParams;
  const supabase = await createClient();

  // El layout ya exige admin O editor; eliminar usuarios es solo de admin —
  // el botón se oculta a editores (y la server action lo vuelve a exigir).
  const {
    data: { user: usuarioActual },
  } = await supabase.auth.getUser();

  const [{ data: provincias }, { data: cargosVigentes }, { data: esAdmin }] = await Promise.all([
    supabase.from('territories').select('id, name').eq('type', 'province').order('name'),
    supabase.from('positions').select('user_id, role, scope, territory_id').is('ended_at', null),
    supabase.rpc('is_admin', { p_user: usuarioActual?.id }),
  ]);

  let query = supabase
    .from('profiles')
    .select('id, email, display_name, level, origin_province_id, member_since, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (nivel) query = query.eq('level', nivel);
  if (provincia) query = query.eq('origin_province_id', Number(provincia));
  if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: perfiles, error } = await query;

  const provinciaPorId = new Map((provincias ?? []).map((p) => [p.id, p.name]));
  const cargosPorUsuario = new Map<string, string[]>();
  for (const c of cargosVigentes ?? []) {
    const lista = cargosPorUsuario.get(c.user_id) ?? [];
    lista.push(c.role);
    cargosPorUsuario.set(c.user_id, lista);
  }

  const perfilesFiltrados = cargo
    ? (perfiles ?? []).filter((p) => cargosPorUsuario.get(p.id)?.includes(cargo))
    : perfiles ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold">Usuarios</h1>
          <p className="mt-1 text-[13.5px] text-gris">
            Los tres ejes: nivel de cuenta, cargo orgánico y afiliación (ver ficha de cada usuario).
          </p>
        </div>
        <Link
          href="/admin/usuarios/nuevo"
          className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white shadow-boton"
        >
          + Añadir usuario
        </Link>
      </div>

      <Tarjeta className="p-4">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-[12px] font-bold text-gris">Buscar</label>
            <Input name="q" defaultValue={q ?? ''} placeholder="Nombre o email" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Nivel</label>
            <select name="nivel" defaultValue={nivel ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]">
              <option value="">Todos</option>
              <option value="registered">Registrado</option>
              <option value="member">Afiliado</option>
              <option value="verified">Afiliado verificado</option>
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
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Cargo</label>
            <select name="cargo" defaultValue={cargo ?? ''} className="rounded-boton border border-linea px-3 py-3 text-[14px]">
              <option value="">Todos</option>
              {CARGOS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white"
          >
            Filtrar
          </button>
          {(nivel || provincia || cargo || q) && (
            <Link href="/admin/usuarios" className="text-[13px] text-gris underline">
              Limpiar
            </Link>
          )}
        </form>
      </Tarjeta>

      {error && <p className="text-[13px] text-red-600">Error al cargar usuarios: {error.message}</p>}

      <Tarjeta className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Nivel</th>
              <th className="px-4 py-3">Provincia</th>
              <th className="px-4 py-3">Cargo vigente</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {perfilesFiltrados.map((p) => (
              <tr key={p.id} className="border-b border-linea last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{p.display_name ?? '—'}</p>
                  <p className="text-[12px] text-gris">{p.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-fondo px-2.5 py-1 text-[12px] font-bold text-titular">
                    {NOMBRE_NIVEL[p.level] ?? p.level}
                  </span>
                </td>
                <td className="px-4 py-3 text-cuerpo">
                  {p.origin_province_id ? provinciaPorId.get(p.origin_province_id) ?? '—' : '—'}
                </td>
                <td className="px-4 py-3 text-cuerpo">
                  {(cargosPorUsuario.get(p.id) ?? []).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/usuarios/${p.id}`} className="font-semibold text-titular no-underline hover:underline">
                      Ver ficha →
                    </Link>
                    {Boolean(esAdmin) && p.id !== usuarioActual?.id && (
                      <EliminarUsuarioBoton
                        userId={p.id}
                        nombre={p.display_name ?? '—'}
                        email={p.email ?? '—'}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {perfilesFiltrados.length === 0 && (
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
