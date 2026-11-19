import { Contenedor } from '@/components/layout/Contenedor';
import { tiendaEnModoCatalogo } from '@/lib/tienda/modo';
import { CarritoPanel } from './CarritoPanel';
import { CarritoProvider } from './CarritoProvider';

/**
 * Layout de la tienda: aporta el carrito (contexto + panel) y, si la tienda
 * está en modo catálogo (ver lib/tienda/modo.ts), el aviso de que no se
 * puede comprar. La cabecera y el pie son los del layout raíz.
 *
 * D-T10: la tienda NO está enlazada en el menú y va con `noindex` hasta el
 * visto bueno legal (LO 8/2007). Se llega por URL directa.
 */
export const dynamic = 'force-dynamic';

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const modoCatalogo = await tiendaEnModoCatalogo();
  return (
    <CarritoProvider modoCatalogo={modoCatalogo}>
      {modoCatalogo && (
        <Contenedor className="pt-6">
          <p className="rounded-[14px] border border-linea bg-panel px-4 py-3 text-center text-[14px] font-semibold text-cuerpo">
            La tienda está en modo catálogo: puedes ver los productos, pero de momento no se pueden
            hacer pedidos. Vuelve pronto.
          </p>
        </Contenedor>
      )}
      {children}
      <CarritoPanel />
    </CarritoProvider>
  );
}
