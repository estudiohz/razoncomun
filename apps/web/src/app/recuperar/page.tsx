import type { Metadata } from 'next';
import { PlaceholderPrivado } from '@/components/layout/PlaceholderPrivado';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Recuperar acceso',
  descripcion: 'Recupera el acceso a tu cuenta de Razón Común.',
  ruta: '/recuperar',
  noindex: true,
});

export default function RecuperarPage() {
  return (
    <PlaceholderPrivado
      titulo="Recuperar acceso"
      descripcion="El restablecimiento de contraseña se construye en la Ola 2."
      dueño="Identidad/Auth (rc-03)"
    />
  );
}
