import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolver } from '@/lib/simulador/resolver';
import { formatoEuros } from '@/lib/simulador/formato';
import type { ParametroInput, PartidaInput } from '@/lib/simulador/tipos';
import { normalizarRaicesPublicas } from './normalizar';

export const runtime = 'nodejs';
export const alt = 'El Presupuesto del País — Razón Común';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * OG dinámica de `/pais` (patrón de `presupuestos/[id]/opengraph-image.tsx`).
 * Usa el cliente admin (bypasa RLS) por comodidad de una sola query, pero
 * filtra `publicado=true` EXPLÍCITAMENTE en cada tabla — defensa en
 * profundidad: esta imagen es pública y no debe poder filtrar una cifra en
 * borrador aunque algún día cambie cómo se llama a este módulo.
 */
export default async function Image() {
  const admin = createAdminClient();
  const [{ data: parametrosData }, { data: partidasData }] = await Promise.all([
    admin
      .from('sim_parametros')
      .select('clave, nombre, unidad, modo, formula, valor_actual, valor_rc, es_palanca, palanca_min, palanca_max')
      .eq('publicado', true),
    admin
      .from('sim_partidas')
      .select(
        'id, parent_id, tipo, nombre, actual_modo, actual_cents, actual_formula, rc_modo, rc_cents, rc_pct, rc_formula, es_palanca, palanca_min, palanca_max',
      )
      .eq('publicado', true),
  ]);

  const parametros = (parametrosData ?? []) as ParametroInput[];
  const partidas = normalizarRaicesPublicas((partidasData ?? []) as PartidaInput[]);
  const modelo = resolver(parametros, partidas);

  const raices = partidas
    .filter((p) => p.parent_id === null)
    .map((p) => ({ nombre: p.nombre, info: modelo.partidas.find((m) => m.id === p.id) }))
    .filter((r): r is { nombre: string; info: NonNullable<(typeof r)['info']> } => Boolean(r.info))
    .sort((a, b) => Math.abs(b.info.actual.propioCents ?? 0) - Math.abs(a.info.actual.propioCents ?? 0))
    .slice(0, 5);

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
        <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.85 }}>Razón Común · El Presupuesto del País</div>
        <div style={{ display: 'flex', gap: 48, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 20, opacity: 0.8 }}>Balance actual</span>
            <span style={{ fontSize: 44, fontWeight: 800 }}>{formatoEuros(modelo.balance.actualCents)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 20, opacity: 0.8 }}>Balance Razón Común</span>
            <span style={{ fontSize: 44, fontWeight: 800 }}>{formatoEuros(modelo.balance.rcCents)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40 }}>
          {raices.map((r) => (
            <div key={r.nombre} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, fontWeight: 600 }}>
              <span>{r.nombre}</span>
              <span>
                {formatoEuros(r.info.actual.propioCents)} → {formatoEuros(r.info.rc.propioCents)}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
