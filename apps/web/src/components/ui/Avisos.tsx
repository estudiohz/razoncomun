'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { COOKIE_AVISO, EVENTO_AVISO, decodificarAviso, type Aviso } from '@/lib/avisos/comun';

const DURACION_MS = 5000;

function leerCookieAviso(): Aviso | null {
  const par = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE_AVISO}=`));
  if (!par) return null;
  document.cookie = `${COOKIE_AVISO}=; path=/; max-age=0; samesite=lax`;
  return decodificarAviso(par.slice(COOKIE_AVISO.length + 1));
}

/**
 * Región de avisos (toasts) del panel. Accesible: `role="status"` +
 * `aria-live="polite"` para los de éxito y `role="alert"` para los errores.
 * `flash` llega del layout (servidor) cada vez que una server action deja la
 * cookie; además escucha los avisos lanzados desde el cliente.
 */
export function Avisos({ flash }: { flash?: string }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const vistos = useRef(new Set<string>());
  const pathname = usePathname();

  const mostrar = useCallback((a: Aviso | null) => {
    if (!a || vistos.current.has(a.id)) return;
    vistos.current.add(a.id);
    setAvisos((prev) => [...prev.slice(-2), a]);
    window.setTimeout(() => setAvisos((prev) => prev.filter((x) => x.id !== a.id)), DURACION_MS);
  }, []);

  useEffect(() => {
    mostrar(leerCookieAviso());
  }, [flash, pathname, mostrar]);

  // Red de seguridad: si una action deja la cookie sin que el layout se vuelva
  // a pintar (p. ej. una llamada desde un Client Component sin revalidar), la
  // recogemos igual. Leer document.cookie es barato.
  useEffect(() => {
    const t = window.setInterval(() => mostrar(leerCookieAviso()), 1000);
    return () => window.clearInterval(t);
  }, [mostrar]);

  useEffect(() => {
    const oir = (e: Event) => mostrar((e as CustomEvent<Aviso>).detail);
    window.addEventListener(EVENTO_AVISO, oir);
    return () => window.removeEventListener(EVENTO_AVISO, oir);
  }, [mostrar]);

  const exitos = avisos.filter((a) => a.tipo === 'exito');
  const errores = avisos.filter((a) => a.tipo === 'error');

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 font-sans min-[640px]:left-auto min-[640px]:right-6 min-[640px]:w-[380px]">
      <div role="alert" aria-live="assertive" className="flex w-full flex-col gap-2">
        {errores.map((a) => (
          <Tostada key={a.id} aviso={a} cerrar={() => setAvisos((p) => p.filter((x) => x.id !== a.id))} />
        ))}
      </div>
      <div role="status" aria-live="polite" className="flex w-full flex-col gap-2">
        {exitos.map((a) => (
          <Tostada key={a.id} aviso={a} cerrar={() => setAvisos((p) => p.filter((x) => x.id !== a.id))} />
        ))}
      </div>
    </div>
  );
}

function Tostada({ aviso, cerrar }: { aviso: Aviso; cerrar: () => void }) {
  const error = aviso.tipo === 'error';
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-[12px] border border-linea border-l-[5px] bg-panel px-4 py-3 shadow-[0_10px_30px_rgba(23,127,111,0.16)]',
        error ? 'border-l-magenta' : 'border-l-teal',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white',
          error ? 'bg-magenta' : 'bg-teal',
        )}
      >
        {error ? '!' : '✓'}
      </span>
      <p className="flex-1 text-[14px] font-semibold leading-snug text-titular">{aviso.texto}</p>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar aviso"
        className="-mr-1 shrink-0 px-1 text-[18px] leading-none text-gris hover:text-titular"
      >
        ×
      </button>
    </div>
  );
}
