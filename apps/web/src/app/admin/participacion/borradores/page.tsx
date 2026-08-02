import type { Metadata } from 'next';
import Link from 'next/link';
import { metadatosPagina } from '@/lib/seo';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import { listarBorradores } from '@/lib/participacion/drafts';
import { BorradoresClient } from './BorradoresClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Borradores',
  descripcion: 'Propuestas en borrador pendientes de revisión.',
  ruta: '/admin/participacion/borradores',
  noindex: true,
});

/**
 * Cola de revisión de borradores (D-U5, ola U3). Aquí aterrizan las propuestas
 * que entran por el RC-bot: nacen en `draft` por un trigger de BD y no son
 * públicas hasta que alguien las revisa y las publica.
 */
export default async function AdminBorradoresPage() {
  const { supabase } = await requireAdminOCoordinador('/admin/participacion/borradores');
  const borradores = await listarBorradores(supabase);

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6">
      <header>
        <Link href="/admin/participacion" className="text-[13.5px] text-gris no-underline hover:underline">
          ← Volver a Participación
        </Link>
        <h1 className="text-[clamp(24px,3.4vw,32px)] font-extrabold leading-tight">Borradores</h1>
        <p className="mt-1 text-[14px] text-gris">
          Propuestas sin publicar. Las que llegan del RC-bot entran siempre aquí: no son visibles
          para nadie más que su autor y el equipo editor hasta que se publican.
        </p>
      </header>

      <BorradoresClient borradores={borradores} />
    </div>
  );
}
