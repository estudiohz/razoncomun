import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { requireFinanzas } from '@/lib/afiliacion/acceso';

const ESTADO_LABEL: Record<string, string> = { active: 'Activo', past_due: 'Impago', canceled: 'Baja' };

function euros(cents: number | null): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

function fecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function AfiliadoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireFinanzas();

  const { data: miembro } = await supabase
    .from('members')
    .select(
      'id, user_id, status, billing_period, amount_cents, payment_method, sepa_mandate_id, stripe_customer_id, stripe_subscription_id, started_at, canceled_at, profiles(display_name, email, origin_province_id, created_at)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!miembro) notFound();

  const perfil = Array.isArray(miembro.profiles) ? miembro.profiles[0] : miembro.profiles;

  return (
    <div className="max-w-[640px] space-y-6">
      <Link href="/admin/afiliados" className="text-[13px] font-semibold text-titular underline">
        ← Volver al listado
      </Link>

      <div>
        <h1 className="text-[24px] font-extrabold">{perfil?.display_name ?? 'Afiliado'}</h1>
        <p className="mt-1 text-[13.5px] text-gris">{perfil?.email}</p>
      </div>

      <Tarjeta className="divide-y divide-linea p-0">
        {[
          ['Estado', ESTADO_LABEL[miembro.status] ?? miembro.status],
          ['Periodicidad', miembro.billing_period === 'annual' ? 'Anual' : 'Mensual'],
          ['Cuota', euros(miembro.amount_cents)],
          ['Método de pago', miembro.payment_method],
          ['Mandato SEPA', miembro.sepa_mandate_id ?? 'sin registrar'],
          ['Afiliado desde', fecha(miembro.started_at)],
          ['Baja', fecha(miembro.canceled_at)],
          ['Stripe customer', miembro.stripe_customer_id ?? '—'],
          ['Stripe subscription', miembro.stripe_subscription_id ?? '—'],
        ].map(([label, valor]) => (
          <div key={label} className="flex items-center justify-between px-5 py-3 text-[13.5px]">
            <span className="text-gris">{label}</span>
            <span className="font-semibold text-titular">{valor}</span>
          </div>
        ))}
      </Tarjeta>

      <Tarjeta className="p-5 text-[12.5px] text-cuerpo">
        <p className="font-bold text-titular">Solo lectura</p>
        <p className="mt-1">
          Este panel espeja Stripe vía webhook. Para gestionar cobros, reembolsos o cambiar el método
          de pago de este afiliado, hazlo desde el{' '}
          <a
            href={`https://dashboard.stripe.com/test/customers/${miembro.stripe_customer_id}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-titular underline"
          >
            dashboard de Stripe
          </a>
          .
        </p>
      </Tarjeta>
    </div>
  );
}
