import type { Metadata } from 'next';
import { Placeholder } from '@/components/layout/Placeholder';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Programa vivo',
  descripcion:
    'El programa de Razón Común evoluciona con evidencia. Propuestas con coste estimado, deliberación y votación con trazabilidad total. La política como mejora continua.',
  ruta: '/programa',
});

export default function ProgramaPage() {
  return (
    <Placeholder
      eyebrow="Programa vivo"
      titulo="Un programa que evoluciona con los datos"
      descripcion="Cada propuesta se mide, se simula y se corrige. Aquí vivirá el programa vivo: propuestas con coste estimado, deliberación abierta y votación con censo congelado."
      dueño="Programa Vivo (rc-06)"
    />
  );
}
