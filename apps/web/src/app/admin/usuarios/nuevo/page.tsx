import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { NuevoUsuarioForm } from '../NuevoUsuarioForm';

export const dynamic = 'force-dynamic';

export default async function NuevoUsuarioPage() {
  // Crear cuentas (y sobre todo admins) es solo para admin; el middleware ya
  // exige aal2 para todo /admin. requireAdmin es la segunda puerta.
  await requireAdmin('/admin/usuarios/nuevo');

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/usuarios" className="text-[13px] text-gris no-underline hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-[24px] font-extrabold">Añadir usuario</h1>
        <p className="mt-1 max-w-[60ch] text-[13.5px] text-gris">
          Crea una cuenta nueva y envíale una invitación por email para que active su cuenta y elija
          su contraseña. Si la persona <strong>ya tiene cuenta</strong>, no la crees aquí: búscala en
          el listado y asígnale el rol desde su ficha.
        </p>
      </div>

      <Tarjeta className="max-w-[680px] p-6">
        <NuevoUsuarioForm />
      </Tarjeta>
    </div>
  );
}
