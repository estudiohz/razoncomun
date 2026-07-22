import Link from 'next/link';
import { requireEditor } from '@/lib/blog/guard';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { Pagina } from '@/lib/paginas';

export const dynamic = 'force-dynamic';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-accion/10 px-2 py-0.5 text-[11px] font-bold text-accion">
      {children}
    </span>
  );
}

export default async function PaginasAdminPage() {
  const { supabase } = await requireEditor();
  const { data } = await supabase.from('pages').select('*').order('position').order('title');
  const paginas = (data ?? []) as Pagina[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold">Páginas</h1>
          <p className="mt-1 text-[13.5px] text-gris">
            Páginas estáticas (legales, estatutos…). Cada una elige en qué menús aparece.
          </p>
        </div>
        <Link
          href="/admin/paginas/nueva"
          className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white shadow-boton"
        >
          + Añadir página
        </Link>
      </div>

      <Tarjeta className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-linea text-[12px] uppercase tracking-wide text-gris">
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Menús</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {paginas.map((p) => (
              <tr key={p.id} className="border-b border-linea last:border-0">
                <td className="px-4 py-3 font-semibold text-titular">{p.title}</td>
                <td className="px-4 py-3 font-mono text-[12.5px] text-gris">/{p.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {p.show_header && <Chip>Header</Chip>}
                    {p.show_footer && <Chip>Footer</Chip>}
                    {p.show_legal && <Chip>Legal</Chip>}
                    {!p.show_header && !p.show_footer && !p.show_legal && (
                      <span className="text-[12px] text-gris">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      p.published
                        ? 'rounded-full bg-accion/10 px-2.5 py-1 text-[12px] font-bold text-accion'
                        : 'rounded-full bg-gris/15 px-2.5 py-1 text-[12px] font-bold text-gris'
                    }
                  >
                    {p.published ? 'Publicada' : 'Borrador'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/paginas/${p.id}`}
                    className="font-semibold text-titular no-underline hover:underline"
                  >
                    Editar →
                  </Link>
                </td>
              </tr>
            ))}
            {paginas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gris">
                  Todavía no hay páginas. Crea la primera.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
