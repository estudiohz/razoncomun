import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { contarReportesAbiertos } from '@/lib/participacion/reports';
import { contarBorradores } from '@/lib/participacion/drafts';
import {
  ETIQUETA_ESTADO,
  ORDEN_ESTADOS,
  type EstadoPropuesta,
  type Propuesta,
} from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Participación',
  descripcion: 'Tablero de propuestas: moderación, estados y fusión de duplicados.',
  ruta: '/admin/participacion',
  noindex: true,
});

export const dynamic = 'force-dynamic';

/**
 * Participación = el tablero de propuestas, directamente.
 *
 * Antes esta ruta era un hub con cuatro botones y ningún dato: entrar aquí
 * obligaba a un clic más para ver lo único que se consulta a diario (las
 * propuestas). Ahora el listado ES la página, y el resto de secciones
 * (borradores, categorías, reportes, encuestas) viven en la barra de arriba
 * con su contador. `/admin/participacion/propuestas` redirige aquí (308).
 */
export default async function AdminParticipacionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; categoria?: string }>;
}) {
  const { supabase } = await requireAdminOrEditor('/admin/participacion');
  const params = await searchParams;

  const [{ data: categorias }, reportesAbiertos, borradores] = await Promise.all([
    supabase.from('proposal_categories').select('id, nombre, color').order('orden'),
    contarReportesAbiertos(supabase).catch(() => 0),
    contarBorradores(supabase).catch(() => 0),
  ]);
  const mapaCategorias = new Map((categorias ?? []).map((c) => [c.id, c]));

  let query = supabase
    .from('proposals')
    .select(
      'id, title, slug, status, category_id, support_count, deadline_at, created_at, autor:profiles!proposals_author_id_fkey(display_name)',
    )
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.categoria) query = query.eq('category_id', params.categoria);

  const { data, error } = await query;
  const propuestas = (data ?? []) as unknown as (Pick<
    Propuesta,
    'id' | 'title' | 'slug' | 'status' | 'category_id' | 'support_count' | 'deadline_at' | 'created_at'
  > & { autor: { display_name: string | null } | null })[];

  const secciones: { href: string; label: string; badge?: number }[] = [
    { href: '/admin/participacion/borradores', label: 'Borradores', badge: borradores },
    { href: '/admin/participacion/reportes', label: 'Reportes', badge: reportesAbiertos },
    { href: '/admin/participacion/categorias', label: 'Categorías' },
    { href: '/admin/participacion/encuestas', label: 'Encuestas' },
  ];

  const filtro = (s?: EstadoPropuesta) =>
    s ? `/admin/participacion?status=${s}` : '/admin/participacion';

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
            Participación
          </h1>
          <p className="mt-2 max-w-2xl text-[13.5px] text-gris">
            Todas las propuestas, incluidos archivados, borradores y fusionadas (la RLS pública los
            oculta; el panel necesita verlos). Abre una para cambiar estado, fecha límite, respuesta
            oficial, fusionar o eliminar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {secciones.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="inline-flex items-center gap-2 rounded-boton border border-linea bg-white px-4 py-2 text-[13px] font-bold text-titular no-underline hover:border-titular"
            >
              {s.label}
              {typeof s.badge === 'number' && s.badge > 0 && (
                <span className="rounded-full bg-magenta px-2 py-0.5 text-[11px] font-bold text-white">
                  {s.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-5 mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={filtro()}
          className={`rounded-full px-3 py-1 text-[12.5px] font-bold no-underline ${!params.status ? 'bg-accion text-white' : 'bg-white text-cuerpo ring-1 ring-linea'}`}
        >
          Todos
        </Link>
        {([...ORDEN_ESTADOS, 'draft', 'archived'] as EstadoPropuesta[]).map((s) => (
          <Link
            key={s}
            href={filtro(s)}
            className={`rounded-full px-3 py-1 text-[12.5px] font-bold no-underline ${params.status === s ? 'bg-accion text-white' : 'bg-white text-cuerpo ring-1 ring-linea'}`}
          >
            {ETIQUETA_ESTADO[s]}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          No se han podido cargar las propuestas: {error.message}
        </p>
      ) : (
        <div className="overflow-hidden rounded-tarjeta border border-linea bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13.5px]">
              <thead className="bg-fondo text-[12px] font-bold uppercase tracking-wide text-gris">
                <tr>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Autor</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Apoyos</th>
                  <th className="px-4 py-3">Fecha límite</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {propuestas.map((p) => {
                  const cat = p.category_id ? mapaCategorias.get(p.category_id) : null;
                  return (
                    <tr key={p.id} className="border-t border-linea/60">
                      <td className="max-w-[320px] truncate px-4 py-3 font-semibold text-titular">
                        {p.title}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-gris">
                        {p.autor?.display_name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.nombre}
                          </span>
                        ) : (
                          <span className="text-gris">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-fondo px-2.5 py-0.5 text-[11.5px] font-bold text-cuerpo ring-1 ring-linea">
                          {ETIQUETA_ESTADO[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{p.support_count}</td>
                      <td className="px-4 py-3 text-[12.5px] text-gris">
                        {p.deadline_at ? new Date(p.deadline_at).toLocaleString('es-ES') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/participacion/propuestas/${p.id}`}
                          className="rounded-boton border border-linea bg-white px-3 py-1.5 text-[12.5px] font-bold text-titular no-underline hover:border-titular"
                        >
                          Moderar →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {propuestas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gris">
                      No hay propuestas con ese filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
