import type { Metadata } from 'next';
import Link from 'next/link';
import { requireEditorCerebro } from '@/lib/brain/guard';
import { metadatosPagina } from '@/lib/seo';
import { CerebroClient, IndexarBarra, type FilaEntrada, type GrupoCategoria } from './CerebroClient';

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
  updated_at: string;
  autor: Rel<{ display_name: string | null }>;
  area: Rel<{ name: string; color: string }>;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export default async function CerebroAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; area?: string }>;
}) {
  const { supabase } = await requireEditorCerebro();
  const sp = await searchParams;

  const q = (sp.q ?? '').trim();
  const categoriaSlug = (sp.categoria ?? '').trim();
  const areaId = (sp.area ?? '').trim();

  const [{ data: categorias, error: errorCategorias }, { data: areas }, { count: pendientesCount }] =
    await Promise.all([
      supabase.from('brain_categories').select('id, slug, name, position, created_at').order('position'),
      supabase.from('categories').select('id, slug, name, color').order('name'),
      // Contador global de pendientes de indexar -- deliberadamente SIN los
      // filtros de q/categoria/area de abajo: el botón "Indexar al cerebro"
      // dispara la ingesta de TODAS las entradas pendientes, no solo las que
      // se ven en el listado filtrado.
      supabase.from('brain_entries').select('id', { count: 'exact', head: true }).is('indexed_at', null),
    ]);

  const listaCategorias = categorias ?? [];
  const categoriaFiltro = categoriaSlug ? listaCategorias.find((c) => c.slug === categoriaSlug) : null;

  let consulta = supabase
    .from('brain_entries')
    .select(
      'id, title, category_id, area_id, visibility, indexed_at, updated_at, autor:profiles(display_name), area:categories(name, color)',
    )
    .order('updated_at', { ascending: false });

  if (q) {
    const patron = `%${q.replace(/[,()]/g, ' ')}%`;
    consulta = consulta.or(`title.ilike.${patron},body.ilike.${patron}`);
  }
  if (categoriaFiltro) consulta = consulta.eq('category_id', categoriaFiltro.id);
  if (areaId) consulta = consulta.eq('area_id', Number(areaId));

  const { data: entradas, error: errorEntradas } = await consulta;

  const filas: FilaEntrada[] = (entradas ?? []).map((e) => {
    const f = e as unknown as FilaCruda;
    return {
      id: f.id,
      title: f.title,
      category_id: f.category_id,
      area: uno(f.area),
      visibility: f.visibility,
      indexado: f.indexed_at !== null,
      autor: uno(f.autor)?.display_name ?? null,
      actualizado: fecha(f.updated_at),
    };
  });

  // Agrupación por categoría (en el orden de `position`), incluyendo grupos
  // vacíos: así se ve de un vistazo qué categorías aún no tienen contenido —
  // justo lo que hace útil "estructurar bien" la sección para el cerebro.
  const grupos: GrupoCategoria[] = listaCategorias
    .filter((c) => !categoriaFiltro || c.id === categoriaFiltro.id)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      entradas: filas.filter((f) => f.category_id === c.id),
    }));

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
          grupos={grupos}
          categorias={listaCategorias.map((c) => ({ slug: c.slug, name: c.name }))}
          areas={(areas ?? []).map((a) => ({ id: a.id, name: a.name, color: a.color }))}
          q={q}
          categoriaSlug={categoriaSlug}
          areaId={areaId}
          total={filas.length}
        />
      )}
    </div>
  );
}
