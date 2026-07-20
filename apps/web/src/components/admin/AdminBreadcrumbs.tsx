'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNav } from '@/lib/admin/nav';

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
          <span>{segmentos.slice(1).join(' / ')}</span>
        </>
      )}
    </nav>
  );
}
