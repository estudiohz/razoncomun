import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormularioArticulo } from '@/components/blog/FormularioArticulo';
import { Contenedor } from '@/components/layout/Contenedor';
import { requireEditor } from '@/lib/blog/guard';
import type { Articulo, Categoria } from '@/lib/blog/tipos';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Editar artículo',
  descripcion: 'Editor de artículos.',
  ruta: '/admin/articulos',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default async function EditorArticuloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireEditor();

  const { data: categorias } = await supabase
    .from('categories')
    .select('id, slug, name, color')
    .order('name');

  let articulo: Articulo | null = null;
  if (id !== 'nuevo') {
    const { data } = await supabase.from('articles').select('*').eq('id', id).maybeSingle();
    if (!data) notFound();
    articulo = data as Articulo;
  }

  return (
    <Contenedor className="py-12">
      <Link href="/admin/articulos" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver a artículos
      </Link>
      <h1 className="mb-8 mt-3 text-[34px] font-bold leading-tight text-titular">
        {articulo ? 'Editar artículo' : 'Nuevo artículo'}
      </h1>
      <FormularioArticulo articulo={articulo} categorias={(categorias ?? []) as Categoria[]} />
    </Contenedor>
  );
}
