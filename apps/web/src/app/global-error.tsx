'use client';

// Error boundary raíz (T-0097): sustituye al layout cuando falla el propio
// layout o un error no lo captura nadie más. Envía el error a Sentry (ya
// filtrado por `sentry.common.ts`) y NO muestra el mensaje del error, que
// puede llevar datos personales.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <section className="mx-auto max-w-[48ch] px-6 py-24 text-center">
          <h1 className="text-[clamp(24px,3vw,36px)] font-extrabold text-titular">Algo ha ido mal</h1>
          <p className="mt-3 text-[16px] text-cuerpo">
            Ha ocurrido un error inesperado. Ya lo hemos registrado; prueba de nuevo en un momento.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-7 inline-flex items-center justify-center rounded-boton bg-accion px-[30px] py-[13px] text-[15px] font-bold text-white shadow-boton"
          >
            Reintentar
          </button>
        </section>
      </body>
    </html>
  );
}
