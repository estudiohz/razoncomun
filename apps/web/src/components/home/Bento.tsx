import Image from 'next/image';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';

const celdaBase =
  'group relative flex flex-col justify-end overflow-hidden rounded-celda border border-linea bg-panel p-[26px] no-underline ' +
  'transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-tarjeta ' +
  'max-[960px]:!col-span-1 max-[960px]:!row-span-1 max-[960px]:min-h-[150px]';

/** Cuadrícula bento: manifiesto, dato, imagen humana, foro, observatorio. */
export function Bento() {
  return (
    <section className="pb-[60px] pt-10">
      <Contenedor className="grid auto-rows-[150px] grid-cols-12 gap-[18px] max-[960px]:auto-rows-auto max-[960px]:grid-cols-1">
        {/* Manifiesto — 7×2, espectro completo del aro (Sergio, 02/08/2026).
            No usa `bg-grad`, que se corta en el magenta y dejaba la tarjeta sin
            melocotón, ni `bg-hero` tal cual: en una celda ancha y baja sus
            paradas comprimen el melocotón contra la esquina. `bg-hero-celda`
            es el mismo espectro con las paradas recalibradas para esta caja
            (ver tailwind.config.ts). */}
        <Link
          href="/manifiesto"
          className={`${celdaBase} col-span-7 row-span-2 justify-between bg-hero-celda !p-8 max-[960px]:min-h-[260px]`}
        >
          {/* Checklist en vez del aro (Sergio, 02/08/2026): el círculo no decía
              nada y competía con el texto. Una lista con checks sí nombra lo
              que hay dentro — 30 puntos concretos, no un manifiesto vago.
              Queda DETRÁS del texto (sin z-index; el bloque de abajo lleva
              z-[2]) y a baja opacidad, así que si en móvil el titular se cruza
              con él no estorba la lectura. */}
          <svg
            className="pointer-events-none absolute right-6 top-6 opacity-25"
            width="150"
            height="150"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 5.2l1.7 1.7L8.4 3.2M12 5.2h9.5" />
            <path d="M3 12.2l1.7 1.7L8.4 10.2M12 12.2h9.5" />
            <path d="M3 19.2l1.7 1.7L8.4 17.2M12 19.2h9.5" />
          </svg>
          <div className="relative z-[2]">
            {/* h2: primer encabezado tras el h1 del hero — mantiene el orden
                jerárquico (a11y) sin cambiar un solo píxel del boceto. */}
            <h2 className="max-w-[16ch] text-[clamp(24px,2.4vw,32px)] font-bold leading-[1.2] !text-white">
              30 puntos de gestión real
            </h2>
            <p className="mt-1 max-w-[44ch] text-[15px] text-white/85">
              Idoneidad profesional obligatoria, voto blindado con DNI-e, burocracia cero en 24h,
              muerte civil por corrupción. Medidas concretas, no promesas.
            </p>
            <span className="mt-4 inline-block text-[14.5px] font-bold text-white">
              Leer el manifiesto completo →
            </span>
          </div>
        </Link>

        {/* Dato — 5×1 */}
        <div className={`${celdaBase} col-span-5 row-span-1 justify-center`}>
          <div className="relative z-[2]">
            <div className="text-[42px] font-extrabold leading-none text-titular">
              Punto{' '}
              <em className="bg-grad bg-clip-text not-italic text-transparent">29</em>
            </div>
            <p className="text-cuerpo">
              Test de estrés para leyes: ninguna norma se aplica sin simular antes su impacto.
            </p>
            <small className="mt-1.5 block text-xs text-gris">Del manifiesto fundacional</small>
          </div>
        </div>

        {/* Imagen humana — 5×1 */}
        <Link
          href="/programa"
          className={`${celdaBase} col-span-5 row-span-1 !p-0 max-[960px]:min-h-[220px]`}
        >
          <Image
            src="/fotos/mayores-ciudad.jpg"
            alt="Personas mayores paseando por su ciudad"
            fill
            sizes="(max-width: 960px) 100vw, 40vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg,transparent 30%,rgba(11,32,72,.8))' }}
            aria-hidden
          />
          <span className="absolute bottom-[18px] left-[22px] z-[2] text-[17px] font-bold text-white">
            Un programa para todas las edades
          </span>
        </Link>

        {/* Foro — 4×1 */}
        <div className={`${celdaBase} col-span-4 row-span-1`}>
          <div>
            <div className="mb-2.5 rounded-xl bg-fondo px-4 py-3 text-[13.5px] text-cuerpo">
              <b className="font-bold text-titular">Foro:</b> ¿cómo auditarías tú el gasto público?
            </div>
            <h3 className="text-[17px] font-bold">La comunidad decide</h3>
            <p className="text-sm">Foro abierto y Discord activo.</p>
          </div>
        </div>

        {/* Observatorio — 8×1 */}
        <div
          className={`${celdaBase} col-span-8 row-span-1 !flex-row items-center justify-start gap-[26px]`}
        >
          <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-grad">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 12h4l3-8 4 16 3-8h4"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-[17px] font-bold">Observatorio de datos, actualizado a diario</h3>
            <p className="max-w-[58ch] text-sm">
              INE, Eurostat, BOE y Banco de España, traducidos a lenguaje claro y verificados antes
              de publicarse.
            </p>
          </div>
        </div>
      </Contenedor>
    </section>
  );
}
