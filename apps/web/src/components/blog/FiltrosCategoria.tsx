import { Chip } from '@/components/ui/Chip';
import type { Categoria } from '@/lib/blog/tipos';

/**
 * Chips de filtro por categoría (.filtros del boceto).
 *
 * En MÓVIL: una sola fila deslizable con el pulgar (patrón de apps de
 * noticias), con desvanecido en el borde derecho como pista de que hay más.
 * Antes hacían wrap y, con ~12 departamentos, formaban un muro de tres o
 * cuatro filas que empujaba el primer artículo fuera de la pantalla
 * (reporte de Sergio, 02/08/2026). En ≥720px se mantiene el wrap: en
 * escritorio caben en una o dos líneas y verlas todas a la vez es mejor.
 *
 * Los márgenes negativos dejan que la fila sangre hasta el borde físico de
 * la pantalla en móvil — el gesto de arrastre no debe chocar con el padding
 * del contenedor.
 *
 * Siguen siendo enlaces reales a `/blog/{categoria}`, no estado de cliente:
 * cada categoría es una URL indexable y prerenderizada.
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
    <div className="relative -mx-4 min-[720px]:mx-0">
      <nav
        aria-label="Categorías"
        className="flex gap-[10px] overflow-x-auto px-4 pb-[24px] pt-[14px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[720px]:flex-wrap min-[720px]:overflow-visible min-[720px]:px-0 min-[720px]:pb-[34px]"
      >
        <span className="shrink-0 min-[720px]:shrink">
          <Chip href={base} activo={!activa}>
            Todos
          </Chip>
        </span>
        {categorias.map((c) => (
          <span key={c.id} className="shrink-0 min-[720px]:shrink">
            <Chip href={`${base}/${c.slug}`} activo={activa === c.slug}>
              {c.name}
            </Chip>
          </span>
        ))}
      </nav>
      {/* Pista visual de scroll: desvanecido en el borde derecho, solo móvil. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-fondo to-transparent min-[720px]:hidden"
      />
    </div>
  );
}
