import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { asignarRolApp, revocarRolApp, cambiarNivelManual } from '../actions';
import { SuscripcionStripe } from './SuscripcionStripe';
import { formatearNumeroAfiliado } from '@/lib/afiliacion/numero';

const NOMBRE_NIVEL: Record<string, string> = {
  registered: 'Registrado',
  member: 'Socio',
  verified: 'Socio verificado',
};

const NOMBRE_CARGO: Record<string, string> = {
  president: 'Presidente',
  treasurer: 'Tesorero',
  vocal: 'Vocal',
  council_member: 'Consejero',
  coordinator: 'Coordinador',
  moderator: 'Moderador',
};

export default async function FichaUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: perfil }, { data: miembros }, { data: cargos }, { data: rolesAsignados }, { data: catalogoRoles }, { data: territorio }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('members').select('*').eq('user_id', id).order('started_at', { ascending: false }),
      supabase.from('positions').select('*').eq('user_id', id).order('started_at', { ascending: false }),
      supabase.from('user_app_roles').select('role_id, app_roles(key, label)').eq('user_id', id),
      supabase.from('app_roles').select('id, key, label'),
      supabase.from('territories').select('id, name, parent_id'),
    ]);

  if (!perfil) notFound();

  const territorioPorId = new Map((territorio ?? []).map((t) => [t.id, t]));
  const provinciaNombre = perfil.origin_province_id
    ? territorioPorId.get(perfil.origin_province_id)?.name ?? '—'
    : '—';

  const clavesAsignadas = new Set(
    (rolesAsignados ?? []).map((r) =>
      Array.isArray(r.app_roles) ? r.app_roles[0]?.key : (r.app_roles as { key: string } | null)?.key,
    ),
  );
  const rolesDisponibles = (catalogoRoles ?? []).filter((r) => !clavesAsignadas.has(r.key));

  // La condición de socio vigente es la fila más reciente que NO sea una baja: incluye
  // 'paused' y 'past_due', que siguen siendo relaciones vivas con el partido y
  // sobre las que tiene sentido actuar (reanudar, reclamar el recibo).
  const afiliacionVigente = (miembros ?? []).find((m) => m.status !== 'canceled');
  const cargosVigentes = (cargos ?? []).filter((c) => !c.ended_at);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/usuarios" className="text-[13px] text-gris no-underline hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-[24px] font-extrabold">{perfil.display_name ?? perfil.email}</h1>
        <p className="text-[13.5px] text-gris">{perfil.email}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* EJE 1: Nivel de cuenta */}
        <Tarjeta className="p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Nivel de cuenta</h2>
          <p className="mt-2 text-[20px] font-extrabold">{NOMBRE_NIVEL[perfil.level] ?? perfil.level}</p>
          <p className="mt-1 text-[12.5px] text-gris">Provincia de origen: {provinciaNombre}</p>
          {perfil.member_since && (
            <p className="text-[12.5px] text-gris">
              Socio desde {new Date(perfil.member_since).toLocaleDateString('es-ES')}
            </p>
          )}
          {perfil.identity_verified_at && (
            <p className="text-[12.5px] text-gris">
              Identidad verificada el {new Date(perfil.identity_verified_at).toLocaleDateString('es-ES')}
            </p>
          )}

          <form action={cambiarNivelManual} className="mt-4 space-y-2 border-t border-linea pt-4">
            <input type="hidden" name="userId" value={id} />
            <label className="block text-[12px] font-bold text-gris">Cambiar nivel manualmente</label>
            <select name="nivel" defaultValue={perfil.level} className="w-full rounded-boton border border-linea px-3 py-2 text-[13.5px]">
              <option value="registered">Registrado</option>
              <option value="member">Socio</option>
              <option value="verified">Socio verificado</option>
            </select>
            <textarea
              name="motivo"
              required
              placeholder="Motivo del cambio (obligatorio, queda en auditoría)"
              className="w-full rounded-boton border border-linea px-3 py-2 text-[13px]"
              rows={2}
            />
            <button type="submit" className="w-full rounded-boton bg-accion px-4 py-2 text-[13px] font-bold text-white">
              Aplicar cambio de nivel
            </button>
          </form>
        </Tarjeta>

        {/* EJE 2: Cargo orgánico */}
        <Tarjeta className="p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Cargo orgánico</h2>
          {cargosVigentes.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {cargosVigentes.map((c) => (
                <li key={c.id} className="text-[13.5px]">
                  <span className="font-bold">{NOMBRE_CARGO[c.role] ?? c.role}</span>{' '}
                  <span className="text-gris">
                    ({c.scope === 'national' ? 'nacional' : territorioPorId.get(c.territory_id!)?.name ?? 'comunidad'})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-gris">Sin cargo vigente.</p>
          )}
          <p className="mt-3 text-[12px] text-gris">
            Asignar o cesar cargos se hace desde{' '}
            <Link href="/admin/organizacion" className="font-semibold text-titular no-underline hover:underline">
              Cargos y territorio
            </Link>
            .
          </p>
          {cargos && cargos.length > cargosVigentes.length && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[12px] font-semibold text-gris">
                Histórico ({cargos.length - cargosVigentes.length} cargo/s finalizado/s)
              </summary>
              <ul className="mt-2 space-y-1 text-[12px] text-gris">
                {cargos
                  .filter((c) => c.ended_at)
                  .map((c) => (
                    <li key={c.id}>
                      {NOMBRE_CARGO[c.role] ?? c.role}: {new Date(c.started_at).toLocaleDateString('es-ES')} →{' '}
                      {new Date(c.ended_at!).toLocaleDateString('es-ES')}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </Tarjeta>

        {/* EJE 3: Socio */}
        <Tarjeta className="p-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Socio</h2>
          {perfil.member_number ? (
            <p className="mt-2 text-[13.5px]">
              <span className="text-gris">Nº de socio: </span>
              <span className="font-bold tabular-nums text-titular">
                {formatearNumeroAfiliado(perfil.member_number)}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-[12.5px] text-gris">
              Sin número de socio: se asigna con el primer cobro.
            </p>
          )}

          {afiliacionVigente ? (
            <div className="mt-2 text-[13.5px]">
              <p className="font-bold text-titular">
                {afiliacionVigente.status === 'paused'
                  ? 'Cuota pausada'
                  : afiliacionVigente.status === 'past_due'
                    ? 'Cuota impagada'
                    : 'Cuota activa'}
              </p>
              <p className="text-gris">
                {afiliacionVigente.billing_period === 'annual' ? 'Anual' : 'Mensual'} ·{' '}
                {((afiliacionVigente.amount_cents ?? 0) / 100).toFixed(2)}€
              </p>
              {afiliacionVigente.started_at && (
                <p className="text-gris">
                  Desde {new Date(afiliacionVigente.started_at).toLocaleDateString('es-ES')}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-gris">No es socio.</p>
          )}
          <p className="mt-2 text-[12px] text-gris">
            Newsletter: {perfil.newsletter_opt_in ? 'suscrito' : 'no suscrito'}
          </p>

          <div className="mt-4 border-t border-linea pt-4">
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gris">
              Suscripción en Stripe
            </h3>
            <SuscripcionStripe
              userId={id}
              estado={afiliacionVigente?.status ?? null}
              subscriptionId={afiliacionVigente?.stripe_subscription_id ?? null}
              customerId={afiliacionVigente?.stripe_customer_id ?? null}
            />
          </div>
        </Tarjeta>
      </div>

      {/* Roles funcionales de app */}
      <Tarjeta className="p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Rol funcional de la app</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(rolesAsignados ?? []).map((r) => {
            const rol = Array.isArray(r.app_roles) ? r.app_roles[0] : (r.app_roles as { key: string; label: string } | null);
            if (!rol) return null;
            return (
              <form key={rol.key} action={revocarRolApp} className="inline-flex items-center gap-2 rounded-full bg-fondo px-3 py-1.5">
                <input type="hidden" name="userId" value={id} />
                <input type="hidden" name="roleKey" value={rol.key} />
                <span className="text-[13px] font-bold">{rol.label}</span>
                <button type="submit" className="text-[11px] font-bold text-red-600 underline">
                  revocar
                </button>
              </form>
            );
          })}
          {(rolesAsignados ?? []).length === 0 && (
            <p className="text-[13px] text-gris">Sin roles de app asignados.</p>
          )}
        </div>

        {rolesDisponibles.length > 0 && (
          <form action={asignarRolApp} className="mt-4 flex items-end gap-3 border-t border-linea pt-4">
            <input type="hidden" name="userId" value={id} />
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Asignar rol</label>
              <select name="roleKey" className="rounded-boton border border-linea px-3 py-2 text-[13.5px]">
                {rolesDisponibles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-boton bg-accion px-4 py-2 text-[13px] font-bold text-white">
              Asignar
            </button>
          </form>
        )}
      </Tarjeta>
    </div>
  );
}
