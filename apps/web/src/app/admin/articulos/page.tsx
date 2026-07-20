import type { Metadata } from 'next';
import Link from 'next/link';
import { requireEditor } from '@/lib/blog/guard';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Artículos',
  descripcion: 'Gestión de artículos del blog y del observatorio.',
  ruta: '/admin/articulos',
  noindex: true,
});

// Panel interno: nunca debe cachearse ni prerenderizarse.
export const dynamic = 'force-dynamic';

interface Fila {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  source_type: 'editorial' | 'observatorio';
  published_at: string | null;
  created_at: string;
  categoria: { name: string } | { name: string }[] | null;
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default async function ArticulosAdminPage() {
  const { supabase } = await requireEditor();

  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, title, status, source_type, published_at, created_at, categoria:categories(name)')
    .order('created_at', { ascending: false });

  const filas = (data ?? []) as Fila[];
  const nombreCat = (c: Fila['categoria']) => (Array.isArray(c) ? c[0]?.name : c?.name) ?? '—';

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
      ) : filas.length === 0 ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          Todavía no hay artículos. Crea el primero.
        </p>
      ) : (
        <>
          {/* Móvil: lista de tarjetas apiladas — sin scroll horizontal, el
              título aprovecha todo el ancho. */}
          <ul className="rounded-tarjeta border border-linea bg-white min-[720px]:hidden">
            {filas.map((a) => (
              <li key={a.id} className="border-b border-linea/60 p-4 last:border-0">
                <Link
                  href={`/admin/articulos/${a.id}`}
                  className="block text-[16px] font-bold leading-snug text-titular no-underline hover:underline"
                >
                  {a.title}
                </Link>
                <span className="mt-0.5 block break-all text-[12.5px] text-gris">/{a.slug}</span>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="rounded-full bg-fondo px-2.5 py-0.5 font-semibold text-cuerpo">
                    {nombreCat(a.categoria)}
                  </span>
                  <span className="rounded-full bg-fondo px-2.5 py-0.5 font-semibold text-cuerpo">
                    {a.source_type === 'observatorio' ? 'Observatorio' : 'Blog'}
                  </span>
                  <span
                    className={
                      a.status === 'published'
                        ? 'rounded-full bg-accion/10 px-2.5 py-0.5 font-bold text-accion'
                        : 'rounded-full bg-gris/15 px-2.5 py-0.5 font-bold text-gris'
                    }
                  >
                    {a.status === 'published' ? 'Publicado' : 'Borrador'}
                  </span>
                  <span className="text-gris">{fecha(a.published_at)}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla completa. */}
          <div className="hidden overflow-x-auto rounded-tarjeta border border-linea bg-white min-[720px]:block">
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-linea text-[13px] uppercase tracking-[.08em] text-gris">
                <th className="px-5 py-4 font-bold">Título</th>
                <th className="px-5 py-4 font-bold">Categoría</th>
                <th className="px-5 py-4 font-bold">Sección</th>
                <th className="px-5 py-4 font-bold">Estado</th>
                <th className="px-5 py-4 font-bold">Publicado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.id} className="border-b border-linea/60 last:border-0">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/articulos/${a.id}`}
                      className="font-bold text-titular no-underline hover:underline"
                    >
                      {a.title}
                    </Link>
                    <span className="block text-[13px] text-gris">/{a.slug}</span>
                  </td>
                  <td className="px-5 py-4 text-cuerpo">{nombreCat(a.categoria)}</td>
                  <td className="px-5 py-4 text-cuerpo">
                    {a.source_type === 'observatorio' ? 'Observatorio' : 'Blog'}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        a.status === 'published'
                          ? 'rounded-full bg-accion/10 px-3 py-1 text-[13px] font-bold text-accion'
                          : 'rounded-full bg-gris/15 px-3 py-1 text-[13px] font-bold text-gris'
                      }
                    >
                      {a.status === 'published' ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-cuerpo">{fecha(a.published_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
