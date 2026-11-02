import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { tokenBajaValido } from '@/lib/newsletter/baja';
import { fijarAvisosPorToken } from '@/lib/newsletter/preferencia';

export const metadata: Metadata = {
  title: 'Avisos por correo · Razón Común',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Baja de los avisos de participación (newsletter.md, D-N3).
 *
 * Abrir la página NO da de baja: los filtros antispam y los antivirus del
 * correo visitan los enlaces solos, y con un GET que cambiara datos media
 * lista se daría de baja sin querer. Se confirma con un botón (POST). La baja
 * de verdad "con un clic" es el POST de `List-Unsubscribe`, en
 * /api/newsletter/baja, que lo hace el propio cliente de correo.
 */
export default async function BajaAvisosPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string; hecho?: string }>;
}) {
  const { u = null, t = null, hecho } = await searchParams;
  const valido = tokenBajaValido(u, t);

  async function cambiar(formData: FormData) {
    'use server';
    const activar = formData.get('activar') === '1';
    const ok = await fijarAvisosPorToken(u, t, activar);
    redirect(`/baja-avisos?u=${u}&t=${t}&hecho=${ok ? (activar ? 'alta' : 'baja') : 'error'}`);
  }

  return (
    <main className="mx-auto flex min-h-[70svh] w-full max-w-[480px] flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-[24px] font-extrabold text-titular">Avisos de participación</h1>
      {!valido ? (
        <p className="mt-4 text-[14.5px] text-cuerpo">
          Este enlace no es válido o está incompleto. Puedes cambiar tus avisos desde{' '}
          <Link href="/panel/perfil" className="font-semibold text-titular underline">
            tu panel
          </Link>
          .
        </p>
      ) : hecho === 'baja' ? (
        <>
          <p className="mt-4 text-[14.5px] text-cuerpo">
            Hecho. No te mandaremos más avisos de encuestas por correo. Tu cuenta sigue igual.
          </p>
          <form action={cambiar} className="mt-6">
            <input type="hidden" name="activar" value="1" />
            <button type="submit" className="text-[13.5px] font-semibold text-accion underline">
              Me he equivocado, quiero seguir recibiéndolos
            </button>
          </form>
        </>
      ) : hecho === 'alta' ? (
        <p className="mt-4 text-[14.5px] text-cuerpo">Perfecto, seguirás recibiendo los avisos de cada encuesta.</p>
      ) : hecho === 'error' ? (
        <p className="mt-4 text-[14.5px] text-magenta">No se ha podido guardar. Inténtalo de nuevo en un momento.</p>
      ) : (
        <>
          <p className="mt-4 text-[14.5px] text-cuerpo">
            Cada mes te avisamos de la encuesta abierta y, si aún no has participado, de que se acaba el plazo. ¿Quieres
            dejar de recibir estos correos?
          </p>
          <form action={cambiar} className="mt-6">
            <input type="hidden" name="activar" value="0" />
            <button type="submit" className="rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white">
              Sí, darme de baja de los avisos
            </button>
          </form>
        </>
      )}
    </main>
  );
}
