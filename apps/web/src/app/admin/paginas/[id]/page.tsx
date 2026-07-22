import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEditor } from '@/lib/blog/guard';
import { FormularioPagina } from '@/components/paginas/FormularioPagina';
import type { Pagina } from '@/lib/paginas';

export const dynamic = 'force-dynamic';

export default async function EditorPaginaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireEditor();

  let pagina: Pagina | null = null;
  if (id !== 'nueva') {
    const { data } = await supabase.from('pages').select('*').eq('id', id).maybeSingle();
    if (!data) notFound();
    pagina = data as Pagina;
  }

  return (
    <div className="py-2">
      <Link href="/admin/paginas" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver a páginas
      </Link>
      <h1 className="mb-6 mt-3 text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
        {pagina ? 'Editar página' : 'Nueva página'}
      </h1>
      <FormularioPagina pagina={pagina} />
    </div>
  );
}
