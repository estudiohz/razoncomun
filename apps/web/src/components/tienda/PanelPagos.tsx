'use client';

import { useActionState } from 'react';
import { Input } from '@/components/ui/Input';
import {
  guardarCredencialPago,
  guardarMetodosPago,
  type ResultadoPagos,
} from '@/app/admin/tienda/pagos/actions';

const etiqueta = 'mb-1 block text-[12px] font-bold uppercase tracking-[.06em] text-gris';

export interface EstadoPasarela {
  guardada: boolean;
  mode: 'test' | 'live' | null;
  keySuffix: string;
  publicKey: string;
  tieneWebhook: boolean;
  /** De dónde sale la clave que se usaría AHORA MISMO. */
  origen: 'panel' | 'entorno' | 'ninguno';
}

export interface MetodoUI {
  code: string;
  label: string;
  enabled: boolean;
}

function Mensaje({ estado }: { estado: ResultadoPagos | null }) {
  if (!estado) return null;
  if (estado.error) {
    return (
      <p className="mt-4 rounded-boton border border-magenta/40 bg-magenta/5 px-4 py-3 text-[14px] text-magenta">
        {estado.error}
      </p>
    );
  }
  return (
    <p className="mt-4 rounded-boton border border-accion bg-accion/5 px-4 py-3 text-[14px] text-titular">
      {estado.aviso ?? 'Guardado.'}
    </p>
  );
}

