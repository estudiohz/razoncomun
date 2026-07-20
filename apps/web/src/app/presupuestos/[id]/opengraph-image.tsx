import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const alt = 'Mi presupuesto — Razón Común';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

/** Imagen OG dinámica de la tarjeta compartible del simulador de presupuesto. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const [{ data: escenario }, { data: ministerios }] = await Promise.all([
    admin.from('budget_scenarios').select('allocation, created_at').eq('id', id).maybeSingle(),
    admin.from('ministries').select('id, name'),
  ]);

  const allocation = (escenario?.allocation as Record<string, number>) ?? {};
  const total = Object.values(allocation).reduce((acc, v) => acc + v, 0);
  const nombrePorId = new Map((ministerios ?? []).map((m) => [String(m.id), m.name]));

  const top5 = Object.entries(allocation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, cents]) => ({ nombre: nombrePorId.get(id) ?? `Ministerio ${id}`, cents }));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1B3D9C 0%, #8B30D9 35%, #C3369E 60%, #E8792F 80%, #16B8A0 100%)',
          padding: 64,
          fontFamily: 'sans-serif',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.85 }}>Razón Común · Mi presupuesto</div>
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, marginTop: 16 }}>
          {`Así repartiría yo el PGE: ${euros(total)}`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 40 }}>
          {top5.map((m) => (
            <div key={m.nombre} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, fontWeight: 600 }}>
              <span>{m.nombre}</span>
              <span>{euros(m.cents)}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
