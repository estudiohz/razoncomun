'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * El widget embebido de Discord (iframe oficial de discord.com/widget),
 * cargado SOLO al entrar en el viewport (Sergio, 16/09/2026).
 *
 * Por qué diferir: es un iframe de un dominio ajeno — trae su propio JS,
 * abre su propia conexión y pinta antes de que nadie haya bajado hasta
 * aquí. En el hero y el resto de la home ya se paga el coste del vídeo y
 * las imágenes; sumarle esto de entrada penaliza el LCP de toda la página
 * por algo que, en el 90% de las visitas que no llegan a hacer scroll,
 * nadie ve. `rootMargin` adelanta la carga un poco (200px) para que el
 * iframe ya esté listo cuando la sección entra del todo en pantalla, en
 * vez de que se vea aparecer en blanco.
 */
export function DiscordWidgetEnVivo({ serverId }: { serverId: string }) {
  const [visible, setVisible] = useState(false);
  const marcoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) return;
    const el = marcoRef.current;
    if (!el) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [visible]);

  return (
    <div ref={marcoRef} className="rounded-[24px] bg-grad p-3.5 shadow-[0_30px_60px_rgba(0,0,0,.35)]">
      <div className="h-[420px] overflow-hidden rounded-[16px] bg-[#0b0e14]">
        {visible ? (
          <iframe
            src={`https://discord.com/widget?id=${serverId}&theme=dark`}
            width="100%"
            height="420"
            allowTransparency
            title="Widget del servidor de Discord de Razón Común"
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            loading="lazy"
            className="block border-0"
          />
        ) : (
          // Réplica en CSS del widget, en reposo: mismo alto y colores que
          // el real, para que no haya salto de layout cuando el iframe
          // termine de cargar (y algo digno que enseñar mientras tanto).
          <div className="flex h-full flex-col justify-between bg-[#2b2d31] px-4 py-3.5 text-[#949ba4]">
            <div className="flex items-center justify-between border-b border-white/[.06] pb-3">
              <span className="text-[15px] font-bold text-white">Razón Común</span>
              <span className="flex items-center gap-1.5 text-[12px]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#23a55a]" />
                Conectando…
              </span>
            </div>
            <div className="space-y-2 py-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-white/10" />
                  <span
                    className="h-3 animate-pulse rounded bg-white/10"
                    style={{ width: `${60 - i * 6}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-white/[.06] pt-3 text-[12px]">discord.gg/yxPNMsSy</div>
          </div>
        )}
      </div>
    </div>
  );
}
