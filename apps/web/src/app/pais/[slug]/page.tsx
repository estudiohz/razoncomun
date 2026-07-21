import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { listarDemografia, listarParametros, listarPartidas, subarbol } from '@/lib/simulador/adminData';
import { normalizarRaicesPublicas } from '../normalizar';
import { PanelMinisterio } from './PanelMinisterio';

/**
 * `/pais/[slug]` — página propia de un área raíz del Simulador del
 * Presupuesto del País (D-S11, docs/tecnico/simulador-pais.md §9). Ruta
 * dinámica en vez de N ficheros: resuelve la raíz por `sim_partidas.slug`.
 *
 * Server Component: lee con el cliente `anon` — la RLS de la migración
 * 0029/0030 ya filtra a `publicado=true` sola (mismo patrón que `/pais` y
 * `/blog`). Si ningún área publicada tiene ese slug, `notFound()`.
 */

async function resolverRaizPorSlug(slug: string) {
  const supabase = await createClient();
  const partidasCrudas = await listarPartidas(supabase);
  const partidas = normalizarRaicesPublicas(partidasCrudas);
  const raiz = partidas.find((p) => p.slug === slug && p.parent_id === null);
  return { supabase, partidas, raiz };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { raiz } = await resolverRaizPorSlug(slug);

  if (!raiz) {
    return metadatosPagina({
      titulo: 'Área no encontrada',
      descripcion: 'Esta área del presupuesto no existe o todavía no está publicada.',
      ruta: `/pais/${slug}`,
      noindex: true,
    });
  }

  return metadatosPagina({
    titulo: `${raiz.nombre} — El Presupuesto del País`,
    descripcion: `El presupuesto oficial de ${raiz.nombre}, comparado con el de Razón Común, con fuente oficial y justificación política.`,
    ruta: `/pais/${slug}`,
  });
}

export default async function PaisMinisterioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, partidas, raiz } = await resolverRaizPorSlug(slug);
  if (!raiz) notFound();

  const [parametros, demografia] = await Promise.all([
    listarParametros(supabase),
    listarDemografia(supabase, raiz.id),
  ]);
  const subtree = subarbol(partidas, raiz.id);

  return (
    <Contenedor as="section" className="py-14">
      <Link href="/pais" className="text-[13px] font-semibold text-gris hover:text-titular">
        ← Volver a El País
      </Link>
      <div className="mt-6">
        <PanelMinisterio raizId={raiz.id} parametros={parametros} partidas={subtree} demografia={demografia} />
      </div>
    </Contenedor>
  );
}