function FormularioPasarela({
  provider,
  titulo,
  estado,
  ayudaSecreto,
  ayudaPublica,
  pideModo,
  nota,
}: {
  provider: 'stripe' | 'paypal';
  titulo: string;
  estado: EstadoPasarela;
  ayudaSecreto: string;
  ayudaPublica: string;
  pideModo: boolean;
  nota?: string;
}) {
  const [resultado, accion, pendiente] = useActionState<ResultadoPagos | null, FormData>(
    guardarCredencialPago,
    null,
  );

  return (
    <section className="rounded-tarjeta border border-linea bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold text-titular">{titulo}</h2>
        {estado.mode === 'live' ? (
          <span className="rounded-full bg-magenta/10 px-3 py-1 text-[12px] font-extrabold text-magenta">
            LIVE · cobra de verdad
          </span>
        ) : estado.mode === 'test' ? (
          <span className="rounded-full bg-gris/15 px-3 py-1 text-[12px] font-extrabold text-gris">
            TEST · no cobra
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-[13px] text-gris">
        {estado.origen === 'panel' ? (
          <>
            Clave guardada aquí, terminada en{' '}
            <span className="font-mono font-bold text-titular">…{estado.keySuffix}</span>.
            {estado.tieneWebhook ? ' Webhook configurado.' : ' Sin secreto de webhook.'}
          </>
        ) : estado.origen === 'entorno' ? (
          <>
            Ahora mismo se usa la variable de entorno de Dokploy. Si guardas una clave aquí,
            pasará a mandar esta.
          </>
        ) : (
          'Sin configurar: ni clave aquí ni variable de entorno.'
        )}
      </p>

      {nota && (
        <p className="mt-3 rounded-boton bg-fondo px-4 py-3 text-[13px] text-cuerpo">{nota}</p>
      )}

      <form action={accion} className="mt-5 grid gap-4">
        <input type="hidden" name="provider" value={provider} />

        <div>
          <label className={etiqueta} htmlFor={`${provider}-secret`}>
            Clave secreta
          </label>
          <Input
            id={`${provider}-secret`}
            name="secret"
            type="password"
            autoComplete="off"
            placeholder={ayudaSecreto}
            required
          />
          <p className="mt-1.5 text-[12px] text-gris">
            No se puede volver a leer una vez guardada: solo verás los 4 últimos caracteres.
          </p>
        </div>

        <div>
          <label className={etiqueta} htmlFor={`${provider}-public`}>
            {provider === 'stripe' ? 'Clave publicable' : 'Client ID'}
          </label>
          <Input
            id={`${provider}-public`}
            name="public_key"
            defaultValue={estado.publicKey}
            placeholder={ayudaPublica}
          />
        </div>

        {provider === 'stripe' && (
          <div>
            <label className={etiqueta} htmlFor="stripe-webhook">
              Secreto del webhook (opcional)
            </label>
            <Input id="stripe-webhook" name="webhook" type="password" autoComplete="off" placeholder="whsec_…" />
          </div>
        )}

        {pideModo ? (
          <div>
            <label className={etiqueta} htmlFor={`${provider}-mode`}>
              Entorno
            </label>
            <select
              id={`${provider}-mode`}
              name="mode"
              defaultValue={estado.mode ?? 'test'}
              className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px] text-cuerpo"
            >
              <option value="test">Pruebas (sandbox)</option>
              <option value="live">Producción</option>
            </select>
          </div>
        ) : (
          <p className="text-[12px] text-gris">
            El entorno (pruebas o producción) se deduce del prefijo de la propia clave, no se
            elige: así la etiqueta no puede contradecir a lo que de verdad va a cobrar.
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton disabled:opacity-60"
          >
            {pendiente ? 'Guardando…' : 'Guardar credencial'}
          </button>
        </div>
      </form>

      <Mensaje estado={resultado} />
    </section>
  );
}

function FormularioMetodos({ metodos }: { metodos: MetodoUI[] }) {
  const [resultado, accion, pendiente] = useActionState<ResultadoPagos | null, FormData>(
    guardarMetodosPago,
    null,
  );

  return (
    <section className="rounded-tarjeta border border-linea bg-white p-6">
      <h2 className="text-[17px] font-extrabold text-titular">Formas de pago</h2>
      <p className="mt-2 text-[13px] text-gris">
        Apagar aquí quita el método del checkout. Encenderlo <strong>no basta</strong>: hay que
        habilitarlo también en el panel de Stripe (Settings → Payment methods), o el pago falla
        con el cliente delante.
      </p>

      <form action={accion} className="mt-5">
        <ul className="grid gap-2.5">
          {metodos.map((m) => (
            <li key={m.code}>
              <input type="hidden" name="codigos" value={m.code} />
              <label className="flex items-center gap-2.5 text-[14px] text-cuerpo">
                <input
                  type="checkbox"
                  name="enabled"
                  value={m.code}
                  defaultChecked={m.enabled}
                  className="h-[17px] w-[17px] accent-accion"
                />
                {m.label}
              </label>
            </li>
          ))}
        </ul>

        <button
          type="submit"
          disabled={pendiente}
          className="mt-5 rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar formas de pago'}
        </button>
      </form>

      <Mensaje estado={resultado} />
    </section>
  );
}

export function PanelPagos({
  stripe,
  paypal,
  metodos,
}: {
  stripe: EstadoPasarela;
  paypal: EstadoPasarela;
  metodos: MetodoUI[];
}) {
  return (
    <div className="grid gap-6">
      <FormularioPasarela
        provider="stripe"
        titulo="Stripe"
        estado={stripe}
        ayudaSecreto="sk_test_… o sk_live_…"
        ayudaPublica="pk_test_… o pk_live_…"
        pideModo={false}
      />

      <FormularioMetodos metodos={metodos} />

      <FormularioPasarela
        provider="paypal"
        titulo="PayPal"
        estado={paypal}
        ayudaSecreto="Client secret de la app de PayPal"
        ayudaPublica="Client ID"
        pideModo
        nota={
          'Antes de rellenar esto: PayPal se puede ofrecer como método DENTRO de Stripe, ' +
          'activándolo en el panel de Stripe, sin cuenta ni credenciales aparte. Estas ' +
          'credenciales solo hacen falta si se decide cobrar directamente con PayPal. ' +
          'Hoy se guardan, pero todavía no hay ningún cobro que las use.'
        }
      />
    </div>
  );
}
