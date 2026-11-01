import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { metadatosPagina } from '@/lib/seo';
import { auditoriaAbierta } from '@/lib/vigia/publico';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Metodología de la auditoría del gasto público',
  descripcion: 'Cómo elegimos, verificamos y publicamos cada caso, qué suma el contador, cómo usamos la IA y cómo pedir una rectificación.',
  ruta: '/observatorio/auditorias/metodologia',
  noindex: !auditoriaAbierta(),
});

/** Responsable editorial (D-A11): se fija en el entorno cuando Sergio lo decida. */
const RESPONSABLE = process.env.AUDITORIA_RESPONSABLE?.trim() || 'Razón Común';

/**
 * Metodología pública (M4, M8): qué es un caso, cómo se verifica, qué suma el
 * contador, uso de IA, derecho de réplica y rectificación, conservación de
 * pruebas. Es el texto que da credibilidad al contador: si cambia el método,
 * cambia aquí.
 */
export default function MetodologiaPage() {
  return (
    <Contenedor as="article" className="py-14">
      <div className="mx-auto w-full max-w-[760px] space-y-8 text-[15.5px] leading-relaxed text-cuerpo">
        <Link href="/observatorio/auditorias" className="text-[13.5px] font-semibold underline">
          ← Auditoría del gasto público
        </Link>
        <h1 className="text-[clamp(28px,4vw,40px)] font-extrabold leading-tight text-titular">Cómo lo hacemos</h1>

        <Bloque titulo="Qué es un caso">
          Un gasto público concreto (un contrato o una subvención) que ha circulado en redes sociales o en prensa. Partimos del
          trabajo de otros y siempre citamos el origen: el reel, el artículo o la web, con su autor.
        </Bloque>

        <Bloque titulo="Cómo se verifica">
          Buscamos el expediente en la fuente oficial: la Base de Datos Nacional de Subvenciones (BDNS), el BOE o la Plataforma
          de Contratación del Sector Público. Comparamos organismo, beneficiario, importe y fecha. Guardamos una copia del
          documento oficial con su huella digital (SHA-256) y la fecha, para poder demostrar qué decía aunque después cambie.
          Una persona del equipo de auditoría revisa cada caso y lo firma con su nombre antes de publicarlo.
        </Bloque>

        <Bloque titulo="Hechos y opinión, por separado">
          Cada ficha separa los <strong>hechos verificados</strong> (lo que dicen los documentos) de la{' '}
          <strong>valoración de Razón Común</strong> (lo que opinamos). No imputamos delitos ni usamos calificativos sobre
          personas o empresas. De las personas físicas solo publicamos los datos imprescindibles.
        </Bloque>

        <Bloque titulo="Qué suma el contador">
          «Gasto público señalado» suma el <strong>importe oficial</strong> (no el que se difundió) de los casos publicados cuya
          fuente oficial coincide total o parcialmente con lo denunciado. No suman los casos en revisión, los desmentidos por la
          fuente ni los rectificados. Señalar un gasto no significa que sea ilegal: significa que merece explicación.
        </Bloque>

        <Bloque titulo="Uso de inteligencia artificial">
          Usamos IA para transcribir el audio de los reels y hacer una primera extracción de datos (organismo, importe,
          beneficiario). Esa extracción es solo un borrador: nada se publica sin que una persona lo compruebe contra la fuente
          oficial y lo firme. Cada ficha indica el modelo utilizado.
        </Bloque>

        <Bloque titulo="Derecho de réplica y rectificación">
          Antes de publicar un caso que nombra a una empresa o a una persona, le pedimos su versión y la incluimos si responde.
          Cualquier persona afectada puede pedir una rectificación desde la propia ficha: respondemos en 3 días como máximo. Si
          hay que corregir algo, la ficha lo indica con un aviso visible y conserva el historial de versiones.
        </Bloque>

        <Bloque titulo="Conservación">
          Guardamos las copias de las pruebas y del origen durante al menos cuatro años, en un almacenamiento privado, para poder
          acreditar en cualquier momento qué se publicó y en qué se basaba.
        </Bloque>

        <Bloque titulo="Responsable editorial">
          {RESPONSABLE}. Para cualquier cuestión sobre un caso, usa el formulario de rectificación de su ficha.
        </Bloque>
      </div>
    </Contenedor>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[19px] font-extrabold text-titular">{titulo}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
