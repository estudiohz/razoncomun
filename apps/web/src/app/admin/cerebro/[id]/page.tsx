import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormularioEntrada } from '@/components/brain/FormularioEntrada';
import { requireEditorCerebro } from '@/lib/brain/guard';
import type { AreaTematica, BrainCategoria, BrainEntrada } from '@/lib/brain/tipos';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Editar entrada del cerebro',
  descripcion: 'Editor de la wiki de conocimiento del RC-Brain.',
  ruta: '/admin/cerebro',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default async function EditorEntradaCerebroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireEditorCerebro();

  const [{ data: categorias }, { data: areas }] = await Promise.all([
    supabase.from('brain_categories').select('id, slug, name, position, created_at').order('position'),
    supabase.from('categories').select('id, slug, name, color').order('name'),
  ]);

  let entrada: BrainEntrada | null = null;
  if (id !== 'nuevo') {
    const { data } = await supabase.from('brain_entries').select('*').eq('id', id).maybeSingle();
    if (!data) notFound();
    entrada = data as BrainEntrada;
  }

  return (
    <div className="py-2">
      <Link href="/admin/cerebro" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver al cerebro
      </Link>
      <h1 className="mb-6 mt-3 text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
        {entrada ? 'Editar entrada' : 'Nueva entrada'}
      </h1>
      <FormularioEntrada
        entrada={entrada}
        categorias={(categorias ?? []) as BrainCategoria[]}
        areas={(areas ?? []) as AreaTematica[]}
      />
    </div>
  );
}
