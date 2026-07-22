import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import type { Pagina } from '@/lib/paginas';

// Ruta comodín de nivel raíz para las páginas del CMS (/privacidad, /aviso-legal,
// /cookies, /estatutos…). Las rutas estáticas (/blog, /pregunta, /admin…) tienen
// prioridad en Next: aquí solo llegan los slugs que no casan con nada más. Si el
// slug no es una página PUBLICADA -> 404.
export const revalidate = 300;
export const dynamicParams = true;

async function obtenerPagina(slug: string): Promise<Pagina | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  return (data as Pagina | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pagina = await obtenerPagina(slug);
  if (!pagina) {
    return metadatosPagina({
      titulo: 'Página no encontrada',
      descripcion: 'La página que buscas no existe.',
      ruta: `/${slug}`,
      noindex: true,
    });
  }
  return metadatosPagina({
    titulo: pagina.title,
    descripcion: `${pagina.title} — Razón Común.`,
    ruta: `/${slug}`,
  });
}

export default async function PaginaCms({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pagina = await obtenerPagina(slug);
  if (!pagina) notFound();

  return (
    <Contenedor as="section" className="py-14 min-[720px]:py-20">
      <div className="mx-auto max-w-[780px]">
        <h1 className="mb-8 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.1] text-titular">
          {pagina.title}
        </h1>
        <article className="prose-rc" dangerouslySetInnerHTML={{ __html: pagina.body_html }} />
      </div>
    </Contenedor>
  );
}
