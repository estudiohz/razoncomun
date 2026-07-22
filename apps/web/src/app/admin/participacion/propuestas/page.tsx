import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { ETIQUETA_ESTADO, ORDEN_ESTADOS, type EstadoPropuesta, type Propuesta } from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Moderación de propuestas',
  descripcion: 'Tablero de propuestas: moderación, estados y fusión de duplicados.',
  ruta: '/admin/participacion/propuestas',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default async function ModeracionPropuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; categoria?: string }>;
}) {
  const { supabase } = await requireAdminOrEditor('/admin/participacion/propuestas');
  const params = await searchParams;

  const { data: categorias } = await supabase
    .from('proposal_categories')
    .select('id, nombre, color')
    .order('orden');
  const mapaCategorias = new Map((categorias ?? []).map((c) => [c.id, c]));

  let query = supabase
    .from('proposals')
    .select('id, title, slug, status, category_id, support_count, deadline_at, created_at')
    .order('created_at', { ascending: false });

  if (params.status) query = query.eq('status', params.status);
  if (params.categoria) query = query.eq('category_id', params.categoria);

  const { data, error } = await query;
  const propuestas = (data ?? []) as Pick<
    Propuesta,
    'id' | 'title' | 'slug' | 'status' | 'category_id' | 'support_count' | 'deadline_at' | 'created_at'
  >[];

  return (
    <div className="py-2">
      <Link href="/admin/participacion" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver a Participación
      </Link>
      <h1 className="mb-2 mt-3 text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
        Moderación de propuestas
      </h1>
      <p className="mb-6 max-w-2xl text-[13.5px] text-gris">
        Aquí se ven TODOS los estados, incluidos archivados y fusionados (la RLS pública los oculta,
        el panel de editor/admin necesita verlos). Abre una propuesta para cambiar estado, fecha
        límite, respuesta oficial, fusionar o eliminar.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/participacion/propuestas"
          className={`rounded-full px-3 py-1 text-[12.5px] font-bold no-underline ${!params.status ? 'bg-accion text-white' : 'bg-white text-cuerpo ring-1 ring-linea'}`}
        >
          Todos
        </Link>
        {[...ORDEN_ESTADOS, 'archived' as EstadoPropuesta].map((s) => (
          <Link
            key={s}
            href={`/admin/participacion/propuestas?status=${s}`}
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
                      <td className="max-w-[320px] truncate px-4 py-3 font-semibold text-titular">{p.title}</td>
                      <td className="px-4 py-3">
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
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
                    <td colSpan={6} className="px-4 py-8 text-center text-gris">
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
