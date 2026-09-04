'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { stripePublishableKey } from '@/lib/stripe/publicKey';
import { CUOTA_REFERENCIA_CENTS, type Periodicidad, type PlanCuota } from '@/lib/stripe/config';
import { TEXTO_AVISO_MANDATO_SEPA, formatearCents } from '@/lib/afiliacion/consentimiento';
import { TEXTO_CONSENTIMIENTO } from '@/lib/auth/consentimiento';
import { validarNIF } from '@/lib/afiliacion/nif';
import { iniciarDomiciliacion, confirmarAfiliacion } from './actions';

let stripePromise: Promise<StripeJs | null> | null = null;
function getStripe() {
  if (!stripePromise) stripePromise = loadStripe(stripePublishableKey());
  return stripePromise;
}

type Paso = 'datos' | 'pago';

export function AltaSepa({
  email,
  nombreInicial,
  planInicial = 'socio',
  verificadoDisponible,
}: {
  email: string;
  nombreInicial: string | null;
  /** Plan preseleccionado. Llega de `?plan=` en la URL: los botones de la
      escalera de niveles bajan hasta aquí con el tramo ya elegido. */
  planInicial?: PlanCuota;
  /** Si los Price del tramo verificado no están configurados en el entorno,
      no se ofrece ese plan (ver `planVerificadoDisponible()`). */
  verificadoDisponible: boolean;
}) {
  const [paso, setPaso] = useState<Paso>('datos');
  const [plan, setPlan] = useState<PlanCuota>(
    planInicial === 'verificado' && verificadoDisponible ? 'verificado' : 'socio',
  );
  const [periodo, setPeriodo] = useState<Periodicidad>('monthly');
  const [nif, setNif] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [datosPago, setDatosPago] = useState<{ clientSecret: string; customerId: string } | null>(null);
  const [reanudando, setReanudando] = useState(false);
  const router = useRouter();

  /**
   * Vuelta del 3D Secure.
   *
   * Una tarjeta europea puede exigir autenticación en el banco: Stripe navega
   * fuera y devuelve a `return_url` con el SetupIntent ya confirmado. Al
   * volver, este componente se monta DE CERO —se perdió todo el estado—, así
   * que sin esto la persona habría autenticado la tarjeta y se quedaría sin
   * suscripción, creyendo que ya es socia. La domiciliación no pasa por aquí
   * (no hay 3DS en SEPA); esto es solo para tarjeta.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reanudar') !== '1') return;

    const secreto = params.get('setup_intent_client_secret');
    const planVuelta = params.get('plan');
    const periodoVuelta = params.get('periodo');
    if (!secreto || !planVuelta || !periodoVuelta) return;

    let cancelado = false;
    setReanudando(true);

    (async () => {
      const stripe = await getStripe();
      if (!stripe) return;

      const { setupIntent } = await stripe.retrieveSetupIntent(secreto);
      const pmId =
        typeof setupIntent?.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id;

      if (cancelado) return;

      if (setupIntent?.status !== 'succeeded' || !pmId) {
        setReanudando(false);
        setError('Tu banco no autorizó la tarjeta. Puedes intentarlo otra vez o usar domiciliación.');
        return;
      }

      const resultado = await confirmarAfiliacion({
        plan: planVuelta as PlanCuota,
        periodo: periodoVuelta as Periodicidad,
        paymentMethodId: pmId,
      });

      if (cancelado) return;

      if (!resultado.ok) {
        setReanudando(false);
        setError(resultado.mensaje);
        return;
      }

      router.push('/panel/afiliacion?alta=ok');
      router.refresh();
    })();

    return () => {
      cancelado = true;
    };
    // Solo al montar: es la vuelta de una redirección, no reacciona a nada más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reanudando) {
    return (
      <div className="mt-6 rounded-tarjeta border border-linea bg-white p-6 text-center">
        <p className="text-[15px] font-bold text-titular">Terminando tu alta…</p>
        <p className="mt-2 text-[13.5px] text-cuerpo">
          Tu banco ha autorizado el pago. No cierres esta página.
        </p>
      </div>
    );
  }

  async function continuar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validarNIF(nif)) {
      setError('Ese NIF/NIE no supera la validación: revisa que la letra sea la correcta.');
      return;
    }
    if (!consentimiento) {
      setError('Debes marcar la casilla de consentimiento para continuar.');
      return;
    }

    setCargando(true);
    const resultado = await iniciarDomiciliacion({ plan, periodo, nif, consentimiento });
    setCargando(false);

    if (!resultado.ok) {
      setError(resultado.mensaje);
      return;
    }
    setDatosPago({ clientSecret: resultado.clientSecret, customerId: resultado.customerId });
    setPaso('pago');
  }

  if (paso === 'pago' && datosPago) {
    return (
      <Elements
        stripe={getStripe()}
        options={{
          // El Payment Element exige el `clientSecret` AQUÍ, al construir
          // `Elements` — a diferencia del viejo `IbanElement`, que se
          // conformaba con recibirlo al confirmar. Por eso este bloque solo se
          // monta cuando ya existe (`paso === 'pago'`).
          clientSecret: datosPago.clientSecret,
          locale: 'es',
          appearance: {
            variables: {
              colorPrimary: '#1B3D9C',
              colorText: '#101C34',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              borderRadius: '10px',
            },
          },
        }}
      >
        <PasoIban
          plan={plan}
          periodo={periodo}
          email={email}
          nombreInicial={nombreInicial}
          clientSecret={datosPago.clientSecret}
          onVolver={() => setPaso('datos')}
        />
      </Elements>
    );
  }

  return (
    <form onSubmit={continuar} className="mt-6 space-y-6">
      {/* PASO 1 — el tramo. Solo se pinta si el tramo verificado existe en
          este entorno; si no, se cobra `socio` sin preguntar nada, igual que
          antes de que existieran los dos planes. */}
      {verificadoDisponible && (
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-bold text-titular">Tu tramo de cuota</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer flex-col rounded-boton border border-linea bg-white p-4 has-[:checked]:border-morado has-[:checked]:ring-2 has-[:checked]:ring-morado/30">
              <input
                type="radio"
                name="plan"
                value="socio"
                checked={plan === 'socio'}
                onChange={() => setPlan('socio')}
                className="sr-only"
              />
              <span className="text-[13.5px] font-extrabold text-titular">Socio</span>
              <span className="mt-1 text-[12.5px] leading-relaxed text-cuerpo">
                {formatearCents(CUOTA_REFERENCIA_CENTS.socio.monthly)}/mes ·{' '}
                {formatearCents(CUOTA_REFERENCIA_CENTS.socio.annual)}/año
              </span>
            </label>
            <label className="flex cursor-pointer flex-col rounded-boton border border-linea bg-white p-4 has-[:checked]:border-magenta has-[:checked]:ring-2 has-[:checked]:ring-magenta/30">
              <input
                type="radio"
                name="plan"
                value="verificado"
                checked={plan === 'verificado'}
                onChange={() => setPlan('verificado')}
                className="sr-only"
              />
              <span className="text-[13.5px] font-extrabold text-titular">Socio verificado</span>
              <span className="mt-1 text-[12.5px] leading-relaxed text-cuerpo">
                {formatearCents(CUOTA_REFERENCIA_CENTS.verificado.monthly)}/mes ·{' '}
                {formatearCents(CUOTA_REFERENCIA_CENTS.verificado.annual)}/año
              </span>
            </label>
          </div>
          {/* Aviso obligatorio, no decorativo: el tramo alto costea la
              verificación, pero el NIVEL "verificado" solo lo da completar
              Stripe Identity desde el perfil. Sin esta línea estaríamos
              cobrando 1 €/mes más por algo que la cuota no entrega. */}
          {plan === 'verificado' && (
            <p className="mt-2 rounded-boton bg-magenta/10 px-4 py-3 text-[12.5px] leading-relaxed text-cuerpo">
              Este tramo costea tu verificación de identidad. Para que el nivel pase de verdad a
              <b className="font-bold"> Socio verificado</b> tendrás que completarla desde tu perfil
              cuando termines el alta — la cuota sola no lo activa.
            </p>
          )}
        </fieldset>
      )}

      {/* PASO 2 — la periodicidad, con los importes del tramo elegido. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col rounded-boton border border-linea bg-white p-5 has-[:checked]:border-accion has-[:checked]:ring-2 has-[:checked]:ring-accion/30">
          <input
            type="radio"
            name="periodo"
            value="monthly"
            checked={periodo === 'monthly'}
            onChange={() => setPeriodo('monthly')}
            className="sr-only"
          />
          <span className="text-[12px] font-bold uppercase tracking-wide text-gris">Mensual</span>
          <span className="mt-1 text-[28px] font-extrabold text-titular">
            {formatearCents(CUOTA_REFERENCIA_CENTS[plan].monthly)}
            <span className="text-[14px] font-semibold text-gris">/mes</span>
          </span>
        </label>
        <label className="flex cursor-pointer flex-col rounded-boton border border-linea bg-white p-5 has-[:checked]:border-accion has-[:checked]:ring-2 has-[:checked]:ring-accion/30">
          <input
            type="radio"
            name="periodo"
            value="annual"
            checked={periodo === 'annual'}
            onChange={() => setPeriodo('annual')}
            className="sr-only"
          />
          <span className="text-[12px] font-bold uppercase tracking-wide text-gris">
            Anual <span className="text-accion">· 2 meses gratis</span>
          </span>
          <span className="mt-1 text-[28px] font-extrabold text-titular">
            {formatearCents(CUOTA_REFERENCIA_CENTS[plan].annual)}
            <span className="text-[14px] font-semibold text-gris">/año</span>
          </span>
        </label>
      </div>

      <div>
        <label htmlFor="nif" className="mb-1.5 block text-[12.5px] font-bold text-titular">
          Tu NIF o NIE
        </label>
        <input
          id="nif"
          name="nif"
          type="text"
          required
          maxLength={9}
          placeholder="12345678Z"
          value={nif}
          onChange={(e) => setNif(e.target.value.toUpperCase())}
          className="w-full rounded-boton border border-linea bg-white px-4 py-3 text-[15px] uppercase tracking-wide text-titular outline-none focus:border-accion focus:ring-2 focus:ring-accion/20"
        />
        <p className="mt-1.5 text-[12px] text-gris">
          Lo necesitamos para el certificado fiscal y el Modelo 182 de Hacienda (tu cuota desgrava un
          20% en el IRPF, hasta 600 €/año). Validamos la letra de control antes de guardarlo.
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 text-[13px] leading-relaxed text-cuerpo">
          <input
            type="checkbox"
            checked={consentimiento}
            onChange={(e) => setConsentimiento(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-linea text-accion"
          />
          <span>{TEXTO_CONSENTIMIENTO}</span>
        </label>
        <div className="rounded-boton border border-linea bg-white p-4 text-[12.5px] leading-relaxed text-cuerpo">
          <p className="font-bold text-titular">Sobre el cobro por domiciliación SEPA</p>
          <p className="mt-1">{TEXTO_AVISO_MANDATO_SEPA}</p>
        </div>
      </div>

      {error && (
        <p className="rounded-boton border border-red-300 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="w-full rounded-boton bg-accion px-5 py-3.5 text-[15px] font-bold text-white shadow-boton hover:-translate-y-0.5 disabled:opacity-60"
      >
        {cargando ? 'Preparando la domiciliación…' : 'Continuar con tu IBAN'}
      </button>

      <p className="text-center text-[12px] text-gris">
        Recibirás certificado fiscal anual descargable desde tu perfil.
      </p>
    </form>
  );
}

function PasoIban({
  plan,
  periodo,
  email,
  nombreInicial,
  clientSecret,
  onVolver,
}: {
  plan: PlanCuota;
  periodo: Periodicidad;
  email: string;
  nombreInicial: string | null;
  clientSecret: string;
  onVolver: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [nombreTitular, setNombreTitular] = useState(nombreInicial ?? '');
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcesando(true);
    setError(null);

    // Valida el formulario antes de llamar a Stripe: sin esto, un campo a
    // medio rellenar se convierte en un error del servidor en vez de en el
    // mensaje que el propio Payment Element sabe pintar bajo el campo.
    const { error: errorEnvio } = await elements.submit();
    if (errorEnvio) {
      setError(errorEnvio.message ?? 'Revisa los datos de pago.');
      setProcesando(false);
      return;
    }

    // `redirect: 'if_required'`: la domiciliación se confirma sin salir de
    // aquí, pero una tarjeta europea puede exigir 3D Secure y entonces Stripe
    // navega al banco y vuelve a `return_url`. El plan y la periodicidad
    // viajan en esa URL porque el componente se remonta desde cero al volver;
    // el customer NO viaja — se deriva en el servidor desde la sesión.
    const urlVuelta = new URL(window.location.href);
    urlVuelta.searchParams.set('reanudar', '1');
    urlVuelta.searchParams.set('plan', plan);
    urlVuelta.searchParams.set('periodo', periodo);
    urlVuelta.hash = 'alta';

    const { setupIntent, error: stripeError } = await stripe.confirmSetup({
      elements,
      clientSecret,
      confirmParams: {
        return_url: urlVuelta.toString(),
        payment_method_data: { billing_details: { name: nombreTitular, email } },
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'No hemos podido validar tus datos de pago. Revísalos e inténtalo de nuevo.');
      setProcesando(false);
      return;
    }

    const pmId =
      typeof setupIntent?.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

    if (!setupIntent || setupIntent.status !== 'succeeded' || !pmId) {
      setError('El método de pago no se confirmó correctamente. Inténtalo de nuevo.');
      setProcesando(false);
      return;
    }

    // Sin `customerId`: lo deriva el servidor desde la sesión. Mandarlo desde
    // aquí permitía cobrarle a otra persona (ver actions.ts).
    const resultado = await confirmarAfiliacion({
      plan,
      periodo,
      paymentMethodId: pmId,
    });
    if (!resultado.ok) {
      setError(resultado.mensaje);
      setProcesando(false);
      return;
    }

    router.push('/panel/afiliacion?alta=ok');
    router.refresh();
  }

  return (
    <form onSubmit={confirmar} className="mt-6 space-y-6">
      <button
        type="button"
        onClick={onVolver}
        className="text-[12.5px] font-semibold text-gris underline underline-offset-2"
      >
        ← Volver a tus datos
      </button>

      {/* Resumen de lo que se va a cobrar. Este paso es el que firma el
          mandato: la persona debe ver el importe exacto sin volver atrás. */}
      <p className="rounded-boton border border-linea bg-fondo px-4 py-3 text-[13px] text-cuerpo">
        Vas a domiciliar{' '}
        <b className="font-bold text-titular">
          {formatearCents(CUOTA_REFERENCIA_CENTS[plan][periodo])}
        </b>{' '}
        {periodo === 'monthly' ? 'al mes' : 'al año'} — tramo{' '}
        {plan === 'verificado' ? 'Socio verificado' : 'Socio'}.
      </p>

      <div>
        <label htmlFor="titular" className="mb-1.5 block text-[12.5px] font-bold text-titular">
          Nombre del titular de la cuenta
        </label>
        <input
          id="titular"
          type="text"
          required
          value={nombreTitular}
          onChange={(e) => setNombreTitular(e.target.value)}
          className="w-full rounded-boton border border-linea bg-white px-4 py-3 text-[15px] text-titular outline-none focus:border-accion focus:ring-2 focus:ring-accion/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-bold text-titular">IBAN</label>
        <div className="rounded-boton border border-linea bg-white px-4 py-3.5">
          <PaymentElement
            options={{
              // El nombre y el email los pedimos nosotros (el campo de arriba
              // y la sesión), así que se le dice a Stripe que no los repita.
              fields: { billingDetails: { name: 'never', email: 'never' } },
              // La domiciliación primero: es la que le interesa al partido.
              paymentMethodOrder: ['sepa_debit', 'card'],
            }}
          />
        </div>
        <p className="mt-1.5 text-[12px] text-gris">
          Al confirmar, aceptas el mandato SEPA (esquema CORE) para que Razón Común, a través de
          Stripe, adeude tu cuenta con la periodicidad elegida.
        </p>
      </div>

      {error && (
        <p className="rounded-boton border border-red-300 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={procesando || !stripe}
        className="w-full rounded-boton bg-accion px-5 py-3.5 text-[15px] font-bold text-white shadow-boton hover:-translate-y-0.5 disabled:opacity-60"
      >
        {procesando ? 'Confirmando el mandato…' : 'Confirmar la domiciliación'}
      </button>
    </form>
  );
}
