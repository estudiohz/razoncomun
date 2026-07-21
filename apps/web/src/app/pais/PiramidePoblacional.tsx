/**
 * app/pais/PiramidePoblacional.tsx
 *
 * "¿Quién sostiene las pensiones?" (segunda revisión, Sergio: la versión de
 * bandas de edad puras "está mal"). Ahora son 4 categorías de arriba a
 * abajo, más directas para la pregunta de sostenibilidad:
 *   1. Pensionistas (jubilación, viudedad, orfandad, incapacidad) + personas
 *      con ayudas y dependientes — UNA barra apilada de 2 colores (el total
 *      arriba, cada segmento con su % — pasa el ratón por encima de cada
 *      color para el detalle exacto).
 *   2. Cotizantes (quienes sostienen el sistema con sus cotizaciones) — 1 color.
 *   3. Estudiantes.
 *   4. Niños.
 *
 * "Cotizantes" y "Pensionistas"/"Personas con ayudas y dependientes" son
 * filas de `sim_demografia` NUEVAS y EXCLUSIVAS de este gráfico (excluidas
 * del donut de composición social/laboral y de la cuadrícula de tarjetas,
 * mismo motivo que "Población activa": son una mirada distinta de la
 * población, mezclarlas contaría gente dos veces). "Estudiantes"/"Niños" SÍ
 * son las mismas filas que ya se muestran como tarjetas normales.
 *
 * D-S13: informativo, sin lado Razón Común. Si falta cualquiera de las 4
 * categorías, no se renderiza nada — no se fabrica el ratio con datos a medias.
 */

import type { DemografiaRow } from '@/lib/simulador/adminData';
import { formatoPersonasCorto } from '@/lib/simulador/formato';
import { FuenteTexto } from './FuenteTexto';

interface Props {
  pensionistas: DemografiaRow | undefined;
  ayudasDependientes: DemografiaRow | undefined;
  cotizantes: DemografiaRow | undefined;
  estudiantes: DemografiaRow | undefined;
  ninos: DemografiaRow | undefined;
  /** true cuando vive dentro de la columna compartida junto al donut de
   * composición (SeccionPoblacion, layout 50/50) — el borde/margen superior
   * ya lo pone el contenedor común, no hace falta duplicarlo. */
  sinBorde?: boolean;
}

function pct(parte: number, total: number): string {
  return total > 0 ? `${((parte / total) * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%` : '—';
}

