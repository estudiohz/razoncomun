import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { darDeBajaCuenta } from '@/lib/auth/baja';

/**
 * Baja de cuenta self-service (RGPD, derecho de supresión).
 *
 * BUG QUE ARREGLA (04/09/2026): esta ruta NO PODÍA FUNCIONAR NUNCA, para
 * nadie. Insertaba en `audit_log` una fila con `actor_id` = el propio usuario
 * y acto seguido llamaba a `deleteUser`; como `audit_log.actor_id` referencia
 * `profiles(id)`, esa misma fila bloqueaba el borrado. El comentario anterior
 * razonaba que había que insertar ANTES "porque después la FK ya no existiría"
 * — y esa era justo la elección que lo rompía. Ni una cuenta recién creada sin
 * actividad podía darse de baja, y la respuesta invitaba a reintentar algo que
 * nunca iba a salir bien.
 *
 * Ahora la baja anonimiza (0055) en vez de borrar, así que la fila del perfil
 * sobrevive y el asiento de auditoría no estorba. El orden pasa a ser el
 * natural: primero se da de baja, después se registra.
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

  const admin = createAdminClient();
  const baja = await darDeBajaCuenta(admin, user.id, 'Baja solicitada por la propia persona.');

  if (!baja.ok) {
    console.error('[perfil/borrar] no se pudo dar de baja', user.id, baja.error);
    return NextResponse.json(
      { error: 'No hemos podido cerrar tu cuenta. Escríbenos y lo hacemos a mano.' },
      { status: 500 },
    );
  }

  // Se registra DESPUÉS y con el cliente admin: el perfil ya está anonimizado
  // y la sesión a punto de cerrarse, así que la propia sesión del usuario ya
  // no serviría para insertar. Sin el email — el asiento sobrevive a la
  // persona y no debe seguir identificándola justo cuando se ha ido.
  await admin.from('audit_log').insert({
    actor_id: user.id,
    action: 'gdpr_self_anonymize',
    entity: 'profiles',
    entity_id: user.id,
    meta: { origen: 'self_service', retiene_datos_fiscales: baja.retieneDatosFiscales },
  });

  await supabase.auth.signOut();

  // `retieneDatosFiscales` no es un detalle: si la persona pagó cuota, el NIF y
  // el espejo de Stripe se conservan por obligación tributaria (Modelo 182,
  // LO 8/2007) y hay que decírselo, no dejar que crea que no queda nada.
  return NextResponse.json({ ok: true, retieneDatosFiscales: baja.retieneDatosFiscales });
}
