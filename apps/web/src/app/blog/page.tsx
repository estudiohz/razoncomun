import type { Metadata } from 'next';
import { PortadaBlog } from '@/components/blog/PortadaBlog';
import { listarArticulos, listarCategorias } from '@/lib/blog/consultas';
import { metadatosPagina } from '@/lib/seo';

const TITULO = 'Análisis por departamentos';
const DESCRIPCION =
  'Artículos técnicos y basados en datos sobre las áreas de gestión del país. Cada afirmación, con su fuente. Cada dato, verificado antes de publicarse.';

export const metadata: Metadata = metadatosPagina({
  titulo: `Blog · ${TITULO}`,
  descripcion: DESCRIPCION,
  ruta: '/blog',
});

/** ISR: se regenera cada 5 minutos, así una publicación aparece sin redeploy. */
export const revalidate = 300;

export default async function BlogPage() {
  const [articulos, categorias] = await Promise.all([
    listarArticulos({ tipo: 'editorial' }),
    listarCategorias(),
  ]);

  return (
    <PortadaBlog
      eyebrow="El blog de Razón Común"
      titulo={TITULO}
      descripcion={DESCRIPCION}
      articulos={articulos}
      categorias={categorias}
      base="/blog"
    />
  );
}
