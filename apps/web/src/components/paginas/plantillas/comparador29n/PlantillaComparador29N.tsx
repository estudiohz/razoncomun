import { Contenedor } from '@/components/layout/Contenedor';
import type { PropsPlantilla } from '../index';
import { APARTADOS } from './apartados';
import { ALTERNATIVAS_RC } from './alternativasRc';
import { PARTIDOS } from './tipos';
import { BotonJuego, Modos } from './Modos';
import { LeyendaSiColumnas } from './Comparador';
import { BotonVista } from './vista';

/**
 * Plantilla «comparador-29n» (diseño A). Servidor: cabecera + intro del
 * editor; los apartados (JSON con cita y verificación) van al comparador.
 */
/** Fecha y hora de la última revisión de los datos: actualizar al tocar los JSON. */
const REVISADO = '27/11/2026';

export function PlantillaComparador29N({ pagina, introHtml }: PropsPlantilla) {
  return (
    <>
      <Contenedor as="section" className="pt-12 min-[720px]:pt-16">
        <div className="flex flex-col gap-2.5">
          <div className="h-1.5 w-[120px] rounded-full" style={{ background: 'linear-gradient(90deg,#1B3D9C,#8B30D9,#C3369E,#E8792F,#16B8A0,#2BC7E8)' }} />
          <p className="text-[12px] font-bold uppercase tracking-[.14em] text-gris">Elecciones generales · 29 de noviembre</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="max-w-[860px] text-[clamp(30px,4.6vw,46px)] font-extrabold leading-[1.05] text-titular">{pagina.title}</h1>
            <BotonVista />
          </div>
          {introHtml ? (
            <div className="prose-rc max-w-[700px]" dangerouslySetInnerHTML={{ __html: introHtml }} />
          ) : (
            <p className="max-w-[680px] text-[16px] leading-[1.55] text-cuerpo">
              Lo que propone cada fuerza, citado de su programa y analizado con fuentes oficiales. Debajo, la propuesta de Razón Común.
            </p>
          )}
          <p className="text-[12.5px] text-gris">
            PP, PSOE, Vox y Frente Amplio · Revisado el {REVISADO}
          </p>
          <div className="flex flex-wrap items-center gap-3">
          <details className="group min-w-[280px] max-w-[760px] flex-1 rounded-[12px] border border-linea bg-white px-4 py-3">
            <summary className="flex min-h-[32px] cursor-pointer list-none items-center justify-between text-[13px] font-bold text-titular">
              Cómo lo hemos hecho
              <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
            </summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13.5px] leading-[1.5] text-cuerpo">
              <li><b>Quién:</b> el equipo de Razón Común, con ayuda de IA y revisión humana.</li>
              <li><b>Qué partidos:</b> las cuatro fuerzas con más diputados y candidatura en toda España. Por falta de medios no hemos podido analizar al resto.</li>
              <li><b>Las propuestas</b> salen del programa oficial 2026 de cada partido, con su página.</li>
              <li><b>El círculo es nuestro análisis</b> y solo mide si la medida cabe en la ley y en las competencias de quien la propone: verde, posible; naranja, necesita a otra administración, reformar una ley o cumplir condiciones; rojo, choca con una norma o sentencia concreta, siempre citada; gris, no evaluable por falta de concreción o de base. Mismo criterio para todos.</li>
              <li><b>Competencia, coste y plazo</b> se muestran aparte y no cambian el color: que un partido no dé coste no hace inviable su propuesta.</li>
              <li><b>Nuestras propuestas</b> van aparte y sin círculo: no nos ponemos nota.</li>
            </ul>
          </details>
          <BotonJuego />
          <LeyendaSiColumnas />
          </div>
        </div>
      </Contenedor>
      <Contenedor className="py-10 min-[720px]:py-12">
        <Modos apartados={APARTADOS} partidos={PARTIDOS} rc={ALTERNATIVAS_RC} />
        <p className="mt-10 max-w-[820px] text-[12.5px] leading-relaxed text-gris">
          Cada propuesta enlaza a la página de su programa oficial. Durante la legislatura marcaremos cada propuesta como cumplida, en parte o incumplida, con su fuente; en las próximas elecciones ese historial medirá la credibilidad de cada fuerza, la nuestra incluida.
        </p>
      </Contenedor>
    </>
  );
}
