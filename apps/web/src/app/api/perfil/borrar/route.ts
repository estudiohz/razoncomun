import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Borrado de cuenta self-service (RGPD, derecho de supresión). Solo
 * `service_role` puede borrar un usuario de auth.users (admin API) — el
 * borrado en cascada de profiles/members/positions lo hacen los FK
 * `on delete cascade` definidos por rc-02-datos, no este endpoint.
 *
 * Antes de borrar se dejar constancia en `audit_log` (con la propia sesión
 * autenticada, actor_id = auth.uid(), respeta su RLS de inserción) — si se
 * insertara DESPUÉS de borrar, la FK a profiles ya no existiría.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirmacion !== 'BORRAR') {
    return NextResponse.json(
      { error: 'Falta la confirmación explícita ("BORRAR").' },
      { status: 400 },
    );
  }

  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'gdpr_self_delete',
    entity: 'profiles',
    entity_id: user.id,
    meta: { origen: 'self_service', email: user.email },
  });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: 'No hemos podido borrar la cuenta. Inténtalo de nuevo.' }, { status: 500 });
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
