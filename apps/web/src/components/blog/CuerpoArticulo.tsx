import { cn } from '@/lib/cn';

/**
 * Cuerpo del artículo (.art-body del boceto blog-articulo.html).
 *
 * Todos los estilos van como variantes arbitrarias de Tailwind sobre el
 * contenedor, no como CSS global: así el módulo de blog no toca
 * `globals.css` (propiedad de rc-04) y no genera conflictos de merge.
 *
 * Dos detalles deliberados:
 *  - `[&_h2]:text-tinta` — `globals.css` pinta todos los h1/h2/h3 en teal
 *    (#24AF9A). Los bocetos del blog usan tinta (#1B3D9C) y, además, el teal
 *    sobre blanco da 2,73:1 (deuda de marca conocida). Aquí se fuerza tinta:
 *    fiel al boceto Y sin empeorar el contraste.
 *  - `scroll-mt-28` en los encabezados: el nav es sticky, y sin este margen
 *    los saltos del índice dejarían el título tapado.
 *
 * El HTML llega de `renderizarMarkdown`, que escapa todo el texto de entrada
 * y filtra los protocolos de las URLs — por eso `dangerouslySetInnerHTML` es
 * seguro aquí aunque el markdown lo escriba un editor.
 */
export function CuerpoArticulo({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        // Párrafos y listas
        '[&_p]:mb-[22px] [&_p]:text-[17px] [&_p]:text-cuerpo',
        '[&_ul]:mb-[22px] [&_ul]:ml-[22px] [&_ul]:list-disc [&_li]:mb-2 [&_li]:text-[17px]',
        '[&_ol]:mb-[22px] [&_ol]:ml-[22px] [&_ol]:list-decimal',
        // Encabezados
        '[&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:scroll-mt-28 [&_h2]:text-[26px] [&_h2]:font-extrabold [&_h2]:text-tinta',
        '[&_h3]:mb-3 [&_h3]:mt-[30px] [&_h3]:scroll-mt-28 [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:text-tinta',
        // Enlaces y código en línea
        '[&_a]:text-tinta [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-titular',
        '[&_code]:rounded [&_code]:bg-fondo [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[15px]',
        // Cita destacada
        '[&_blockquote]:my-7 [&_blockquote]:border-l-4 [&_blockquote]:border-morado [&_blockquote]:py-1.5 [&_blockquote]:pl-6 [&_blockquote]:text-[20px] [&_blockquote]:font-semibold [&_blockquote]:leading-[1.4] [&_blockquote]:text-tinta',
        // Figuras
        '[&_figure]:my-[30px] [&_figure_img]:rounded-[14px]',
        '[&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-[12.5px] [&_figcaption]:text-gris',
        // Caja de dato destacado (:::dato)
        '[&_.rc-dato]:my-[26px] [&_.rc-dato]:rounded-[12px] [&_.rc-dato]:border [&_.rc-dato]:border-linea [&_.rc-dato]:border-l-4 [&_.rc-dato]:border-l-titular [&_.rc-dato]:bg-panel [&_.rc-dato]:px-[26px] [&_.rc-dato]:py-[22px]',
        '[&_.rc-dato-n]:text-[34px] [&_.rc-dato-n]:font-extrabold [&_.rc-dato-n]:leading-none [&_.rc-dato-n]:text-tinta',
        '[&_.rc-dato_p]:mb-0 [&_.rc-dato_p]:mt-1.5 [&_.rc-dato_p]:text-[14.5px]',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
