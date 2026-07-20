import type { Metadata } from 'next';
import { PlaceholderPrivado } from '@/components/layout/PlaceholderPrivado';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Mi perfil',
  descripcion: 'Tu área personal en Razón Común.',
  ruta: '/perfil',
  noindex: true,
});

export default function PerfilPage() {
  return (
    <PlaceholderPrivado
      titulo="Mi perfil"
      descripcion="Tus votos, propuestas y nivel de participación vivirán aquí tras la Ola 2."
      dueño="Identidad/Auth (rc-03)"
    />
  );
}
