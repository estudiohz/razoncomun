import type { Metadata } from 'next';
import { Placeholder } from '@/components/layout/Placeholder';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Blog · Análisis por departamentos',
  descripcion:
    'Artículos técnicos y basados en datos sobre las áreas de gestión del país. Cada afirmación, con su fuente. Cada dato, verificado antes de publicarse.',
  ruta: '/blog',
});

// NOTA: rc-05 (Blog/Contenido) reemplaza esta ruta por el índice real con
// /blog/[categoria] y /blog/[slug]. Placeholder solo para no romper el nav.
export default function BlogPage() {
  return (
    <Placeholder
      eyebrow="El blog de Razón Común"
      titulo="Análisis por departamentos"
      descripcion="Artículos técnicos y basados en datos sobre las áreas de gestión del país. Cada afirmación, con su fuente; cada dato, verificado antes de publicarse."
      dueño="Blog/Contenido (rc-05)"
    />
  );
}
