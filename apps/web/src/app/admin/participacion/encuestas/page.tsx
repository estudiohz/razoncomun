import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import { listarEncuestasVisibles } from '@/lib/participacion/surveys';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Encuestas',
  descripcion: 'Constructor de encuestas de Razón Común.',
  ruta: '/admin/participacion/encuestas',
  noindex: true,
});

export default async function AdminEncuestasPage() {
  const { supabase } = await requireAdminOCoordinador('/admin/participacion/encuestas');
  const encuestas = await listarEncuestasVisibles(supabase);

  return (
    <Contenedor as="section" className="py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] font-extrabold text-titular">Encuestas</h1>
        <Link
          href="/admin/participacion/encuestas/nueva"
          className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white shadow-boton"
        >
          + Nueva encuesta
        </Link>
      </div>

      <div className="mt-8 grid gap-4">
        {encuestas.length === 0 && <p className="text-[14.5px] text-gris">Todavía no hay encuestas.</p>}
        {encuestas.map((e) => (
          <div key={e.id} className="rounded-tarjeta border border-linea bg-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[16px] font-bold text-titular">{e.title}</h2>
              <Link href={`/encuestas/${e.id}`} className="text-[13px] font-semibold text-titular underline">
                Ver pública →
              </Link>
            </div>
            <p className="mt-1 text-[13px] text-gris">
              Audiencia: {e.audience} · {e.anonymous ? 'Anónima' : 'Con censo'} · Resultados:{' '}
              {e.results_visibility} · Cierra {new Date(e.closes_at).toLocaleString('es-ES')}
            </p>
          </div>
        ))}
      </div>
    </Contenedor>
  );
}
