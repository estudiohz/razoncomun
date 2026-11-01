import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Pestañas de /admin/presupuesto: el simulador (actual) y la bandeja de auditorías (D-A17). */
export function PestanasPresupuesto({ activa }: { activa: 'presupuesto' | 'auditorias' }) {
  const pestanas = [
    { id: 'presupuesto', texto: 'Presupuesto', href: '/admin/presupuesto' },
    { id: 'auditorias', texto: 'Auditorías', href: '/admin/presupuesto/auditorias' },
  ] as const;

  return (
    <nav className="flex gap-1 border-b border-linea" aria-label="Secciones de presupuesto">
      {pestanas.map((p) => (
        <Link
          key={p.id}
          href={p.href}
          aria-current={activa === p.id ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-4 py-2.5 text-[13.5px] font-bold no-underline',
            activa === p.id ? 'border-accion text-titular' : 'border-transparent text-gris hover:text-titular',
          )}
        >
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}
