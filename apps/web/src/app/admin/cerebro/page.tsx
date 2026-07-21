import type { Metadata } from 'next';
import Link from 'next/link';
import { requireEditorCerebro } from '@/lib/brain/guard';
import { metadatosPagina } from '@/lib/seo';
import { CerebroClient, IndexarBarra, type FilaEntrada } from './CerebroClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Cerebro',
  descripcion: 'Wiki de conocimiento que alimenta el RC-Brain.',
  ruta: '/admin/cerebro',
  noindex: true,
});

// Panel interno: nunca debe cachearse ni prerenderizarse.
export const dynamic = 'force-dynamic';

type Rel<T> = T | T[] | null;
const uno = <T,>(v: Rel<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

interface FilaCruda {
  id: string;
  title: string;
  category_id: string;
  area_id: number | null;
  visibility: 'internal' | 'public';
  indexed_at: string | null;
  embed_html: string | null;
  updated_at: string;
  autor: Rel<{ display_name: string | null }>;
  categoria: Rel<{ name: string }>;
  area: Rel<{ name: string; color: string }>;
}

/** Tamaños de página admitidos; el resto cae al por defecto. */
const POR_PAGINA = [10, 25, 50, 100] as const;
const POR_DEFECTO = 25;

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

function entero(valor: string | undefined, min: number, porDefecto: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= min ? n : porDefecto;
}

export default async function CerebroAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; area?: string; page?: string; per?: string }>;
}) {
  const { supabase } = await requireEditorCerebro();
  const sp = await searchParams;

  const q = (sp.q ?? '').trim();
  const categoriaSlug = (sp.categoria ?? '').trim();
  const areaId = (sp.area ?? '').trim();
  const perPedido = entero(sp.per, 1, POR_DEFECTO);
  const per = POR_PAGINA.includes(perPedido as (typeof POR_PAGINA)[number]) ? perPedido : POR_DEFECTO;
  const page = entero(sp.page, 1, 1);

  const [
    { data: categorias, error: errorCategorias },
    { data: areas },
    { count: pendientesCount },
    { count: contribPendientes },
  ] = await Promise.all([
    supabase.from('brain_categories').select('id, slug, name, position, created_at').order('position'),
    supabase.from('categories').select('id, slug, name, color').order('name'),
    // Contador global de pendientes de indexar -- deliberadamente SIN filtros:
    // el botón "Indexar al cerebro" procesa TODAS las pendientes, no solo las
    // que se ven en el listado filtrado.
    supabase.from('brain_entries').select('id', { count: 'exact', head: true }).is('indexed_at', null),
    // Contribuciones ciudadanas pendientes de revisión (nueva + triaged).
    supabase
      .from('brain_contributions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['nueva', 'triaged']),
  ]);

  const listaCategorias = categorias ?? [];
  const categoriaFiltro = categoriaSlug ? listaCategorias.find((c) => c.slug === categoriaSlug) : null;

  let consulta = supabase
    .from('brain_entries')
    .select(
      'id, title, category_id, area_id, visibility, indexed_at, embed_html, updated_at, autor:profiles(display_name), categoria:brain_categories(name), area:categories(name, color)',
      { count: 'exact' },
    )
    .order('updated_at', { ascending: false });

  if (q) {
    const patron = `%${q.replace(/[,()]/g, ' ')}%`;
    consulta = consulta.or(`title.ilike.${patron},body.ilike.${patron}`);
  }
  if (categoriaFiltro) consulta = consulta.eq('category_id', categoriaFiltro.id);
  if (areaId) consulta = consulta.eq('area_id', Number(areaId));

  const desde = (page - 1) * per;
  const { data: entradas, error: errorEntradas, count } = await consulta.range(desde, desde + per - 1);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / per));

  const filas: FilaEntrada[] = (entradas ?? []).map((e) => {
    const f = e as unknown as FilaCruda;
    return {
      id: f.id,
      title: f.title,
      categoria: uno(f.categoria)?.name ?? '—',
      area: uno(f.area),
      visibility: f.visibility,
      indexado: f.indexed_at !== null,
      tieneSimulador: Boolean(f.embed_html),
      autor: uno(f.autor)?.display_name ?? null,
      actualizado: fecha(f.updated_at),
    };
  });

  const error = errorCategorias ?? errorEntradas;

  return (
    <div className="py-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[.12em] text-accion">Panel</p>
          <h1 className="text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
            Cerebro
          </h1>
          <p className="mt-1 text-[13.5px] text-gris">
            Wiki de conocimiento: lo que suba el equipo aquí es lo que el chat ciudadano y el
            equipo interno pueden encontrar en el RC-Brain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/cerebro/contribuciones"
            className="relative rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px] font-bold text-titular hover:border-titular"
          >
            Contribuciones
            {(contribPendientes ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex min-w-[20px] items-center justify-center rounded-full bg-naranja px-1.5 py-0.5 text-[11px] font-bold text-white">
                {contribPendientes}
              </span>
            )}
          </Link>
          <Link
            href="/admin/cerebro/categorias"
            className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[14px] font-bold text-titular hover:border-titular"
          >
            Categorías
          </Link>
          <Link
            href="/admin/cerebro/nuevo"
            className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white shadow-boton transition-transform hover:-translate-y-0.5"
          >
            Nueva entrada
          </Link>
        </div>
      </div>

      <IndexarBarra pendientes={pendientesCount ?? 0} />

      {error ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          No se ha podido cargar el cerebro: {error.message}
        </p>
      ) : (
        <CerebroClient
          filas={filas}
          categorias={listaCategorias.map((c) => ({ slug: c.slug, name: c.name }))}
          areas={(areas ?? []).map((a) => ({ id: a.id, name: a.name, color: a.color }))}
          q={q}
          categoriaSlug={categoriaSlug}
          areaId={areaId}
          page={page}
          per={per}
          total={total}
          totalPaginas={totalPaginas}
          tamanos={[...POR_PAGINA]}
        />
      )}
    </div>
  );
}
