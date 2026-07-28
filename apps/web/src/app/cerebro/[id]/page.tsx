import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { Contenedor } from '@/components/layout/Contenedor';
import { CuerpoArticulo } from '@/components/blog/CuerpoArticulo';
import { renderizarMarkdown } from '@/lib/blog/markdown';
import { metadatosPagina } from '@/lib/seo';

/**
 * Vista pública de solo lectura de una entrada del cerebro (0024_brain_wiki),
 * enlazada desde las citas de "Pregunta a Razón Común" ([1] título → aquí).
 *
 * Mismo criterio de seguridad que /api/cerebro/embed/[id]: `brain_entries`
 * está cerrada por RLS a anon/authenticated, así que se lee con
 * `service_role` y ESTE handler aplica el filtro `visibility='public'`
 * (interno o inexistente => 404).
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function obtenerEntradaPublica(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('brain_entries')
    .select('id, title, body, visibility')
    .eq('id', id)
    .maybeSingle();
  if (!data || data.visibility !== 'public') return null;
  return data as { id: string; title: string; body: string };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const entrada = await obtenerEntradaPublica(id);
  if (!entrada) {
    return metadatosPagina({
      titulo: 'Entrada no encontrada',
      descripcion: 'Esta entrada del cerebro de Razón Común no existe o no es pública.',
      ruta: `/cerebro/${id}`,
      noindex: true,
    });
  }
  return metadatosPagina({
    titulo: entrada.title,
    descripcion: `${entrada.title} — cerebro de Razón Común.`,
    ruta: `/cerebro/${entrada.id}`,
  });
}

export default async function EntradaCerebroPublicaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entrada = await obtenerEntradaPublica(id);
  if (!entrada) notFound();

  const { html } = renderizarMarkdown(entrada.body);

  return (
    <Contenedor as="article" className="py-10 min-[720px]:py-14">
      <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-teal-texto">
        Cerebro de Razón Común
      </p>
      <h1 className="mb-8 text-[26px] font-extrabold leading-tight text-titular min-[720px]:text-[34px]">
        {entrada.title}
      </h1>
      <CuerpoArticulo html={html} />
    </Contenedor>
  );
}
