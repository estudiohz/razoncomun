import type { Propuesta } from '@/lib/participacion/types';

type ConSimulacion = Pick<Propuesta, 'simulation_pdf_url' | 'simulation_at' | 'simulation_result' | 'updated_at'>;

function fecha(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Etiqueta morada junto a la categoría. Sin PDF de simulación no se pinta nada. */
export function EtiquetaSimulacion({ propuesta }: { propuesta: Pick<Propuesta, 'simulation_pdf_url'> }) {
  if (!propuesta.simulation_pdf_url) return null;
  return (
    <span className="rounded-lg bg-morado px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[.05em] text-white">
      Simulación con IA
    </span>
  );
}

/**
 * Casilla con el degradado de marca, antes de la autoría. Lleva el resultado, un aviso de
 * que es orientativa y el PDF. Si la propuesta se editó después de simular, lo dice.
 */
export function CasillaSimulacion({ propuesta }: { propuesta: ConSimulacion }) {
  if (!propuesta.simulation_pdf_url) return null;
  // La fecha de simulación es un día; si la propuesta se tocó un día después o más, la simulación es de otra versión.
  const desactualizada =
    propuesta.simulation_at !== null &&
    new Date(propuesta.updated_at).getTime() > new Date(`${propuesta.simulation_at}T23:59:59`).getTime();

  return (
    <div className="mt-6 rounded-tarjeta bg-grad-full p-[1.5px]">
      <div className="rounded-[calc(theme(borderRadius.tarjeta)-1px)] bg-panel p-5">
        <p className="bg-grad-full bg-clip-text text-[16px] font-extrabold leading-snug text-transparent">
          Esta propuesta se ha simulado a su vez en un entorno de IA
          {propuesta.simulation_at && (
            <span className="ml-2 text-[13px] font-semibold text-gris [-webkit-text-fill-color:currentColor]">
              {fecha(propuesta.simulation_at)}
            </span>
          )}
        </p>
        {propuesta.simulation_result && (
          <p className="mt-2 whitespace-pre-line text-[14.5px] text-cuerpo">{propuesta.simulation_result}</p>
        )}
        {desactualizada && (
          <p className="mt-2 text-[13px] font-semibold text-naranja">
            La propuesta se ha editado después de esta simulación: el informe corresponde a una versión anterior.
          </p>
        )}
        <p className="mt-2 text-[12.5px] text-gris">
          Es una simulación orientativa con agentes de IA: no es una predicción ni una decisión. Decide el voto de los
          socios.
        </p>
        <a
          href={propuesta.simulation_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-boton bg-grad px-5 py-2.5 text-[13.5px] font-bold text-white no-underline shadow-boton"
        >
          Descargar PDF simulación
        </a>
      </div>
    </div>
  );
}
