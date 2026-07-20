import type { Metadata } from 'next';
import Link from 'next/link';
import { requireEditor } from '@/lib/blog/guard';
import { metadatosPagina } from '@/lib/seo';
import { ArticulosClient, type FilaArticulo } from './ArticulosClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Artículos',
  descripcion: 'Gestión de artículos del blog y del observatorio.',
  ruta: '/admin/articulos',
  noindex: true,
});

// Panel interno: nunca debe cachearse ni prerenderizarse.
export const dynamic = 'force-dynamic';

type Rel<T> = T | T[] | null;

interface Fila {
  id: string;
  title: string;
  status: 'draft' | 'published';
  source_type: 'editorial' | 'observatorio';
  cover_image: string | null;
  published_at: string | null;
  created_at: string;
  categoria: Rel<{ name: string }>;
  autor: Rel<{ display_name: string | null }>;
}

const uno = <T,>(v: Rel<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Tamaños de página admitidos; el resto se ignora y cae al por defecto. */
const POR_PAGINA = [10, 25, 50, 100] as const;
const POR_DEFECTO = 25;

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';


function entero(valor: string | undefined, min: number, porDefecto: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min ? n : porDefecto;
}

export default async function ArticulosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; per?: string }>;
}) {
  const { supabase } = await requireEditor();
  const sp = await searchParams;

  const q = (sp.q ?? '').trim();
  const perPedido = entero(sp.per, 1, POR_DEFECTO);
  const per = POR_PAGINA.includes(perPedido as (typeof POR_PAGINA)[number]) ? perPedido : POR_DEFECTO;
  const page = entero(sp.page, 1, 1);

  let consulta = supabase
    .from('articles')
    .select(
      'id, title, status, source_type, cover_image, published_at, created_at, categoria:categories(name), autor:profiles(display_name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (q) {
    // Escapamos comas y paréntesis: romperían la sintaxis del filtro `or` de PostgREST.
    const patron = `%${q.replace(/[,()]/g, ' ')}%`;
    consulta = consulta.or(`title.ilike.${patron},slug.ilike.${patron}`);
  }

  const desde = (page - 1) * per;
  const { data, error, count } = await consulta.range(desde, desde + per - 1);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / per));
  const filas: FilaArticulo[] = (data ?? []).map((a) => {
    const f = a as unknown as Fila;
    return {
      id: f.id,
      title: f.title,
      status: f.status,
      seccion: f.source_type === 'observatorio' ? 'Observatorio' : 'Blog',
      categoria: uno(f.categoria)?.name ?? '—',
      autor: uno(f.autor)?.display_name ?? null,
      portada: f.cover_image,
      publicado: fecha(f.published_at),
    };
  });

  return (
    <div className="py-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[.12em] text-accion">Panel</p>
          <h1 className="text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
            Artículos
          </h1>
        </div>
        <Link
          href="/admin/articulos/nuevo"
          className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white shadow-boton transition-transform hover:-translate-y-0.5"
        >
          Nuevo artículo
        </Link>
      </div>

      {error ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          No se han podido cargar los artículos: {error.message}
        </p>
      ) : (
        <ArticulosClient
          filas={filas}
          total={total}
          page={page}
          per={per}
          q={q}
          totalPaginas={totalPaginas}
          tamanos={[...POR_PAGINA]}
        />
      )}
    </div>
  );
}
