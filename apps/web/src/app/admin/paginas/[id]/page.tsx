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
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
          {pagina ? 'Editar página' : 'Nueva página'}
        </h1>
        {pagina && (
          <a
            href={`/${pagina.slug}`}
            target="_blank"
            rel="noopener"
            title={pagina.published ? 'Ver en la web' : 'Borrador: no es visible en la web hasta publicarla'}
            aria-label="Ver la página en la web"
            className="inline-flex items-center gap-1.5 rounded-boton border border-linea px-3 py-1.5 text-[13px] font-semibold text-gris no-underline hover:text-titular"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Ver en la web
          </a>
        )}
      </div>
      <FormularioPagina pagina={pagina} />
    </div>
  );
}
