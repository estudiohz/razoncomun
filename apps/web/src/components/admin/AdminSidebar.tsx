'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { adminNav } from '@/lib/admin/nav';

export function AdminSidebar({ esAdmin }: { esAdmin: boolean; esEditor: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] shrink-0">
      <nav className="sticky top-6 space-y-1 rounded-tarjeta border border-linea bg-panel p-3 shadow-nav">
        {adminNav.map((item) => {
          const activo = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          const bloqueado = item.soloAdmin && !esAdmin;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between rounded-boton px-3 py-2 text-[13.5px] font-semibold no-underline transition-colors',
                activo ? 'bg-accion text-white' : 'text-cuerpo hover:bg-fondo hover:text-titular',
              )}
            >
              <span>{item.label}</span>
              {bloqueado && (
                <span className="rounded-full bg-fondo px-2 py-0.5 text-[10px] font-bold text-gris">
                  solo admin
                </span>
              )}
              {item.dueño && (
                <span className="rounded-full bg-fondo px-2 py-0.5 text-[10px] font-bold text-gris">
                  {item.dueño}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
