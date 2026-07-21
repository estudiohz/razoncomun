import type { GraficoSpec } from '@/lib/brain/tipos';
import { cn } from '@/lib/cn';

// Componente de PRESENTACIÓN puro (sin hooks) -> se puede usar tanto en el
// editor del admin (client) como en el chat ciudadano (client) o donde haga
// falta. Pinta barras con divs (nada de librerías externas: presupuesto 0 y
// self-hosted) o una tabla, según spec.type.

function formatearValor(v: number, unit?: string): string {
  const n = new Intl.NumberFormat('es-ES').format(v);
  return unit ? `${n} ${unit}` : n;
}

function Barras({ spec }: { spec: GraficoSpec }) {
  const max = Math.max(...spec.data.map((d) => d.value), 0);
  return (
    <div className="space-y-2">
      {spec.data.map((fila, i) => {
        // Ancho proporcional al máximo; un mínimo del 2% para que un valor > 0
        // muy pequeño siga siendo visible. Valor 0 (p. ej. "Cuota Cero") = sin barra.
        const pct = max > 0 && fila.value > 0 ? Math.max((fila.value / max) * 100, 2) : 0;
        return (
          <div
            key={i}
            className="grid grid-cols-[minmax(84px,32%)_1fr_auto] items-center gap-3 text-[13px]"
          >
            <span className="truncate text-cuerpo" title={fila.label}>
              {fila.label}
            </span>
            <span className="h-4 overflow-hidden rounded-full bg-fondo">
              <span className="block h-full rounded-full bg-accion" style={{ width: `${pct}%` }} />
            </span>
            <span className="whitespace-nowrap font-bold tabular-nums text-titular">
              {formatearValor(fila.value, spec.unit)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Tabla({ spec }: { spec: GraficoSpec }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <tbody>
          {spec.data.map((fila, i) => (
            <tr key={i} className="border-b border-linea/60 last:border-0">
              <td className="py-2 pr-4 text-cuerpo">{fila.label}</td>
              <td className="py-2 text-right font-bold tabular-nums text-titular">
                {formatearValor(fila.value, spec.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pinta un gráfico de barras o una tabla a partir de su spec. Null si no hay datos. */
export function GraficoRC({ spec, className }: { spec: GraficoSpec; className?: string }) {
  if (!spec?.data?.length) return null;
  return (
    <figure className={cn('rounded-tarjeta border border-linea bg-white p-4', className)}>
      {spec.title ? (
        <figcaption className="mb-1 text-[13.5px] font-bold text-titular">{spec.title}</figcaption>
      ) : null}
      {spec.note ? <p className="mb-3 text-[12px] text-gris">{spec.note}</p> : null}
      {spec.type === 'table' ? <Tabla spec={spec} /> : <Barras spec={spec} />}
    </figure>
  );
}
