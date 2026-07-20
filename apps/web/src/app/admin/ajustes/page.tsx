import { requireAdmin } from '@/lib/admin/guard';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { Input } from '@/components/ui/Input';
import { listarCredencialesIA, PROVEEDOR_LABEL, PROVEEDORES_IA } from '@/lib/admin/ia';
import { nombresPorId } from '@/lib/admin/perfiles';
import { activarProveedorIA, revertirProveedorIA, actualizarAntiguedadMinima } from './actions';

const DIAS_OPCIONES = [0, 1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365];

/**
 * `/admin/ajustes` — dos apartados independientes que comparten pantalla
 * por ser ambos "parámetros globales de sistema" con el mismo nivel de
 * exigencia (solo admin, con 2FA, motivo obligatorio, todo a `audit_log`):
 *
 * 1. Proveedor de IA activo (D-016) — gestión de las API keys que usa
 *    RC-Brain. La clave completa NUNCA llega a este componente.
 * 2. Antigüedad mínima de afiliación para voto vinculante (D-017/D-018) —
 *    valor por defecto para votaciones NUEVAS; las ya creadas quedan
 *    seladas y no se ven afectadas por ningún cambio de aquí en adelante.
 *
 * SOLO admin (no basta editor) — `requireAdmin` ya exige el rol; el
 * middleware global exige aal2 antes de dejar renderizar nada aquí.
 */
