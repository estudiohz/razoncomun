/**
 * app/pais/DonutChart.tsx
 *
 * Donut de reparto por colores, CSS puro (D-S3: sin librería de gráficos —
 * `conic-gradient` es soporte nativo del navegador, cero bundle). Dos usos
 * en `/pais` (refinamiento visual, ola S2.1): el reparto de las ÁREAS RAÍZ
 * de un bloque (Gastos/Ingresos) y, repetido dentro de cada drill-down, el
 * reparto de los HIJOS de un área — mismo componente, distinto dataset.
 *
 * Valores siempre en céntimos del lado RC (la propuesta de Razón Común es
 * el reparto que se quiere comunicar). Un segmento sin `color` asignado en
 * el admin cae en la paleta de fallback, asignada por índice.
 */

interface Segmento {
  nombre: string;
  valor: number;
  color: string | null;
}

/**
 * Paleta de fallback — mismos hex que `tailwind.config.ts` (espectro de
 * marca / `colors.cat.*`), para no inventar colores fuera de la paleta. El
 * teal (#16B8A0) queda excluido a propósito: en el resto de la página ya
 * significa "Razón Común" (barras de comparación) y reutilizarlo aquí
 * confundiría qué representa cada color.
 */
const PALETA_FALLBACK = [
  '#8B30D9', // morado
  '#C3369E', // magenta
  '#E8792F', // naranja
  '#2BC7E8', // cian
  '#4CA637', // verde
  '#E0A82E', // dorado
  '#1B3D9C', // tinta
  '#6F6F6F', // gris
];

export function DonutChart({
  segmentos,
  tamano = 132,
  titulo,
}: {
  segmentos: Segmento[];
  tamano?: number;
  /** Título corto para el resumen accesible (p. ej. "Gastos" o "Defensa"). */
  titulo?: string;
}) {
  const conValor = segmentos.filter((s) => s.valor > 0);
  const total = conValor.reduce((suma, s) => suma + s.valor, 0);
  if (total <= 0 || conValor.length === 0) return null;

  let acumulado = 0;
  const resueltos = conValor.map((s, i) => {
    const pct = (s.valor / total) * 100;
    const color = s.color?.trim() ? s.color : PALETA_FALLBACK[i % PALETA_FALLBACK.length];
    const desde = acumulado;
    acumulado += pct;
    return { ...s, pct, color, desde, hasta: acumulado };
  });

  const paradas = resueltos.map((s) => `${s.color} ${s.desde}% ${s.hasta}%`).join(', ');
  const resumenTexto = `${titulo ? `${titulo}: ` : ''}${resueltos
    .map((s) => `${s.nombre} ${s.pct.toFixed(0)}%`)
    .join(', ')}`;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="sr-only">{resumenTexto}</span>
      <div
        aria-hidden="true"
        className="relative shrink-0 rounded-full"
        style={{ width: tamano, height: tamano, background: `conic-gradient(${paradas})` }}
      >
        <div
          className="absolute rounded-full bg-white"
          style={{ inset: Math.round(tamano * 0.19) }}
        />
      </div>
      <ul className="min-w-[140px] flex-1 space-y-1.5 text-[12px]" aria-hidden="true">
        {resueltos.map((s) => (
          <li key={s.nombre} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 truncate text-cuerpo">{s.nombre}</span>
            <span className="shrink-0 font-semibold tabular-nums text-titular">
              {s.pct.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
