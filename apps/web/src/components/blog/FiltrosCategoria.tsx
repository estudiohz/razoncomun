import { Chip } from '@/components/ui/Chip';
import { TiraDeslizable, ItemTira } from '@/components/ui/TiraDeslizable';
import type { Categoria } from '@/lib/blog/tipos';

/**
 * Chips de filtro por categoría (.filtros del boceto).
 *
 * En móvil: la TiraDeslizable compartida (una fila con flechas ‹ › que
 * invitan al gesto — el scroll a secas "no se intuía", feedback de Sergio).
 * En ≥720px: wrap normal. Mismo comportamiento que propuestas y la cinta de
 * meses: un solo gesto en toda la app.
 *
 * Siguen siendo enlaces reales a `/blog/{categoria}`: cada categoría es una
 * URL indexable y prerenderizada.
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
    <TiraDeslizable className="pb-[24px] pt-[14px] min-[720px]:pb-[34px]">
      <ItemTira>
        <Chip href={base} activo={!activa}>
          Todos
        </Chip>
      </ItemTira>
      {categorias.map((c) => (
        <ItemTira key={c.id}>
          <Chip href={`${base}/${c.slug}`} activo={activa === c.slug}>
            {c.name}
          </Chip>
        </ItemTira>
      ))}
    </TiraDeslizable>
  );
}
