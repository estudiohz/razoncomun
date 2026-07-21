import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { NuevaAreaClient } from './NuevaAreaClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Nueva área del presupuesto',
  descripcion: 'Alta de una nueva área raíz del Simulador del Presupuesto del País.',
  ruta: '/admin/presupuesto',
  noindex: true,
});

export default async function NuevaAreaPage() {
  await requireAdminOrEditor('/admin/presupuesto');

  return (
    <div className="space-y-6">
      <Link href="/admin/presupuesto" className="text-[13px] font-semibold text-gris hover:text-titular">
        ← Volver al tablero
      </Link>
      <h1 className="text-[22px] font-extrabold text-titular">Nueva área</h1>
      <NuevaAreaClient />
    </div>
  );
}
