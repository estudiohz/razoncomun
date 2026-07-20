import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { metadatosPagina } from '@/lib/seo';
import { Contenedor } from '@/components/layout/Contenedor';

export const metadata: Metadata = metadatosPagina({
  titulo: 'El manifiesto',
  descripcion:
    'El programa de Razón Común: número variable de puntos de gestión real, editados por el equipo y siempre con historial de cambios público. Medidas concretas, no promesas.',
  ruta: '/manifiesto',
});

/**
 * Contenido REAL leído de `manifesto_points` (lectura pública, RLS
 * manifesto_points_select_public) + enlace al historial de cada punto.
 *
 * D-013 (decisión de Sergio, opción b): número VARIABLE de puntos, sin
 * núcleo inmutable — el programa lo edita el equipo desde `/admin/manifiesto`
 * como si fueran noticias, PERO cada cambio queda versionado con historial
 * público (manifesto_point_versions) — sin eso se cae el relato de que el
 * programa lo cambian los afiliados.
 *
 * Diseño deliberadamente sobrio aquí (rc-09): la pieza visual definitiva de
 * esta ruta es del sistema de diseño de rc-04/rc-05; esta versión ya no es
 * el Placeholder — es la fuente de verdad de datos, lista para que
 * rc-05-blog le dé el acabado final si lo considera oportuno.
 */
export default async function ManifiestoPage() {
  const supabase = await createClient();

  const { data: puntos } = await supabase
    .from('manifesto_points')
    .select('id, title, body, version, updated_at')
    .order('id', { ascending: true });

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
          El manifiesto
        </span>
        <h1 className="mt-3 text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.12]">
          {puntos?.length ?? 0} puntos de gestión real
        </h1>
        <p className="mx-auto mt-4 max-w-[60ch] text-[17px] text-cuerpo">
          El programa evoluciona por mejora continua: no hay un número fijo de puntos ni un núcleo
          inmutable. Cada cambio se publica con fecha, autor y versión anterior consultable —
          transparencia total sobre cómo cambia el programa.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-[820px] space-y-4">
        {(puntos ?? []).map((p) => (
          <details key={p.id} className="rounded-tarjeta border border-linea bg-panel p-5">
            <summary className="cursor-pointer text-[17px] font-bold text-titular">
              {p.id}. {p.title}
              <span className="ml-2 text-[12px] font-semibold text-gris">v{p.version}</span>
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-[15px] text-cuerpo">{p.body}</p>
            <p className="mt-3 text-[12px] text-gris">
              Última edición: {p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-ES') : '—'} ·{' '}
              <a href={`/transparencia/manifiesto/${p.id}`} className="font-semibold text-titular underline">
                ver historial de versiones
              </a>
            </p>
          </details>
        ))}
        {(puntos ?? []).length === 0 && (
          <p className="text-center text-[14px] text-gris">Sin puntos publicados todavía.</p>
        )}
      </div>
    </Contenedor>
  );
}
