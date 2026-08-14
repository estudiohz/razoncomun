import { CarritoPanel } from './CarritoPanel';
import { CarritoProvider } from './CarritoProvider';

/**
 * Layout de la tienda: solo aporta el carrito (contexto + panel). La
 * cabecera y el pie de la web son los de siempre, del layout raíz.
 *
 * D-T10: la tienda NO está enlazada en el menú y va con `noindex` hasta el
 * visto bueno legal (LO 8/2007). Se llega por URL directa.
 */
export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <CarritoProvider>
      {children}
      <CarritoPanel />
    </CarritoProvider>
  );
}
