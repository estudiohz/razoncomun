'use client';

import { useActionState } from 'react';
import { Input } from '@/components/ui/Input';
import { EditorWysiwyg } from '@/components/paginas/EditorWysiwyg';
import { guardarPagina, type ResultadoPagina } from '@/app/admin/paginas/actions';
import type { Pagina } from '@/lib/paginas';

const etiqueta = 'mb-1 block text-[12px] font-bold uppercase tracking-[.06em] text-gris';
const check = 'flex items-center gap-2.5 text-[13.5px] text-cuerpo';

export function FormularioPagina({ pagina }: { pagina: Pagina | null }) {
  const [estado, accion, pendiente] = useActionState<ResultadoPagina | null, FormData>(
    guardarPagina,
    null,
  );

  return (
    <form action={accion} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {pagina ? <input type="hidden" name="id" value={pagina.id} /> : null}

        <div className="mb-6">
          <label className={etiqueta} htmlFor="title">
            Título
          </label>
          <Input id="title" name="title" defaultValue={pagina?.title ?? ''} required placeholder="Política de privacidad" />
        </div>

        <label className={etiqueta}>Contenido</label>
        <EditorWysiwyg inicial={pagina?.body_html ?? ''} />

        {estado?.error ? (
          <p className="mb-4 rounded-boton border border-magenta/40 bg-magenta/5 px-4 py-3 text-[15px] text-magenta">
            {estado.error}
          </p>
        ) : null}
        {estado?.ok ? (
          <p className="mb-4 rounded-boton border border-accion bg-accion/5 px-4 py-3 text-[15px] text-titular">
            Guardado.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pendiente}
          className="rounded-boton bg-accion px-8 py-3.5 text-[15px] font-bold text-white shadow-boton disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar página'}
        </button>
      </div>

      <aside className="min-w-0 space-y-6">
        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <label className={etiqueta} htmlFor="slug">
            URL (slug)
          </label>
          <Input id="slug" name="slug" defaultValue={pagina?.slug ?? ''} placeholder="politica-de-privacidad" />
          <p className="mt-2 text-[12px] text-gris">
            La página se verá en <span className="font-mono">/{'{slug}'}</span>. Si lo dejas vacío se
            genera del título.
          </p>
        </div>

        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <p className={etiqueta}>Mostrar en</p>
          <div className="space-y-2.5">
            <label className={check}>
              <input type="checkbox" name="show_header" defaultChecked={pagina?.show_header} className="h-[17px] w-[17px] accent-accion" />
              Menú principal (header)
            </label>
            <label className={check}>
              <input type="checkbox" name="show_footer" defaultChecked={pagina?.show_footer} className="h-[17px] w-[17px] accent-accion" />
              Enlaces del footer
            </label>
            <label className={check}>
              <input type="checkbox" name="show_legal" defaultChecked={pagina?.show_legal} className="h-[17px] w-[17px] accent-accion" />
              Bloque legal del footer
            </label>
          </div>
          <div className="mt-4">
            <label className={etiqueta} htmlFor="position">
              Orden
            </label>
            <Input
              id="position"
              name="position"
              type="number"
              defaultValue={pagina?.position ?? 0}
              className="w-[100px]"
            />
          </div>
        </div>

        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <label className={check}>
            <input
              type="checkbox"
              name="published"
              defaultChecked={pagina ? pagina.published : true}
              className="h-[17px] w-[17px] accent-accion"
            />
            <span className="font-bold text-titular">Publicada</span>
          </label>
          <p className="mt-2 text-[12px] text-gris">
            Si la desmarcas queda como borrador: no se ve en la web ni en los menús.
          </p>
        </div>
      </aside>
    </form>
  );
}
