import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { metadatosPagina } from '@/lib/seo';
import { Contenedor } from '@/components/layout/Contenedor';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return metadatosPagina({
    titulo: `Historial del punto ${id} del manifiesto`,
    descripcion: 'Historial público de versiones de un punto del programa de Razón Común.',
    ruta: `/transparencia/manifiesto/${id}`,
  });
}

/**
 * Historial PÚBLICO de un punto del manifiesto (D-013): lectura de
 * `manifesto_point_versions`, RLS `manifesto_point_versions_select_public`
 * (0004_manifesto.sql) — pública sin excepción, es el changelog del
 * programa. Sin cuenta, sin guard.
 */
export default async function HistorialPuntoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const puntoId = Number(id);
  if (!Number.isFinite(puntoId)) notFound();

  const supabase = await createClient();
  const [{ data: punto }, { data: historial }] = await Promise.all([
    supabase.from('manifesto_points').select('id, title, body, version').eq('id', puntoId).single(),
    supabase
      .from('manifesto_point_versions')
      .select('id, version, title, body, created_at, profiles(display_name)')
      .eq('point_id', puntoId)
      .order('version', { ascending: false }),
  ]);

  if (!punto) notFound();

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto max-w-[720px]">
        <Link href="/manifiesto" className="text-[13px] text-gris no-underline hover:underline">
          ← Volver al manifiesto
        </Link>
        <h1 className="mt-3 text-[28px] font-extrabold">
          Historial · {punto.id}. {punto.title}
        </h1>
        <p className="mt-2 text-[14px] text-gris">Versión vigente: v{punto.version}.</p>

        <div className="mt-8 space-y-4">
          <div className="rounded-tarjeta border border-titular/30 bg-fondo p-5">
            <p className="text-[12px] font-bold uppercase text-titular">Vigente · v{punto.version}</p>
            <p className="mt-2 whitespace-pre-wrap text-[14.5px] text-cuerpo">{punto.body}</p>
          </div>

          {(historial ?? []).map((h) => {
            const autor = Array.isArray(h.profiles) ? h.profiles[0] : h.profiles;
            return (
              <div key={h.id} className="rounded-tarjeta border border-linea bg-panel p-5">
                <p className="text-[12px] font-bold uppercase text-gris">
                  v{h.version} · {new Date(h.created_at).toLocaleDateString('es-ES')}
                  {autor?.display_name ? ` · editado por ${autor.display_name}` : ''}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[14.5px] text-gris">{h.body}</p>
              </div>
            );
          })}
          {(historial ?? []).length === 0 && (
            <p className="text-[13.5px] text-gris">
              Todavía no hay versiones anteriores: esta es la primera redacción de este punto.
            </p>
          )}
        </div>
      </div>
    </Contenedor>
  );
}
