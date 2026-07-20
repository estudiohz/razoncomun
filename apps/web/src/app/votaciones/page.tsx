import type { Metadata } from 'next';
import { PlaceholderPrivado } from '@/components/layout/PlaceholderPrivado';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Votaciones',
  descripcion: 'Votaciones abiertas de Razón Común.',
  ruta: '/votaciones',
  noindex: true,
});

export default function VotacionesPage() {
  return (
    <PlaceholderPrivado
      titulo="Votaciones"
      descripcion="Las votaciones con censo congelado se construyen en la Ola 3."
      dueño="Programa Vivo (rc-06)"
    />
  );
}
