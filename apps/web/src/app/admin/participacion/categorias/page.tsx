import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { CategoriasPropuestasClient, type FilaCategoriaPropuesta } from './CategoriasPropuestasClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Categorías del tablero de propuestas',
  descripcion: 'Gestión de las categorías del tablero de propuestas (D-P2).',
  ruta: '/admin/participacion/categorias',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default async function CategoriasPropuestasPage() {
  const { supabase } = await requireAdminOrEditor('/admin/participacion/categorias');

  const [{ data: categorias, error }, { data: propuestas }] = await Promise.all([
    supabase.from('proposal_categories').select('id, nombre, color, orden').order('orden'),
    supabase.from('proposals').select('category_id'),
  ]);

  const conteos = new Map<string, number>();
  for (const p of propuestas ?? []) {
    const id = (p as { category_id: string | null }).category_id;
    if (!id) continue;
    conteos.set(id, (conteos.get(id) ?? 0) + 1);
  }

  const filas: FilaCategoriaPropuesta[] = (categorias ?? []).map((c, i, arr) => ({
    id: c.id,
    nombre: c.nombre,
    color: c.color,
    propuestas: conteos.get(c.id) ?? 0,
    esPrimera: i === 0,
    esUltima: i === arr.length - 1,
  }));

  return (
    <div className="py-2">
      <Link href="/admin/participacion" className="text-[14px] text-gris no-underline hover:underline">
        ← Volver a Participación
      </Link>
      <h1 className="mb-2 mt-3 text-[24px] font-bold leading-tight text-titular min-[720px]:text-[32px]">
        Categorías del tablero de propuestas
      </h1>
      <p className="mb-6 max-w-2xl text-[13.5px] text-gris">
        Reemplazan al antiguo <code>department</code> (texto libre) en la UI nueva del tablero. El
        orden aquí es el orden del sidebar público.
      </p>

      {error ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          No se han podido cargar las categorías: {error.message}
        </p>
      ) : (
        <CategoriasPropuestasClient filas={filas} />
      )}
    </div>
  );
}
