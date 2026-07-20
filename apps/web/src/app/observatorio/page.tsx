import type { Metadata } from 'next';
import { PortadaBlog } from '@/components/blog/PortadaBlog';
import { listarArticulos, listarCategorias } from '@/lib/blog/consultas';
import { metadatosPagina } from '@/lib/seo';

const TITULO = 'Los datos oficiales, en lenguaje claro';
const DESCRIPCION =
  'Análisis diario a partir de fuentes oficiales (INE, Eurostat, BOE, Banco de España), traducido a lenguaje claro y verificado antes de publicarse. Siempre con la fuente enlazada.';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Observatorio de datos',
  descripcion: DESCRIPCION,
  ruta: '/observatorio',
});

export const revalidate = 300;

/**
 * El observatorio es el mismo módulo de contenido que el blog: mismos
 * componentes, mismas consultas, y solo cambia `source_type='observatorio'`.
 * Ese feed lo alimenta rc-08 desde n8n.
 */
export default async function ObservatorioPage() {
  const [articulos, categorias] = await Promise.all([
    listarArticulos({ tipo: 'observatorio' }),
    listarCategorias(),
  ]);

  return (
    <PortadaBlog
      eyebrow="Observatorio"
      titulo={TITULO}
      descripcion={DESCRIPCION}
      articulos={articulos}
      categorias={categorias}
      base="/observatorio"
    />
  );
}
