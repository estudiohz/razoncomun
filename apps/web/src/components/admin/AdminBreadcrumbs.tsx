'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNav } from '@/lib/admin/nav';

/** Un UUID o id largo no aporta nada legible en las migas: se etiqueta. */
function etiquetaSegmento(seg: string): string {
  if (seg === 'nuevo') return 'Nuevo';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || seg.length > 24) return 'Editar';
  return seg;
}

/** Migas de pan simples: Panel / Sección / (id si aplica). */
export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const segmentos = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);

  const seccion = segmentos[0] ? adminNav.find((n) => n.href === `/admin/${segmentos[0]}`) : null;

  return (
    <nav aria-label="Migas de pan" className="text-[12.5px] text-gris">
      <Link href="/admin" className="no-underline hover:text-titular">
        Panel
      </Link>
      {seccion && (
        <>
          <span className="mx-1.5">/</span>
          <Link href={seccion.href} className="no-underline hover:text-titular">
            {seccion.label}
          </Link>
        </>
      )}
      {segmentos.length > 1 && (
        <>
          <span className="mx-1.5">/</span>
          <span>{segmentos.slice(1).map(etiquetaSegmento).join(' / ')}</span>
        </>
      )}
    </nav>
  );
}
