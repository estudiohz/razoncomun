'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe, type Stripe as StripeJs } from '@stripe/stripe-js';
import { Elements, IbanElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { stripePublishableKey } from '@/lib/stripe/publicKey';
import { CUOTA_REFERENCIA_CENTS, type Periodicidad } from '@/lib/stripe/config';
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

export function AltaSepa({ email, nombreInicial }: { email: string; nombreInicial: string | null }) {
  const [paso, setPaso] = useState<Paso>('datos');
  const [periodo, setPeriodo] = useState<Periodicidad>('monthly');
  const [nif, setNif] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [datosPago, setDatosPago] = useState<{ clientSecret: string; customerId: string } | null>(null);

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
    const resultado = await iniciarDomiciliacion({ periodo, nif, consentimiento });
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
      <Elements stripe={getStripe()} options={{ locale: 'es' }}>
        <PasoIban
          periodo={periodo}
          email={email}
          nombreInicial={nombreInicial}
          clientSecret={datosPago.clientSecret}
          customerId={datosPago.customerId}
          onVolver={() => setPaso('datos')}
        />
      </Elements>
    );
  }

  return (
    <form onSubmit={continuar} className="mt-6 space-y-6">
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
            {formatearCents(CUOTA_REFERENCIA_CENTS.monthly)}
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
            {formatearCents(CUOTA_REFERENCIA_CENTS.annual)}
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
  periodo,
  email,
  nombreInicial,
  clientSecret,
  customerId,
  onVolver,
}: {
  periodo: Periodicidad;
  email: string;
  nombreInicial: string | null;
  clientSecret: string;
  customerId: string;
  onVolver: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [nombreTitular, setNombreTitular] = useState(nombreInicial ?? '');
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const estiloIban = useMemo(
    () => ({
      style: {
        base: {
          fontSize: '15px',
          color: '#1B3D9C',
          '::placeholder': { color: '#9AA5B8' },
        },
      },
      supportedCountries: ['SEPA'],
      placeholderCountry: 'ES',
    }),
    [],
  );

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    const ibanElement = elements.getElement(IbanElement);
    if (!ibanElement) return;

    setProcesando(true);
    setError(null);

    const { setupIntent, error: stripeError } = await stripe.confirmSepaDebitSetup(clientSecret, {
      payment_method: {
        sepa_debit: ibanElement,
        billing_details: { name: nombreTitular, email },
      },
    });

    if (stripeError) {
      setError(stripeError.message ?? 'No hemos podido validar tu IBAN. Revísalo e inténtalo de nuevo.');
      setProcesando(false);
      return;
    }

    const pmId =
      typeof setupIntent?.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

    if (!setupIntent || setupIntent.status !== 'succeeded' || !pmId) {
      setError('El mandato no se confirmó correctamente. Inténtalo de nuevo.');
      setProcesando(false);
      return;
    }

    const resultado = await confirmarAfiliacion({ periodo, customerId, paymentMethodId: pmId });
    if (!resultado.ok) {
      setError(resultado.mensaje);
      setProcesando(false);
      return;
    }

    router.push('/perfil?afiliacion=ok');
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
          <IbanElement options={estiloIban} />
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
