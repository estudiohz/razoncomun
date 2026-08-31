import 'server-only';
import { listarProductos, obtenerProducto } from '@/lib/tienda/printful';
import type { DatosTarjeta } from './TarjetaProducto';

/**
 * Datos de las tarjetas del catálogo (parrilla y bloque "Otros productos").
 *
 * El precio "desde" no viene en `/store/products`: hay que abrir cada ficha.
 * Son decenas de llamadas como mucho y todas van cacheadas 1 h junto con la
 * parrilla (D-T1), así que se pagan una vez por hora, no por visita.
 */
export async function tarjetasDeTienda(): Promise<DatosTarjeta[]> {
  const productos = await listarProductos();
  const detalles = await Promise.all(productos.map((p) => obtenerProducto(p.id)));

  return productos.map((p, i) => {
    const disponibles = (detalles[i]?.variantes ?? []).filter((v) => v.disponible);
    return {
      id: p.id,
      nombre: p.nombre,
      imagen: p.imagen,
      desdeCents: disponibles.length > 0 ? Math.min(...disponibles.map((v) => v.precioCents)) : null,
      variasVariantes: disponibles.length > 1,
    };
  });
}
