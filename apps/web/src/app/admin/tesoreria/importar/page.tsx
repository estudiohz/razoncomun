import type { Metadata } from 'next';
import Link from 'next/link';
import { metadatosPagina } from '@/lib/seo';
import { requireTesoreria } from '@/lib/tesoreria/guard';
import { ImportarClient } from './ImportarClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Importar extracto',
  descripcion: 'Importación del extracto bancario al libro de tesorería.',
  ruta: '/admin/tesoreria/importar',
  noindex: true,
});

export default async function ImportarPage() {
  await requireTesoreria('/admin/tesoreria/importar');

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5">
      <div>
        <Link href="/admin/tesoreria" className="text-[13.5px] text-gris no-underline hover:underline">
          ← Volver a Tesorería
        </Link>
        <h1 className="mt-3 text-[24px] font-extrabold leading-tight min-[720px]:text-[32px]">
          Importar extracto
        </h1>
        <p className="mt-1 text-[13.5px] text-gris">
          Sube el fichero de movimientos que descargas del banco. Puedes subir el mismo periodo
          varias veces sin miedo: los movimientos que ya estén registrados se ignoran.
        </p>
      </div>

      <ImportarClient />
    </div>
  );
}
