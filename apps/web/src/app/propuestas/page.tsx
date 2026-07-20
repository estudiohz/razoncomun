import type { Metadata } from 'next';
import { PlaceholderPrivado } from '@/components/layout/PlaceholderPrivado';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Propuestas',
  descripcion: 'Participa en las propuestas de Razón Común.',
  ruta: '/propuestas',
  noindex: true,
});

export default function PropuestasPage() {
  return (
    <PlaceholderPrivado
      titulo="Propuestas"
      descripcion="El tablero de propuestas y deliberación se construye en la Ola 3."
      dueño="Programa Vivo (rc-06)"
    />
  );
}
