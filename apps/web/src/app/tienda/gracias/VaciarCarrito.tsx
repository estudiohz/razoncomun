'use client';

import { useEffect } from 'react';
import { useCarrito } from '../CarritoProvider';

/**
 * Vacía el carrito al llegar aquí desde Stripe.
 *
 * Se hace en esta página y no antes de pagar a propósito: si se vaciara al
 * mandar a Stripe, quien se arrepintiera a mitad volvería con el carrito
 * perdido. Aquí ya se ha pagado.
 */
export function VaciarCarrito() {
  const { vaciar } = useCarrito();
  useEffect(() => {
    vaciar();
    // Solo al montar: `vaciar` cambia de identidad en cada render del
    // provider y meterlo en las dependencias lo dispararía en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
