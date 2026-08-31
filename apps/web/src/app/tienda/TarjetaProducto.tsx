import Image from 'next/image';
import Link from 'next/link';
import { formatoPrecio } from '@/lib/tienda/precios';

export interface DatosTarjeta {
  id: number;
  nombre: string;
  imagen: string | null;
  desdeCents: number | null;
  variasVariantes: boolean;
}

/**
 * Tarjeta de producto. La comparten la parrilla (`/tienda`) y el bloque
 * "Otros productos" de la ficha: si divergen, el mismo producto se ve de dos
 * maneras distintas en la misma sesión.
 */
export function TarjetaProducto({ producto: p, sizes }: { producto: DatosTarjeta; sizes: string }) {
  return (
    <Link href={`/tienda/${p.id}`} className="group block no-underline">
      <div className="relative aspect-square overflow-hidden rounded-tarjeta bg-fondo">
        {p.imagen && (
          <Image
            src={p.imagen}
            alt={p.nombre}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[16px] font-bold text-titular">{p.nombre}</h3>
        {p.desdeCents !== null && (
          <p className="shrink-0 text-[15px] font-extrabold text-titular tabular-nums">
            {p.variasVariantes && <span className="text-[12px] font-bold text-gris">desde </span>}
            {formatoPrecio(p.desdeCents)}
          </p>
        )}
      </div>
    </Link>
  );
}
