import { Contenedor } from '@/components/layout/Contenedor';
import { Destacado } from './Destacado';
import { TarjetaArticulo } from './TarjetaArticulo';
import { FiltrosCategoria } from './FiltrosCategoria';
import type { ArticuloConRelaciones, Categoria } from '@/lib/blog/tipos';

/**
 * Portada editorial compartida por /blog y /observatorio (mismos componentes,
 * distinto `source_type` — requisito de la misión).
 *
 * Estructura fiel a `bocetos-home/blog.html`: cabecera con eyebrow, chips de
 * categoría, destacado grande y grid de 3 columnas (2 en <=900px, 1 en <=600px).
 */
export function PortadaBlog({
  eyebrow,
  titulo,
  descripcion,
  articulos,
  categorias,
  categoriaActiva,
  base = '/blog',
}: {
  eyebrow: string;
  titulo: string;
  descripcion: string;
  articulos: ArticuloConRelaciones[];
  categorias: Categoria[];
  categoriaActiva?: string;
  base?: string;
}) {
  // Sin filtro de categoría, el más reciente va de destacado. Con filtro, la
  // lista es homogénea y se muestra entera en el grid.
  const hayDestacado = !categoriaActiva && articulos.length > 0;
  const destacado = hayDestacado ? articulos[0] : null;
  const resto = hayDestacado ? articulos.slice(1) : articulos;

  return (
    <Contenedor>
      <header className="pb-5 pt-9">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-tinta">
          {eyebrow}
        </span>
        <h1 className="mt-2.5 text-[clamp(34px,4.4vw,52px)] font-extrabold text-tinta">{titulo}</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-cuerpo">{descripcion}</p>
      </header>

      <FiltrosCategoria categorias={categorias} activa={categoriaActiva} base={base} />

      {destacado && <Destacado articulo={destacado} base={base} />}

      {resto.length > 0 && (
        <div className="grid grid-cols-1 gap-[26px] min-[601px]:grid-cols-2 min-[901px]:grid-cols-3">
          {resto.map((a) => (
            <TarjetaArticulo key={a.slug} articulo={a} base={base} />
          ))}
        </div>
      )}

      {articulos.length === 0 && (
        <p className="rounded-tarjeta border border-linea bg-panel px-8 py-16 text-center text-[15px] text-cuerpo">
          Todavía no hay artículos publicados en esta sección.
        </p>
      )}

      <div className="h-14" />
    </Contenedor>
  );
}
