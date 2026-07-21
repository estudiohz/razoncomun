import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { listarDemografia, listarParametros, listarPartidas } from '@/lib/simulador/adminData';
import { normalizarRaicesPublicas } from './normalizar';
import { PanelPais } from './PanelPais';

export const metadata: Metadata = metadatosPagina({
  titulo: 'El Presupuesto del País',
  descripcion:
    'Compara el presupuesto oficial de España con el de Razón Común, área a área, con fuente y justificación. Mueve las palancas y mira el efecto en cadena.',
  ruta: '/pais',
});

/**
 * Umbral de áreas raíz publicadas por debajo del cual se muestra el aviso
 * "beta/en construcción" (docs/tecnico/simulador-pais.md §5). El equipo
 * publica área a área desde `/admin/presupuesto`; hasta que haya un mínimo
 * de contenido, el panel avisa de que está creciendo en vez de aparentar
 * estar "completo" con dos áreas sueltas.
 */
const UMBRAL_BETA = 3;

/**
 * `/pais` — panel público del Simulador del Presupuesto del País (ola S2,
 * rc-06). Server Component: lee `sim_parametros`/`sim_partidas` con el
 * cliente `anon` (RLS de la migración 0029 filtra a `publicado=true` sola,
 * sin ningún `if` aquí — el mismo patrón que `/blog` y `/observatorio`).
 *
 * NO se serializa un `ModeloResuelto` aparte para el cliente: `resolver()`
 * es una función pura y determinista (mismos parámetros/partidas, mismo
 * resultado), así que basta con mandar los datos crudos (ya filtrados por
 * RLS, unos KB) y dejar que `PanelPais` los resuelva también — el primer
 * render de cliente coincide exactamente con este HTML de servidor (mismos
 * inputs, sin overrides), sin duplicar el JSON ni arriesgar un desajuste de
 * hidratación.
 */
export default async function PaisPage() {
  const supabase = await createClient();
  const [parametros, partidasCrudas, demografiaPais] = await Promise.all([
    listarParametros(supabase),
    listarPartidas(supabase),
    listarDemografia(supabase, null),
  ]);
  const partidas = normalizarRaicesPublicas(partidasCrudas);

  if (partidas.length === 0) {
    return <EstadoVacio />;
  }

  const raices = partidas.filter((p) => p.parent_id === null);
  const beta = raices.length < UMBRAL_BETA;

  return (
    <Contenedor as="section" className="py-14">
      <PanelPais parametros={parametros} partidas={partidas} beta={beta} demografiaPais={demografiaPais} />
    </Contenedor>
  );
}

function EstadoVacio() {
  return (
    <Contenedor as="section" className="py-20">
      <div className="mx-auto max-w-[640px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Muy pronto</span>
        <h1 className="mt-3 text-[clamp(28px,4vw,42px)] font-extrabold leading-[1.12]">
          El Presupuesto del País
        </h1>
        <p className="mx-auto mt-4 max-w-[56ch] text-[15.5px] text-cuerpo">
          Estamos construyendo la base de datos del país: parámetros reales (BOE, INE, Seguridad Social…) y
          partidas de ingreso y gasto, comparando el presupuesto oficial con el de Razón Común, área a área,
          con fuente y justificación. Todavía no hay ninguna cifra publicada — vuelve pronto.
        </p>
      </div>
    </Contenedor>
  );
}
