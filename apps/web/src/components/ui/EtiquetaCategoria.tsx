import { cn } from '@/lib/cn';
import { etiquetaCategoria, type Categoria } from '@/lib/mock';

/** Fondo por temática — el multicolor significa "todas las áreas, un solo círculo". */
const fondoCategoria: Record<Categoria, string> = {
  vivienda: 'bg-cat-vivienda',
  economia: 'bg-cat-economia',
  sanidad: 'bg-cat-sanidad',
  justicia: 'bg-cat-justicia',
  agricultura: 'bg-cat-agricultura',
  autonomos: 'bg-cat-autonomos',
  transparencia: 'bg-cat-transparencia',
  educacion: 'bg-cat-educacion',
};

/** Etiqueta de categoría con color por departamento (fiel a blog.html). */
export function EtiquetaCategoria({
  categoria,
  className,
}: {
  categoria: Categoria;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-block rounded-lg px-[13px] py-[6px] text-[11.5px] font-extrabold uppercase tracking-[.06em] text-white',
        fondoCategoria[categoria],
        className,
      )}
    >
      {etiquetaCategoria[categoria]}
    </span>
  );
}