export default async function AjustesPage() {
  const { supabase } = await requireAdmin('/admin/ajustes');

  const credenciales = await listarCredencialesIA();

  const { data: ajusteAntiguedad } = await supabase
    .from('settings')
    .select('value, updated_by, updated_at')
    .eq('key', 'min_membership_days')
    .maybeSingle();
  const diasActuales = typeof ajusteAntiguedad?.value === 'number' ? ajusteAntiguedad.value : 7;
  const opcionesDias = DIAS_OPCIONES.includes(diasActuales)
    ? DIAS_OPCIONES
    : [...DIAS_OPCIONES, diasActuales].sort((a, b) => a - b);

  const nombres = await nombresPorId([...credenciales.map((c) => c.changed_by), ajusteAntiguedad?.updated_by ?? null]);

  const activa = credenciales.find((c) => c.active) ?? null;
  const historico = credenciales.filter((c) => c.id !== activa?.id);

  const { data: evalsRaw } = await supabase
    .from('ai_evals')
    .select('id, run_at, prompt_version, test_case, passed, notes')
    .order('run_at', { ascending: false })
    .limit(50);

  const ultimaVersion = evalsRaw?.[0]?.prompt_version ?? null;
  const ultimaTanda = ultimaVersion ? (evalsRaw ?? []).filter((e) => e.prompt_version === ultimaVersion) : [];
  const totalTanda = ultimaTanda.length;
  const aprobadosTanda = ultimaTanda.filter((e) => e.passed).length;
  const tasaTanda = totalTanda > 0 ? Math.round((aprobadosTanda / totalTanda) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-extrabold">Ajustes</h1>
        <p className="mt-1 text-[13.5px] text-gris">
          Parámetros globales del sistema: proveedor de IA de RC-Brain y reglas de participación.
        </p>
      </div>

      <h2 className="text-[15px] font-extrabold text-titular">IA</h2>

      <Tarjeta className="border-amber-300 bg-amber-50 p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-amber-800">
          Antes de cambiar de proveedor
        </h3>
        <p className="mt-2 text-[13.5px] text-amber-900">
          Al activar un proveedor distinto se ejecuta automáticamente la <strong>suite de
          neutralidad</strong> (comparativa de sesgo sobre el corpus, tabla <code>ai_evals</code>).
          Si el resultado cae <strong>por debajo del 95% de aprobados</strong>, el sistema{' '}
          <strong>revierte automáticamente</strong> al proveedor anterior — no hace falta volver a
          introducir su clave, ya queda guardada cifrada. La clave que escribas aquí no se vuelve a
          mostrar en ningún sitio tras guardarla: solo verás sus 4 últimos caracteres.
        </p>
      </Tarjeta>

      <Tarjeta className="p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-titular">Proveedor activo</h3>
        {activa ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accion px-3 py-1 text-[12px] font-bold text-white">
                Activo
              </span>
              <span className="text-[15px] font-bold text-titular">{PROVEEDOR_LABEL[activa.provider]}</span>
              <span className="text-[13.5px] text-cuerpo">· {activa.model}</span>
              <span className="rounded bg-fondo px-2 py-0.5 text-[12px] font-mono text-gris">
                •••• {activa.key_suffix}
              </span>
            </div>
            <p className="text-[12.5px] text-gris">
              Cambiado por {activa.changed_by ? nombres.get(activa.changed_by) ?? activa.changed_by : 'sistema'}{' '}
              el {new Date(activa.changed_at).toLocaleString('es-ES')}
            </p>

            {activa.previous_credential_id ? (
              <form action={revertirProveedorIA} className="flex flex-wrap items-end gap-2 border-t border-linea pt-3">
                <div className="min-w-[260px] flex-1">
                  <label className="mb-1 block text-[12px] font-bold text-gris">
                    Motivo de la reversión (obligatorio, queda en auditoría)
                  </label>
                  <Input name="motivo" required placeholder="Ej. resultado de la suite por debajo del umbral" />
                </div>
                <button
                  type="submit"
                  className="rounded-boton border border-red-300 px-4 py-3 text-[13px] font-bold text-red-600"
                >
                  Revertir al proveedor anterior
                </button>
              </form>
            ) : (
              <p className="border-t border-linea pt-3 text-[12.5px] text-gris">
                Este proveedor no tiene uno anterior registrado — no hay nada a lo que revertir.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-gris">
            No hay ningún proveedor activo todavía. Activa uno con el formulario de abajo.
          </p>
        )}
      </Tarjeta>

      <Tarjeta className="p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-titular">Activar proveedor</h3>
        <form action={activarProveedorIA} className="mt-3 space-y-3" autoComplete="off">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Proveedor</label>
              <select
                name="provider"
                required
                defaultValue=""
                className="w-full rounded-boton border border-linea px-3 py-3 text-[14px]"
              >
                <option value="" disabled>
                  Elige un proveedor
                </option>
                {PROVEEDORES_IA.map((p) => (
                  <option key={p} value={p}>
                    {PROVEEDOR_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Modelo</label>
              <Input name="model" required placeholder="ej. claude-opus-4-6, gpt-5, gemini-2.5-pro" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Clave de API</label>
            <Input
              name="apiKey"
              type="password"
              required
              autoComplete="new-password"
              placeholder="La clave completa no se vuelve a mostrar tras guardarla"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">
              Motivo del cambio (obligatorio, queda en auditoría)
            </label>
            <Input name="motivo" required placeholder="Ej. mejor rendimiento en la suite de neutralidad" />
          </div>
          <label className="flex items-start gap-2 text-[12.5px] text-cuerpo">
            <input name="avisoLeido" type="checkbox" required className="mt-0.5" />
            <span>
              He leído el aviso: sé que se ejecutará la suite de neutralidad y que se revertirá
              automáticamente si el resultado cae por debajo del 95%.
            </span>
          </label>
          <button type="submit" className="w-full rounded-boton bg-accion px-4 py-3 text-[14px] font-bold text-white">
            Activar proveedor
          </button>
        </form>
      </Tarjeta>

      <Tarjeta className="p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-titular">
          Resultado de la última suite de neutralidad
        </h3>
        {ultimaVersion ? (
          <div className="mt-3 space-y-2">
            <p className="text-[13.5px]">
              Versión <span className="font-mono">{ultimaVersion}</span> ·{' '}
              <span
                className={
                  tasaTanda !== null && tasaTanda >= 95
                    ? 'font-bold text-accion'
                    : 'font-bold text-red-600'
                }
              >
                {aprobadosTanda}/{totalTanda} aprobados ({tasaTanda}%)
              </span>{' '}
              — {tasaTanda !== null && tasaTanda >= 95 ? 'por encima del umbral del 95%.' : 'por debajo del umbral del 95%: debería haberse revertido automáticamente.'}
            </p>
            <ul className="max-h-56 space-y-1 overflow-y-auto text-[12.5px] text-gris">
              {ultimaTanda.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className={e.passed ? 'text-accion' : 'text-red-600'}>{e.passed ? '✓' : '✗'}</span>
                  <span>{e.test_case}</span>
                  {e.notes ? <span className="text-gris">· {e.notes}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-gris">
            Sin ejecuciones registradas todavía en <code>ai_evals</code>. Se ejecutará automáticamente la
            próxima vez que se active un proveedor distinto.
          </p>
        )}
      </Tarjeta>

      {historico.length > 0 && (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Clave</th>
                <th className="px-4 py-3">Cambiado por</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((c) => (
                <tr key={c.id} className="border-b border-linea last:border-0">
                  <td className="px-4 py-3">{PROVEEDOR_LABEL[c.provider]}</td>
                  <td className="px-4 py-3 text-cuerpo">{c.model}</td>
                  <td className="px-4 py-3 font-mono text-gris">•••• {c.key_suffix}</td>
                  <td className="px-4 py-3">{c.changed_by ? nombres.get(c.changed_by) ?? c.changed_by : 'sistema'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gris">
                    {new Date(c.changed_at).toLocaleString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}

      <h2 className="text-[15px] font-extrabold text-titular">Participación</h2>

      <Tarjeta className="border-amber-300 bg-amber-50 p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-amber-800">
          Este ajuste NO afecta a votaciones ya creadas
        </h3>
        <p className="mt-2 text-[13.5px] text-amber-900">
          Al crear una votación, el valor de este ajuste se <strong>copia y queda sellado</strong> en
          esa votación concreta (<code>votes.min_membership_days</code>). Cambiarlo aquí solo cambia el
          valor por defecto de las <strong>votaciones que se creen a partir de ahora</strong> — ni un
          admin puede tocarlo en una votación ya abierta: la base de datos lo rechaza directamente
          (<code>P0001</code>, &quot;queda sellado al crear la votación&quot;). Esto evita que un cambio,
          bienintencionado o no, invalide una votación reñida en curso al habilitar de golpe a
          afiliados muy recientes. Poner el valor en <strong>0 días</strong> desactiva por completo la
          protección frente a afiliación oportunista de última hora — solo para votaciones futuras.
        </p>
      </Tarjeta>

      <Tarjeta className="p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-titular">
          Antigüedad mínima de afiliación (voto vinculante)
        </h3>
        <p className="mt-2 text-[13.5px] text-cuerpo">
          Valor actual por defecto: <strong>{diasActuales} días</strong>
          {ajusteAntiguedad?.updated_by && (
            <>
              {' '}
              · cambiado por {nombres.get(ajusteAntiguedad.updated_by) ?? ajusteAntiguedad.updated_by}
              {ajusteAntiguedad.updated_at
                ? ` el ${new Date(ajusteAntiguedad.updated_at).toLocaleString('es-ES')}`
                : ''}
            </>
          )}
        </p>
        <form action={actualizarAntiguedadMinima} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Días mínimos de antigüedad</label>
              <select
                name="dias"
                required
                defaultValue={String(diasActuales)}
                className="w-full rounded-boton border border-linea px-3 py-3 text-[14px]"
              >
                {opcionesDias.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? 'día' : 'días'}
                    {d === 0 ? ' — sin protección' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">
                Motivo del cambio (obligatorio, queda en auditoría)
              </label>
              <Input name="motivo" required placeholder="Ej. ajuste tras revisión del reglamento interno" />
            </div>
          </div>
          <button type="submit" className="w-full rounded-boton bg-accion px-4 py-3 text-[14px] font-bold text-white sm:w-auto">
            Actualizar valor por defecto
          </button>
        </form>
      </Tarjeta>
    </div>
  );
}
