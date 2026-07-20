import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { actualizarPunto } from '../actions';
import { EditorConVistaPrevia } from './EditorConVistaPrevia';

export default async function EditarPuntoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const puntoId = Number(id);
  const { supabase } = await requireAdmin('/admin/manifiesto');

  if (!Number.isFinite(puntoId)) notFound();

  const [{ data: punto }, { data: historial }] = await Promise.all([
    supabase.from('manifesto_points').select('*').eq('id', puntoId).single(),
    supabase
      .from('manifesto_point_versions')
      .select('id, version, title, changed_by, created_at, profiles(display_name, email)')
      .eq('point_id', puntoId)
      .order('version', { ascending: false }),
  ]);

  if (!punto) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/manifiesto" className="text-[13px] text-gris no-underline hover:underline">
          ← Volver al manifiesto
        </Link>
        <h1 className="mt-2 text-[24px] font-extrabold">
          Punto {punto.id} · v{punto.version}
        </h1>
        {punto.is_core && (
          <p className="mt-1 text-[12.5px] text-gris">
            Marcado como <code>is_core</code> por el diseño original — desde D-013 esto ya no bloquea
            la edición, solo se muestra como etiqueta heredada.
          </p>
        )}
      </div>

      <Tarjeta className="p-5">
        <form action={actualizarPunto} className="space-y-3">
          <input type="hidden" name="id" value={punto.id} />
          <EditorConVistaPrevia tituloInicial={punto.title} cuerpoInicial={punto.body} />
          <button type="submit" className="rounded-boton bg-accion px-5 py-3 text-[14px] font-bold text-white">
            Guardar y publicar (v{punto.version + 1})
          </button>
          <p className="text-[11.5px] text-gris">
            Al guardar se crea automáticamente la versión v{punto.version} en el historial público de
            abajo, y la v{punto.version + 1} queda activa. Recuerda relanzar el job de reindexado del
            cerebro (rc-08) en Dokploy tras publicar cambios de contenido.
          </p>
        </form>
      </Tarjeta>

      <Tarjeta className="p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">
          Historial de versiones (público)
        </h2>
        {historial && historial.length > 0 ? (
          <ul className="mt-3 space-y-2 text-[13px]">
            {historial.map((h) => {
              const autor = Array.isArray(h.profiles) ? h.profiles[0] : h.profiles;
              return (
                <li key={h.id} className="border-b border-linea pb-2 last:border-0">
                  <span className="font-bold">v{h.version}</span> · {h.title} —{' '}
                  <span className="text-gris">
                    {autor?.display_name ?? autor?.email ?? 'desconocido'} ·{' '}
                    {new Date(h.created_at).toLocaleString('es-ES')}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-gris">
            Todavía no hay versiones anteriores registradas (este es el primer guardado).
          </p>
        )}
      </Tarjeta>
    </div>
  );
}
