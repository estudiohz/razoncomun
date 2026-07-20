import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { FormularioPropuesta } from '@/components/participacion/FormularioPropuesta';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Proponer algo nuevo',
  descripcion: 'Publica una propuesta concreta para el programa vivo de Razón Común.',
  ruta: '/propuestas/nueva',
  noindex: true,
});

/** Requiere sesión (registered+): cualquier autenticado puede proponer (proposals_insert_registered). */
export default async function NuevaPropuestaPage() {
  await requireUsuario('/propuestas/nueva');

  return (
    <Contenedor as="section" className="py-14">
      <header className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Programa vivo</span>
        <h1 className="mt-3 text-[clamp(28px,4vw,38px)] font-extrabold leading-[1.12]">
          Proponer algo nuevo
        </h1>
        <p className="mx-auto mt-3 max-w-[60ch] text-[15.5px] text-cuerpo">
          Sé concreto: un problema, una solución, un coste estimado. La comunidad delibera y aporta
          matices, el test de estrés comprueba si aguanta, y la afiliación decide si entra en el
          programa.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-[640px]">
        <FormularioPropuesta />
      </div>
    </Contenedor>
  );
}
