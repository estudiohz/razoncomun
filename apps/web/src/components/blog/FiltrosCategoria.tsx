import { Chip } from '@/components/ui/Chip';
import type { Categoria } from '@/lib/blog/tipos';

/**
 * Chips de filtro por categoría (.filtros del boceto).
 * Reutiliza el `Chip` del sistema de diseño de rc-04 — que ya venía anotado
 * como "usado en el blog por rc-05". Cero CSS propio.
 *
 * Son enlaces reales a `/blog/{categoria}`, no estado de cliente: cada
 * categoría es una URL indexable y prerenderizada.
 */
export function FiltrosCategoria({
  categorias,
  activa,
  base = '/blog',
}: {
  categorias: Categoria[];
  activa?: string;
  base?: string;
}) {
  return (
    <nav className="flex flex-wrap gap-[10px] pb-[34px] pt-[14px]" aria-label="Categorías">
      <Chip href={base} activo={!activa}>
        Todos
      </Chip>
      {categorias.map((c) => (
        <Chip key={c.id} href={`${base}/${c.slug}`} activo={activa === c.slug}>
          {c.name}
        </Chip>
      ))}
    </nav>
  );
}
