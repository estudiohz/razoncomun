import { Tarjeta } from '@/components/ui/Tarjeta';

/**
 * Esqueleto de carga del panel (07/09/2026).
 *
 * POR QUÉ EXISTE. Sin un `loading.tsx`, el App Router bloquea la navegación
 * hasta tener listo el RSC entero: al pulsar un enlace del panel el navegador
 * se quedaba con la página ANTERIOR en pantalla, sin barra de progreso ni
 * cambio de ningún tipo, hasta que el servidor terminaba. Con las consultas
 * tardando lo que tardaban, eso se leía como "no ha pasado nada, ¿lo vuelvo a
 * pulsar?".
 *
 * Este fichero convierte esa espera en una respuesta inmediata: Next pinta el
 * esqueleto en cuanto se pulsa el enlace y lo sustituye por el contenido real
 * al llegar. No hace la carga más rápida —de eso se encargan la red interna y
 * los memos de los guards—, pero elimina el silencio, que es la mitad de la
 * queja.
 *
 * Cubre TODO `/admin` por herencia: cualquier sección sin `loading.tsx` propio
 * usa este.
 *
 * `aria-hidden` + el aviso para lector de pantalla: las cajas grises no
 * significan nada para quien no las ve, y anunciarlas una a una sería ruido.
 */
export default function CargandoAdmin() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <span className="sr-only">Cargando…</span>

      <div aria-hidden className="animate-pulse space-y-8">
        {/* Título */}
        <div className="h-[30px] w-[260px] rounded-[6px] bg-linea" />

        {/* Fila de métricas: el patrón del panel de inicio y de casi todas
            las secciones. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Tarjeta key={i} className="p-5">
              <div className="h-[12px] w-[110px] rounded-[4px] bg-linea" />
              <div className="mt-3 h-[32px] w-[64px] rounded-[6px] bg-linea" />
            </Tarjeta>
          ))}
        </div>

        {/* Bloque de listado/tabla */}
        <Tarjeta className="p-5">
          <div className="h-[14px] w-[170px] rounded-[4px] bg-linea" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-[13px] flex-1 rounded-[4px] bg-linea" />
                <div className="hidden h-[13px] w-[120px] rounded-[4px] bg-linea sm:block" />
                <div className="h-[13px] w-[70px] rounded-[4px] bg-linea" />
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
