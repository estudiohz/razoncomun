import type { Metadata } from 'next';
import { PlaceholderPrivado } from '@/components/layout/PlaceholderPrivado';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Panel de administración',
  descripcion: 'Panel interno de Razón Común.',
  ruta: '/admin',
  noindex: true,
});

export default function AdminPage() {
  return (
    <PlaceholderPrivado
      titulo="Panel de administración"
      descripcion="El CMS a medida (usuarios, cargos, manifiesto, moderación) se construye en la Ola 3."
      dueño="Panel Admin (rc-09)"
    />
  );
}
