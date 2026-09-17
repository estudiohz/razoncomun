import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanearHtml } from '@/lib/blog/html';
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

/**
 * La WordPress vieja publicaba los artículos en la raíz (`/{slug}`, el
 * permalink "postname" de toda la vida) — Google lleva meses con esas URLs
 * indexadas. Al migrar a Next.js los artículos pasaron a vivir bajo
 * `/blog/{slug}` u `/observatorio/{slug}`, y como los slugs NO cambiaron en
 * la migración, cada una de esas URLs viejas da 404 en vez de encontrar su
 * contenido en el sitio nuevo (Sergio/Óscar, 16-18/09/2026: "las noticias no
 * salen posicionadas ni salen en Google" — esta es la causa real, no solo
 * el canonical con www).
 *
 * Se resuelve sin mantener ningún listado de redirecciones a mano: si el
 * slug no es una página del CMS, se comprueba si coincide con un artículo
 * publicado y, si es así, se redirige (301, permanente — así Google
 * transfiere el indexado en vez de tratarlo como una URL nueva) a su ruta
 * real.
 */
async function redireccionArticulo(slug: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('articles')
    .select('slug, source_type')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!data) return null;
  const base = data.source_type === 'observatorio' ? '/observatorio' : '/blog';
  return `${base}/${data.slug}`;
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
  if (!pagina) {
    const destino = await redireccionArticulo(slug);
    if (destino) permanentRedirect(destino);
    notFound();
  }

  return (
    <Contenedor as="section" className="py-14 min-[720px]:py-20">
      <div className="mx-auto max-w-[780px]">
        <h1 className="mb-8 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.1] text-titular">
          {pagina.title}
        </h1>
        <article className="prose-rc" dangerouslySetInnerHTML={{ __html: sanearHtml(pagina.body_html) }} />
      </div>
    </Contenedor>
  );
}
