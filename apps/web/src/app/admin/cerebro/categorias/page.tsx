import type { Metadata } from 'next';
import Link from 'next/link';
import { requireEditorCerebro } from '@/lib/brain/guard';
import { metadatosPagina } from '@/lib/seo';
import { CategoriasClient, type FilaCategoria } from './CategoriasClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Categorías del cerebro',
  descripcion: 'Taxonomía propia de la wiki de conocimiento.',
  ruta: '/admin/cerebro/categorias',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default async function CategoriasCerebroPage() {
  const { supabase } = await requireEditorCerebro('/admin/cerebro/categorias');

  const [{ data: categorias, error }, { data: entradas }] = await Promise.all([
    supabase.from('brain_categories').select('id, slug, name, position, created_at').order('position'),
    supabase.from('brain_entries').select('category_id'),
  ]);

  const conteos = new Map<string, number>();
  for (const e of entradas ?? []) {
    conteos.set(e.category_id, (conteos.get(e.category_id) ?? 0) + 1);
  }

  const filas: FilaCategoria[] = (categorias ?? []).map((c, i, arr) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    entradas: conteos.get(c.id) ?? 0,
    esPrimera: i === 0,
    esUltima: i === arr.length - 1,
  }));

  return (
    <div className="py-2">
      <Link href="/admin/cerebro" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver al cerebro
      </Link>
      <h1 className="mb-2 mt-3 text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
        Categorías del cerebro
      </h1>
      <p className="mb-6 max-w-2xl text-[13.5px] text-gris">
        La taxonomía propia de la wiki (distinta de las áreas temáticas del blog). El orden aquí es
        el orden en que aparecen los grupos en el listado del cerebro.
      </p>

      {error ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          No se han podido cargar las categorías: {error.message}
        </p>
      ) : (
        <CategoriasClient filas={filas} />
      )}
    </div>
  );
}
