import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { listarVotaciones, estadoVentana } from '@/lib/participacion/votes';
import type { Propuesta, Vote } from '@/lib/participacion/types';
import { cn } from '@/lib/cn';

type VotacionConPropuesta = Vote & { proposal: Propuesta | null };

export const metadata: Metadata = metadatosPagina({
  titulo: 'Votaciones',
  descripcion:
    'Votaciones vinculantes de Razón Común: censo congelado al abrir, resultados públicos con participación y quórum.',
  ruta: '/votaciones',
  noindex: true,
});

const ETIQUETA_VENTANA: Record<ReturnType<typeof estadoVentana>, string> = {
  pendiente: 'Programada',
  abierta: 'Abierta ahora',
  cerrada: 'Cerrada',
};

const COLOR_VENTANA: Record<ReturnType<typeof estadoVentana>, string> = {
  pendiente: 'bg-linea text-cuerpo',
  abierta: 'bg-accion text-white',
  cerrada: 'bg-gris text-white',
};

export default async function VotacionesPage() {
  const supabase = await createClient();
  const votaciones = await listarVotaciones(supabase);

  const abiertas = votaciones.filter((v) => estadoVentana(v) === 'abierta');
  const otras = votaciones.filter((v) => estadoVentana(v) !== 'abierta');

  return (
    <Contenedor as="section" className="py-14">
      <header className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Democracia semidirecta</span>
        <h1 className="mt-3 text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.12]">Votaciones</h1>
        <p className="mx-auto mt-3 max-w-[62ch] text-[16px] text-cuerpo">
          Censo congelado al abrir. Voto vinculante para afiliados activos con ≥3 meses de
          antigüedad; consultivo para el resto de registrados. Resultados siempre públicos, con
          participación y quórum.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-[860px] space-y-10">
        {votaciones.length === 0 && (
          <p className="text-center text-[15px] text-gris">Todavía no hay votaciones convocadas.</p>
        )}

        {abiertas.length > 0 && (
          <section>
            <h2 className="text-[16px] font-extrabold uppercase tracking-[.04em] text-titular">Abiertas ahora</h2>
            <div className="mt-4 grid gap-4">
              {abiertas.map((v) => (
                <TarjetaVotacion key={v.id} v={v} />
              ))}
            </div>
          </section>
        )}

        {otras.length > 0 && (
          <section>
            <h2 className="text-[16px] font-extrabold uppercase tracking-[.04em] text-titular">
              Programadas y cerradas
            </h2>
            <div className="mt-4 grid gap-4">
              {otras.map((v) => (
                <TarjetaVotacion key={v.id} v={v} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Contenedor>
  );
}

function TarjetaVotacion({ v }: { v: VotacionConPropuesta }) {
  const ventana = estadoVentana(v);
  return (
    <Link
      href={`/votaciones/${v.id}`}
      className="block rounded-tarjeta border border-linea bg-panel p-6 no-underline transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-tarjeta"
    >
      <span
        className={cn(
          'inline-flex items-center rounded-lg px-2.5 py-1 text-[11.5px] font-extrabold uppercase tracking-[.05em]',
          COLOR_VENTANA[ventana],
        )}
      >
        {ETIQUETA_VENTANA[ventana]}
      </span>
      <h3 className="mt-3 text-[18px] font-extrabold text-titular">
        {v.proposal?.title ?? 'Propuesta eliminada'}
      </h3>
      <p className="mt-1.5 text-[13.5px] text-gris">
        {new Date(v.opens_at).toLocaleDateString('es-ES')} — {new Date(v.closes_at).toLocaleDateString('es-ES')} ·
        Ámbito: {v.scope === 'manifesto' ? 'Manifiesto (verificados)' : 'Departamento'}
      </p>
    </Link>
  );
}
