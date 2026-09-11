'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Pantalla de espera del alta recién hecha.
 *
 * EL PROBLEMA QUE RESUELVE (04/09/2026, Sergio dándose de alta en dev): la
 * suscripción se crea en Stripe al instante, pero la fila de `members` —y con
 * ella el número de socio— la escribe el WEBHOOK, y eso tardó 19 segundos.
 * En ese hueco, quien acababa de meter su IBAN aterrizaba en esta página y
 * leía "Todavía no eres socio". Es el peor momento posible para decirle eso a
 * alguien: acaba de darte dinero y la web le dice que no ha pasado nada.
 *
 * Aquí no se miente ni se adivina: el `?alta=ok` solo lo pone el servidor
 * DESPUÉS de haber creado la suscripción de verdad, así que decir "estamos
 * confirmando" es exacto. Se refresca sola hasta que la fila aparece.
 */

const CADA_MS = 2000;
/** Pasado esto dejamos de refrescar y damos una salida, en vez de girar para siempre. */
const LIMITE_MS = 40000;

export function ConfirmandoAlta() {
  const router = useRouter();
  const [tardando, setTardando] = useState(false);

  useEffect(() => {
    const desde = Date.now();

    const intervalo = setInterval(() => {
      if (Date.now() - desde > LIMITE_MS) {
        setTardando(true);
        clearInterval(intervalo);
        return;
      }
      // Vuelve a pedir el server component: cuando el webhook haya escrito la
      // fila, el padre deja de renderizar este componente y se desmonta solo.
      router.refresh();
    }, CADA_MS);

    return () => clearInterval(intervalo);
  }, [router]);

  if (tardando) {
    return (
      <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
        <h2 className="text-[15px] font-bold text-titular">Tu alta está tardando más de lo normal</h2>
        <p className="mt-2 text-[13.5px] text-cuerpo">
          El pago se ha registrado correctamente, así que <strong>no vuelvas a darte de alta</strong>{' '}
          — se te cobraría dos veces. Recarga esta página en un minuto; si sigue igual, escríbenos a{' '}
          <a href="mailto:hola@razoncomun.com" className="font-semibold text-titular underline">
            hola@razoncomun.com
          </a>{' '}
          y lo miramos.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-tarjeta border border-teal/40 bg-teal/[.06] p-6">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-4 w-4 flex-none animate-spin rounded-full border-2 border-teal border-t-transparent"
          aria-hidden
        />
        <div>
          <h2 className="text-[15px] font-bold text-titular">Estamos confirmando tu alta</h2>
          <p className="mt-2 text-[13.5px] text-cuerpo">
            Tu pago ya está registrado. Tu banco y Stripe tardan unos segundos en confirmarlo, y en
            cuanto lo hagan aparecerá aquí tu número de socio. No hace falta que hagas nada.
          </p>
        </div>
      </div>
    </section>
  );
}
