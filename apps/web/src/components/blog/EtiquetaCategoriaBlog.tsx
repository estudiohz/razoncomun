import { cn } from '@/lib/cn';
import type { Categoria } from '@/lib/blog/tipos';

/**
 * Etiqueta de categoría para contenido de BD.
 *
 * Misma forma exacta que `ui/EtiquetaCategoria` de rc-04 (mismas clases de
 * tamaño, radio, peso y tracking). La diferencia: rc-04 mapea una unión fija
 * de 8 slugs a clases Tailwind `bg-cat-*`, y la tabla `categories` tiene 12
 * filas con su propio hex en la columna `color`. Tailwind no puede generar
 * clases dinámicas, así que el color viaja por `style`. No se duplica el
 * sistema de diseño: se duplica cero CSS estructural, solo la fuente del color.
 */
export function EtiquetaCategoriaBlog({
  categoria,
  className,
}: {
  categoria: Pick<Categoria, 'name' | 'color'>;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block rounded-lg px-[13px] py-[6px] text-[11.5px] font-extrabold uppercase tracking-[.06em] text-white',
        className,
      )}
      style={{ backgroundColor: categoria.color }}
    >
      {categoria.name}
    </span>
  );
}
