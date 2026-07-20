import { requireAdmin } from '@/lib/admin/guard';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { Input } from '@/components/ui/Input';
import { Organigrama, NOMBRE_CARGO, type CargoOrganigrama } from '@/components/organigrama/Organigrama';
import { asignarCargo, cesarCargo } from './actions';

const CARGOS_NACIONALES = ['president', 'treasurer', 'vocal', 'council_member'];
const CARGOS_COMUNIDAD = ['coordinator', 'moderator'];

export default async function OrganizacionPage() {
  const { supabase } = await requireAdmin('/admin/organizacion');

  const [{ data: comunidades }, { data: cargosRaw }] = await Promise.all([
    supabase.from('territories').select('id, name').eq('type', 'community').order('name'),
    supabase
      .from('positions')
      .select('id, role, scope, territory_id, started_at, ended_at, user_id, profiles(display_name, email)')
      .order('started_at', { ascending: false }),
  ]);

  const territorioPorId = new Map((comunidades ?? []).map((t) => [t.id, t.name]));

  const cargos = (cargosRaw ?? []).map((c) => {
    const perfil = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      role: c.role,
      scope: c.scope as 'national' | 'community',
      territory_id: c.territory_id,
      started_at: c.started_at,
      ended_at: c.ended_at as string | null,
      display_name: perfil?.display_name ?? perfil?.email ?? null,
    };
  });

  const vigentes: CargoOrganigrama[] = cargos.filter((c) => !c.ended_at);
  const historicos = cargos.filter((c) => c.ended_at);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-extrabold">Cargos y territorio</h1>
        <p className="mt-1 text-[13.5px] text-gris">
          Organigrama vigente (nacional y por comunidad). Se expone también en público en{' '}
          <code>/transparencia/organigrama</code> — el organigrama es transparente por diseño
          (modelo-datos.md).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta className="p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Asignar cargo</h2>
          <form action={asignarCargo} className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Email del usuario</label>
              <Input name="email" type="email" required placeholder="persona@ejemplo.com" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Ámbito</label>
              <select name="ambito" required className="w-full rounded-boton border border-linea px-3 py-3 text-[14px]">
                <option value="national">Nacional</option>
                {(comunidades ?? []).map((t) => (
                  <option key={t.id} value={`community:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Cargo</label>
              <select name="role" required className="w-full rounded-boton border border-linea px-3 py-3 text-[14px]">
                <optgroup label="Nacional">
                  {CARGOS_NACIONALES.map((r) => (
                    <option key={r} value={r}>
                      {NOMBRE_CARGO[r]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Comunidad">
                  {CARGOS_COMUNIDAD.map((r) => (
                    <option key={r} value={r}>
                      {NOMBRE_CARGO[r]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <p className="text-[11.5px] text-gris">
              El cargo debe casar con el ámbito elegido arriba (nacional → presidente/tesorero/vocal/
              consejero; comunidad → coordinador/moderador). Si no casan, la acción del servidor lo
              rechaza antes de tocar la base de datos (el CHECK de la tabla no cubre esta combinación).
            </p>
            <button type="submit" className="w-full rounded-boton bg-accion px-4 py-3 text-[14px] font-bold text-white">
              Asignar cargo
            </button>
          </form>
        </Tarjeta>

        <Tarjeta className="p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Cargos vigentes — cesar</h2>
          {vigentes.length > 0 ? (
            <ul className="mt-3 space-y-4">
              {vigentes.map((c) => (
                <li key={c.id} className="border-b border-linea pb-3 last:border-0">
                  <p className="text-[13.5px]">
                    <span className="font-bold">{NOMBRE_CARGO[c.role] ?? c.role}</span> ·{' '}
                    {c.display_name ?? 'Sin nombre'} ·{' '}
                    <span className="text-gris">
                      {c.scope === 'national' ? 'nacional' : territorioPorId.get(c.territory_id!) ?? 'comunidad'}
                    </span>
                  </p>
                  <form action={cesarCargo} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="positionId" value={c.id} />
                    <input
                      name="motivo"
                      required
                      placeholder="Motivo del cese (obligatorio, queda en auditoría)"
                      className="min-w-[220px] flex-1 rounded-boton border border-linea px-3 py-2 text-[12.5px]"
                    />
                    <button type="submit" className="rounded-boton border border-red-300 px-3 py-2 text-[12.5px] font-bold text-red-600">
                      Cesar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-gris">Sin cargos vigentes.</p>
          )}
        </Tarjeta>
      </div>

      <Organigrama cargos={vigentes} territorioPorId={territorioPorId} />

      {historicos.length > 0 && (
        <Tarjeta className="p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Histórico de cargos cesados</h2>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-gris">
            {historicos.map((c) => (
              <li key={c.id}>
                {NOMBRE_CARGO[c.role] ?? c.role} · {c.display_name ?? 'Sin nombre'} ·{' '}
                {new Date(c.started_at).toLocaleDateString('es-ES')} →{' '}
                {new Date(c.ended_at!).toLocaleDateString('es-ES')}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta className="p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Territorio</h2>
        <p className="mt-1 text-[12.5px] text-gris">
          Las 19 comunidades/ciudades autónomas y sus provincias vienen sembradas por rc-02-datos
          (división territorial fija de España) — no hay alta/baja de territorios desde aquí, solo
          se usan como ámbito al asignar cargos de comunidad.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(comunidades ?? []).map((t) => (
            <span key={t.id} className="rounded-full bg-fondo px-3 py-1 text-[12px] font-semibold text-cuerpo">
              {t.name}
            </span>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}
