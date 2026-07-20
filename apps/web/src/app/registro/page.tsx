import type { Metadata } from 'next';
import { PlaceholderPrivado } from '@/components/layout/PlaceholderPrivado';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Registro',
  descripcion: 'Crea tu cuenta de Razón Común.',
  ruta: '/registro',
  noindex: true,
});

export default function RegistroPage() {
  return (
    <PlaceholderPrivado
      titulo="Crear cuenta"
      descripcion="El alta de usuarios se construye en la Ola 2."
      dueño="Identidad/Auth (rc-03)"
    />
  );
}
