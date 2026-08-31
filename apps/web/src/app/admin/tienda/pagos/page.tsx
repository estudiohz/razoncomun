import Link from 'next/link';
import { PanelPagos, type EstadoPasarela } from '@/components/tienda/PanelPagos';
import { requireAdmin } from '@/lib/admin/guard';
import { hayClaveMaestraPagos, metodosPago, resumenCredenciales } from '@/lib/pagos/credenciales';

export const dynamic = 'force-dynamic';

function estado(
  resumen: Awaited<ReturnType<typeof resumenCredenciales>>,
  proveedor: 'stripe' | 'paypal',
  hayEnEntorno: boolean,
): EstadoPasarela {
  const r = resumen.get(proveedor);
  return {
    guardada: Boolean(r),
    mode: r?.mode ?? null,
    keySuffix: r?.key_suffix ?? '',
    publicKey: r?.public_key ?? '',
    tieneWebhook: r?.tiene_webhook ?? false,
    origen: r ? 'panel' : hayEnEntorno ? 'entorno' : 'ninguno',
  };
}

/**
 * Credenciales de pago y formas de pago. Solo admin: aquí se decide con qué
 * cuenta se cobra.
 *
 * Lo que NO hay y no va a haber: un "conectar con un botón de login". Eso
 * (Stripe Connect, PayPal Partner Referrals) es para plataformas que dan de
 * alta cuentas de terceros; con una sola cuenta propia, la conexión es pegar
 * la credencial. Ver la cabecera de la migración 0053.
 */
export default async function PagosAdminPage() {
  await requireAdmin('/admin/tienda/pagos');

  const conClaveMaestra = hayClaveMaestraPagos();
  const resumen = conClaveMaestra ? await resumenCredenciales() : new Map();
  const metodos = await metodosPago();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tienda" className="text-[14px] text-gris no-underline hover:underline">
          ← Volver a la tienda
        </Link>
        <h1 className="mt-3 text-[24px] font-extrabold">Pagos</h1>
        <p className="mt-1 text-[13.5px] text-gris">
          Con qué cuenta se cobra y qué formas de pago se ofrecen. El secreto se guarda cifrado en
          la base de datos y no se puede volver a leer desde aquí.
        </p>
      </div>

      {!conClaveMaestra && (
        <div className="rounded-tarjeta border border-magenta/40 bg-magenta/5 p-6">
          <p className="text-[15px] font-bold text-magenta">
            Falta <span className="font-mono">PAYMENT_CREDENTIALS_MASTER_KEY</span>
          </p>
          <p className="mt-2 text-[14px] text-cuerpo">
            Es la clave con la que se cifran los secretos de pago. No se guarda en la base de
            datos a propósito: vive solo en el entorno del servidor, para que un volcado robado de
            Postgres no sirva de nada. Hasta que esté puesta en Dokploy (en{' '}
            <span className="font-mono">rc-webapp</span>, y redeploy), este panel no puede guardar
            ni leer credenciales.
          </p>
          <p className="mt-2 text-[13px] text-gris">
            Genérala con <span className="font-mono">openssl rand -base64 32</span>. Guárdala en un
            sitio seguro: si se pierde, las credenciales ya cifradas se vuelven ilegibles y hay que
            volver a pegarlas.
          </p>
        </div>
      )}

      <PanelPagos
        stripe={estado(resumen, 'stripe', Boolean(process.env.STRIPE_SECRET_KEY))}
        paypal={estado(resumen, 'paypal', false)}
        metodos={metodos.map((m) => ({ code: m.code, label: m.label, enabled: m.enabled }))}
      />
    </div>
  );
}