/** Barra de un único color, con su etiqueta y cifra. */
function BarraSimple({ etiqueta, personas, maxPersonas, color }: { etiqueta: string; personas: number; maxPersonas: number; color: string }) {
  const anchoPct = maxPersonas > 0 ? (personas / maxPersonas) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11.5px] font-bold text-cuerpo">
        <span>{etiqueta}</span>
        <span className="tabular-nums text-titular">{formatoPersonasCorto(personas)}</span>
      </div>
      <div className="mt-1 h-6 overflow-hidden rounded-full bg-fondo">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${anchoPct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/** Barra apilada de 2 colores (Pensionistas + Ayudas/dependientes) — el total
 * fija el ancho relativo al máximo del gráfico; dentro, cada segmento ocupa
 * su % real. Interactiva: pasar el ratón por un segmento muestra su cifra y
 * % exactos (title = tooltip nativo, sin JS extra). */
function BarraApilada({
  pensionistas,
  ayudas,
  maxPersonas,
}: {
  pensionistas: DemografiaRow;
  ayudas: DemografiaRow;
  maxPersonas: number;
}) {
  const total = pensionistas.num_personas + ayudas.num_personas;
  const anchoTotalPct = maxPersonas > 0 ? (total / maxPersonas) * 100 : 0;
  const pctPensionistas = pct(pensionistas.num_personas, total);
  const pctAyudas = pct(ayudas.num_personas, total);

  return (
    <div>
      <div className="flex items-baseline justify-between text-[11.5px] font-bold text-cuerpo">
        <span>Pensionistas y dependientes</span>
        <span className="tabular-nums text-titular">{formatoPersonasCorto(total)}</span>
      </div>
      <div className="mt-1 flex h-6 overflow-hidden rounded-full bg-fondo" style={{ width: `${anchoTotalPct}%` }}>
        <div
          title={`Pensionistas (jubilación, viudedad, orfandad, incapacidad): ${formatoPersonasCorto(pensionistas.num_personas)} · ${pctPensionistas}`}
          className="h-full bg-magenta transition-opacity hover:opacity-80"
          style={{ width: `${(pensionistas.num_personas / total) * 100}%` }}
        />
        <div
          title={`Personas con ayudas y dependientes: ${formatoPersonasCorto(ayudas.num_personas)} · ${pctAyudas}`}
          className="h-full bg-naranja transition-opacity hover:opacity-80"
          style={{ width: `${(ayudas.num_personas / total) * 100}%` }}
        />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-gris">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-magenta" aria-hidden="true" />
          Pensionistas {pctPensionistas} ({formatoPersonasCorto(pensionistas.num_personas)})
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-naranja" aria-hidden="true" />
          Ayudas y dependientes {pctAyudas} ({formatoPersonasCorto(ayudas.num_personas)})
        </span>
      </div>
    </div>
  );
}

export function PiramidePoblacional({ pensionistas, ayudasDependientes, cotizantes, estudiantes, ninos, sinBorde }: Props) {
  if (
    !pensionistas ||
    !ayudasDependientes ||
    !cotizantes ||
    !estudiantes ||
    !ninos ||
    pensionistas.num_personas <= 0 ||
    ayudasDependientes.num_personas <= 0 ||
    cotizantes.num_personas <= 0 ||
    estudiantes.num_personas <= 0 ||
    ninos.num_personas <= 0
  ) {
    return null;
  }

  const totalPensionistasYAyudas = pensionistas.num_personas + ayudasDependientes.num_personas;
  const maxPersonas = Math.max(totalPensionistasYAyudas, cotizantes.num_personas, estudiantes.num_personas, ninos.num_personas);
  // El dato accionable: cuántos cotizantes sostienen a cada persona
  // pensionista o dependiente.
  const ratio = cotizantes.num_personas / totalPensionistasYAyudas;

  const fuentesUnicas = Array.from(
    new Map(
      [pensionistas, ayudasDependientes, cotizantes, estudiantes, ninos].map((f) => {
        const texto = f.fuente?.trim() || 'PENDIENTE DE FUENTE';
        const url = f.fuente_url?.trim() || null;
        return [`${texto}|${url ?? ''}`, { texto, url }] as const;
      }),
    ).values(),
  );

  return (
    <div className={sinBorde ? '' : 'mt-5 border-t border-linea pt-4'}>
      <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-gris">¿Quién sostiene las pensiones?</p>
      <p className="text-[15px] font-extrabold text-titular">
        {ratio.toLocaleString('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' })} cotizantes por cada
        persona pensionista o dependiente
      </p>

      {/* De arriba a abajo: pensionistas+ayudas (apilada) → cotizantes →
          estudiantes → niños — el orden literal pedido por Sergio. */}
      <div className="mt-4 flex flex-col gap-3">
        <BarraApilada pensionistas={pensionistas} ayudas={ayudasDependientes} maxPersonas={maxPersonas} />
        <BarraSimple etiqueta="Cotizantes" personas={cotizantes.num_personas} maxPersonas={maxPersonas} color="#16B8A0" />
        <BarraSimple etiqueta="Estudiantes" personas={estudiantes.num_personas} maxPersonas={maxPersonas} color="#2BC7E8" />
        <BarraSimple etiqueta="Niños" personas={ninos.num_personas} maxPersonas={maxPersonas} color="#8B30D9" />
      </div>

      <p className="mt-3 text-[11px] text-gris">
        Fuente:{' '}
        {fuentesUnicas.map((f, i) => (
          <span key={f.texto + (f.url ?? '')}>
            {i > 0 && ' · '}
            <FuenteTexto texto={f.texto} url={f.url} />
          </span>
        ))}
      </p>
    </div>
  );
}
