import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { listarEncuestasVisibles } from '@/lib/participacion/surveys';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Encuestas',
  descripcion: 'Encuestas abiertas de Razón Común, filtradas por tu nivel y territorio.',
  ruta: '/encuestas',
  noindex: true,
});

export default async function EncuestasPage() {
  const supabase = await createClient();
  const encuestas = await listarEncuestasVisibles(supabase); // RLS ya filtra por audiencia/territorio

  return (
    <Contenedor as="section" className="py-14">
      <header className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Escucha activa</span>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] font-extrabold">Encuestas</h1>
        <p className="mx-auto mt-3 max-w-[60ch] text-[15.5px] text-cuerpo">
          Encuestas puntuales, con o sin censo, según lo que el equipo necesite pulsar.
        </p>
      </header>

      <div className="mx-auto mt-10 grid max-w-[720px] gap-4">
        {encuestas.length === 0 && (
          <p className="text-center text-[14.5px] text-gris">No hay encuestas disponibles para ti ahora mismo.</p>
        )}
        {encuestas.map((e) => (
          <Link
            key={e.id}
            href={`/encuestas/${e.id}`}
            className="block rounded-tarjeta border border-linea bg-panel p-5 no-underline hover:-translate-y-0.5 hover:shadow-tarjeta"
          >
            <h2 className="text-[16px] font-bold text-titular">{e.title}</h2>
            {e.description && <p className="mt-1 text-[13.5px] text-cuerpo">{e.description}</p>}
            <p className="mt-2 text-[12.5px] text-gris">
              Cierra {new Date(e.closes_at).toLocaleDateString('es-ES')} · {e.anonymous ? 'Anónima' : 'Con censo'}
            </p>
          </Link>
        ))}
      </div>
    </Contenedor>
  );
}
