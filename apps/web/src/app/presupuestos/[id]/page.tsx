import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { Boton } from '@/components/ui/Boton';
import { metadatosPagina } from '@/lib/seo';
import { createAdminClient } from '@/lib/supabase/admin';

function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

/**
 * Tarjeta compartible de un escenario de presupuesto. Es un enlace tipo
 * "share link" (id UUID no adivinable): se lee con `service_role` a
 * propósito, porque la RLS de `budget_scenarios` (propia o admin) impediría
 * que un tercero —o la propia persona anónima que lo generó, sin sesión que
 * la ligue— pudiera reabrirlo para compartirlo. No se expone nada más que
 * el reparto (nunca user_id/anon_hash) y solo por este id concreto.
 */
async function obtenerEscenarioParaCompartir(id: string) {
  const admin = createAdminClient();
  const [{ data: escenario }, { data: ministerios }] = await Promise.all([
    admin.from('budget_scenarios').select('id, allocation, created_at').eq('id', id).maybeSingle(),
    admin.from('ministries').select('id, name, current_budget_cents'),
  ]);
  if (!escenario) return null;
  return { escenario, ministerios: ministerios ?? [] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return metadatosPagina({
    titulo: 'Mi presupuesto',
    descripcion: 'Así repartiría yo el Presupuesto General del Estado en Razón Común.',
    ruta: `/presupuestos/${id}`,
  });
}

export default async function EscenarioCompartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const datos = await obtenerEscenarioParaCompartir(id);
  if (!datos) notFound();

  const { escenario, ministerios } = datos;
  const allocation = escenario.allocation as Record<string, number>;
  const total = Object.values(allocation).reduce((acc, v) => acc + v, 0);

  return (
    <Contenedor as="section" className="py-14">
      <div className="mx-auto max-w-[640px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Mi presupuesto</span>
        <h1 className="mt-3 text-[clamp(26px,4vw,36px)] font-extrabold">
          Así repartiría yo el PGE: {euros(total)}
        </h1>
        <p className="mt-2 text-[13.5px] text-gris">
          Guardado el {new Date(escenario.created_at).toLocaleDateString('es-ES')}
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-[640px] space-y-2.5">
        {ministerios
          .filter((m) => allocation[String(m.id)] !== undefined)
          .sort((a, b) => (allocation[String(b.id)] ?? 0) - (allocation[String(a.id)] ?? 0))
          .map((m) => {
            const valor = allocation[String(m.id)] ?? 0;
            const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
            return (
              <div key={m.id} className="flex items-center justify-between rounded-boton border border-linea bg-panel px-4 py-3">
                <span className="text-[13.5px] font-semibold text-titular">{m.name}</span>
                <span className="text-[13px] text-cuerpo">
                  {euros(valor)} ({pct}%)
                </span>
              </div>
            );
          })}
      </div>

      <div className="mx-auto mt-10 max-w-[640px] text-center">
        <Boton href="/presupuestos" variante="grad">
          Prueba tú el simulador
        </Boton>
      </div>
    </Contenedor>
  );
}
