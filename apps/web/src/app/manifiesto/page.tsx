import type { Metadata } from 'next';
import { Placeholder } from '@/components/layout/Placeholder';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'El manifiesto',
  descripcion:
    'Los 30 puntos de gestión real de Razón Común: idoneidad profesional, voto blindado con DNI-e, burocracia cero, muerte civil por corrupción. Medidas concretas, no promesas.',
  ruta: '/manifiesto',
});

export default function ManifiestoPage() {
  return (
    <Placeholder
      eyebrow="El manifiesto"
      titulo="30 puntos de gestión real"
      descripcion="El programa fundacional son 30 puntos concretos y técnicos, no promesas vagas. Idoneidad profesional obligatoria, voto blindado, burocracia cero en 24h y trazabilidad total del impuesto personal."
      dueño="el Panel Admin (rc-09) y Contenido (rc-05)"
    />
  );
}
