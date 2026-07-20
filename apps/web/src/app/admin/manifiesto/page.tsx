import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { Input } from '@/components/ui/Input';
import { crearPunto } from './actions';

export default async function ManifiestoAdminPage() {
  // Crear/editar puntos exige admin (RLS manifesto_points_write_admin); editor solo lee la
  // sección desde la navegación pero esta página en concreto redirige a un editor sin permiso.
  const { supabase } = await requireAdmin('/admin/manifiesto');

  const { data: puntos, error } = await supabase
    .from('manifesto_points')
    .select('id, title, is_core, version, updated_at')
    .order('id', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-extrabold">Manifiesto</h1>
        <p className="mt-1 text-[13.5px] text-gris">
          Número variable de puntos (D-013): sin núcleo inmutable, editables como noticias. Cada
          guardado publica de inmediato y queda versionado con historial público.
        </p>
      </div>

      <Tarjeta className="p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Añadir punto nuevo</h2>
        <form action={crearPunto} className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Título</label>
            <Input name="title" required placeholder="Título del punto" />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Contenido</label>
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Redacción del punto"
              className="w-full rounded-boton border border-linea px-4 py-3 text-[14px]"
            />
          </div>
          <button type="submit" className="rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white">
            Crear y publicar
          </button>
        </form>
      </Tarjeta>

      {error && <p className="text-[13px] text-red-600">Error al cargar el manifiesto: {error.message}</p>}

      <Tarjeta className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Punto</th>
              <th className="px-4 py-3">Versión</th>
              <th className="px-4 py-3">Última edición</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(puntos ?? []).map((p) => (
              <tr key={p.id} className="border-b border-linea last:border-0">
                <td className="px-4 py-3 text-gris">{p.id}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold">{p.title}</span>
                  {p.is_core && (
                    <span className="ml-2 rounded-full bg-fondo px-2 py-0.5 text-[10px] font-bold text-gris">
                      is_core (heredado, ya no bloquea edición)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-cuerpo">v{p.version}</td>
                <td className="px-4 py-3 text-cuerpo">
                  {p.updated_at ? new Date(p.updated_at).toLocaleString('es-ES') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/manifiesto/${p.id}`}
                    className="font-semibold text-titular no-underline hover:underline"
                  >
                    Editar →
                  </Link>
                </td>
              </tr>
            ))}
            {(puntos ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gris">
                  Sin puntos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
