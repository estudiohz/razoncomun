import type { Metadata } from 'next';
import { PlaceholderPrivado } from '@/components/layout/PlaceholderPrivado';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Entrar',
  descripcion: 'Accede a tu cuenta de Razón Común.',
  ruta: '/entrar',
  noindex: true,
});

export default function EntrarPage() {
  return (
    <PlaceholderPrivado
      titulo="Entrar"
      descripcion="El acceso, registro y recuperación de cuenta se construyen en la Ola 2."
      dueño="Identidad/Auth (rc-03)"
    />
  );
}
