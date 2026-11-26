import { Contenedor } from '@/components/layout/Contenedor';
import { sanearHtml } from '@/lib/blog/html';
import type { PropsPlantilla } from '../index';
import { APARTADOS } from './apartados';
import { ALTERNATIVAS_RC } from './alternativasRc';
import { PARTIDOS } from './tipos';
import { Comparador } from './Comparador';

/**
 * Plantilla «comparador-29n» (diseño A). Servidor: cabecera + intro del
 * editor; los apartados (JSON con cita y verificación) van al comparador.
 */
export function PlantillaComparador29N({ pagina, introHtml }: PropsPlantilla) {
  const rcHtml = Object.fromEntries(Object.entries(ALTERNATIVAS_RC).map(([k, v]) => [k, sanearHtml(v)]));
  return (
    <>
      <Contenedor as="section" className="pt-12 min-[720px]:pt-16">
        <div className="flex flex-col gap-2.5">
          <div className="h-1.5 w-[120px] rounded-full" style={{ background: 'linear-gradient(90deg,#1B3D9C,#8B30D9,#C3369E,#E8792F,#16B8A0,#2BC7E8)' }} />
          <p className="text-[12px] font-bold uppercase tracking-[.14em] text-gris">Elecciones generales · 29 de noviembre</p>
          <h1 className="max-w-[860px] text-[clamp(30px,4.6vw,46px)] font-extrabold leading-[1.05] text-titular">{pagina.title}</h1>
          {introHtml ? (
            <div className="prose-rc max-w-[700px]" dangerouslySetInnerHTML={{ __html: introHtml }} />
          ) : (
            <p className="max-w-[680px] text-[16px] leading-[1.55] text-cuerpo">
              Lo que propone cada fuerza, citado de su programa y verificado con fuentes oficiales. Y al lado, la alternativa de Razón Común.
            </p>
          )}
        </div>
      </Contenedor>
      <Contenedor className="py-10 min-[720px]:py-12">
        <Comparador apartados={APARTADOS} partidos={PARTIDOS} rcHtml={rcHtml} />
        <p className="mt-10 max-w-[820px] text-[12.5px] leading-relaxed text-gris">
          Cada propuesta enlaza a la página de su programa oficial. La verificación aplica el mismo criterio a todas las fuerzas, con fuentes oficiales: verde, viable tal como se plantea; naranja, viable con matices; rojo, inviable tal cual o en conflicto con la ley o la normativa europea. ¿Ves un error? Escríbenos y lo corregimos.
        </p>
      </Contenedor>
    </>
  );
}
