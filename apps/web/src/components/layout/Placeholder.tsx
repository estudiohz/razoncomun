import type { ReactNode } from 'react';
import { Contenedor } from './Contenedor';
import { Boton } from '@/components/ui/Boton';

/**
 * Placeholder branded para rutas cuyo contenido real construye otro agente.
 * Mantiene el árbol de rutas, el SEO y la navegación sin 404. `dueño` deja
 * constancia de a quién le corresponde el módulo definitivo.
 */
export function Placeholder({
  eyebrow,
  titulo,
  descripcion,
  dueño,
  children,
}: {
  eyebrow: string;
  titulo: string;
  descripcion: string;
  dueño?: string;
  children?: ReactNode;
}) {
  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
          {eyebrow}
        </span>
        <h1 className="mt-3 text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.12]">
          {titulo}
        </h1>
        <p className="mx-auto mt-4 max-w-[60ch] text-[17px] text-cuerpo">{descripcion}</p>
        {children}
        <div className="mt-8 flex flex-wrap justify-center gap-3.5">
          <Boton href="/" variante="suave">
            Volver a la home
          </Boton>
          <Boton href="/afiliate" variante="grad">
            Afíliate
          </Boton>
        </div>
        {dueño ? (
          <p className="mt-10 text-[12.5px] text-gris">Sección en construcción.</p>
        ) : null}
      </div>
    </Contenedor>
  );
}
