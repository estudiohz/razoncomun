/**
 * app/pais/PiramidePoblacional.tsx
 *
 * Pirámide de edad (revisión pedida por Sergio: "quizás un gráfico piramidal
 * sea más correcto aquí"). Antes comparaba 2 categorías laborales (activa
 * vs jubilados) con barras espejadas — con solo 2 barras nunca sale la
 * silueta de una pirámide de verdad, eso requiere varias bandas de tamaño
 * decreciente. Ahora usa 3 bandas de EDAD (0-14 / 15-64 / 65+), la partición
 * demográfica estándar (ratio de dependencia por edad, INE/ONU) — bandas
 * mutuamente excluyentes que sí suman el 100% de la población.
 *
 * Cada banda es una barra CENTRADA en un eje vertical (ancho ∝ su
 * población sobre el máximo de las 3) apilada de más joven (abajo) a más
 * mayor (arriba) — el efecto silueta de un vistazo, sin necesitar datos por
 * sexo/quinquenio (eso queda para una iteración aparte, si se quiere la
 * pirámide INE completa).
 *
 * D-S13: informativo, sin lado Razón Común. Si falta cualquiera de las 3
 * bandas, no se renderiza nada — no se fabrica el ratio con datos a medias.
 */

import { cn } from '@/lib/cn';
import type { DemografiaRow } from '@/lib/simulador/adminData';
import { formatoPersonasCorto } from '@/lib/simulador/formato';

interface Banda {
  fila: DemografiaRow;
  etiqueta: string;
}

interface Props {
  edad0a14: DemografiaRow | undefined;
  edad15a64: DemografiaRow | undefined;
  edad65mas: DemografiaRow | undefined;
  /** true cuando vive dentro de la columna compartida junto al donut de
   * composición (SeccionPoblacion, layout 50/50) — el borde/margen superior
   * ya lo pone el contenedor común, no hace falta duplicarlo. */
  sinBorde?: boolean;
}

function BarraBanda({ banda, maxPersonas }: { banda: Banda; maxPersonas: number }) {
  const pct = maxPersonas > 0 ? (banda.fila.num_personas / maxPersonas) * 100 : 0;
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-7 w-full items-center justify-center">
        <div
          className="h-full rounded-full bg-teal transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] font-bold text-cuerpo">
        {banda.etiqueta} · {formatoPersonasCorto(banda.fila.num_personas)}
      </p>
    </div>
  );
}

export function PiramidePoblacional({ edad0a14, edad15a64, edad65mas, sinBorde }: Props) {
  if (
    !edad0a14 ||
    !edad15a64 ||
    !edad65mas ||
    edad0a14.num_personas <= 0 ||
    edad15a64.num_personas <= 0 ||
    edad65mas.num_personas <= 0
  ) {
    return null;
  }

  const maxPersonas = Math.max(edad0a14.num_personas, edad15a64.num_personas, edad65mas.num_personas);
  // Ratio de dependencia por edad (INE/ONU): personas en edad de trabajar
  // (15-64) por cada persona mayor (65+) — el dato accionable de "quién
  // sostiene las pensiones", ahora con bandas de edad puras en vez de
  // categorías laborales.
  const ratio = edad15a64.num_personas / edad65mas.num_personas;

  // De más joven (abajo) a más mayor (arriba) — la silueta de una pirámide
  // se lee de base ancha/joven hacia la punta/mayor.
  const bandas: Banda[] = [
    { fila: edad65mas, etiqueta: '65 años o más' },
    { fila: edad15a64, etiqueta: '15-64 años' },
    { fila: edad0a14, etiqueta: '0-14 años' },
  ];

  return (
    <div className={cn(sinBorde ? '' : 'mt-5 border-t border-linea pt-4')}>
      <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-gris">
        ¿Quién sostiene las pensiones? — pirámide de edad
      </p>
      <p className="text-[15px] font-extrabold text-titular">
        {ratio.toLocaleString('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' })} personas en edad de
        trabajar (15-64) por cada mayor de 65 años
      </p>

      {/* `bandas` va de más mayor a más joven (65+, 15-64, 0-14); con flex-col
          normal el primer elemento del array queda arriba y el último abajo
          — así 0-14 (la base ancha) queda abajo y 65+ (el vértice) arriba,
          la silueta correcta de una pirámide. */}
      <div className="mt-4 flex flex-col gap-1.5">
        {bandas.map((b) => (
          <BarraBanda key={b.etiqueta} banda={b} maxPersonas={maxPersonas} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-gris">
        Fuente: {edad0a14.fuente?.trim() || 'PENDIENTE DE FUENTE'} · {edad15a64.fuente?.trim() || 'PENDIENTE DE FUENTE'} ·{' '}
        {edad65mas.fuente?.trim() || 'PENDIENTE DE FUENTE'}
      </p>
    </div>
  );
}
