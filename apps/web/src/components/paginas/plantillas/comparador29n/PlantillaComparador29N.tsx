import { Contenedor } from '@/components/layout/Contenedor';
import type { PropsPlantilla } from '../index';
import datos from './datos-partidos.json';
import { ALTERNATIVAS_RC } from './alternativasRc';
import { Comparador, type DatosComparador } from './Comparador';

/**
 * Plantilla «comparador-29n». Servidor: monta cabecera + intro del editor y
 * pasa los datos (JSON con fuentes) al comparador interactivo de cliente.
 */
export function PlantillaComparador29N({ pagina, introHtml }: PropsPlantilla) {
  const d = datos as DatosComparador;
  return (
    <>
      <section className="border-b border-linea bg-[linear-gradient(120deg,rgba(43,199,232,.10),rgba(139,48,217,.08)_45%,rgba(232,121,47,.08))]">
        <Contenedor className="py-12 min-[720px]:py-16">
          <p className="text-[12px] font-bold uppercase tracking-[.12em] text-accion">Elecciones generales · 29 de noviembre</p>
          <h1 className="mt-3 max-w-[820px] text-[clamp(30px,4.6vw,52px)] font-extrabold leading-[1.05] text-titular">
            {pagina.title}
          </h1>
          {introHtml ? (
            <div className="prose-rc mt-5 max-w-[720px]" dangerouslySetInnerHTML={{ __html: introHtml }} />
          ) : (
            <p className="mt-5 max-w-[720px] text-[17px] text-cuerpo">
              Lo que proponen las principales fuerzas, tema a tema, con enlace a la fuente. Y al lado, la alternativa de Razón Común.
            </p>
          )}
        </Contenedor>
      </section>
      <Contenedor className="py-10 min-[720px]:py-14">
        <Comparador datos={d} alternativas={ALTERNATIVAS_RC} />
        <p className="mt-10 text-[12.5px] text-gris">
          Datos recopilados a {d.actualizado}. Cada propuesta enlaza a su fuente; si un partido no recoge nada sobre un tema lo indicamos sin rellenar. Tu selección se calcula solo en tu navegador: no guardamos nada.
        </p>
      </Contenedor>
    </>
  );
}
