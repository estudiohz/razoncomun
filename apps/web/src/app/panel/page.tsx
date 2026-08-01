import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUsuario } from '@/lib/auth/niveles';
import { contarReportesAbiertos } from '@/lib/participacion/reports';
import { contarBorradores } from '@/lib/participacion/drafts';

/**
 * Dashboard del panel (D-U3). Los widgets son ADITIVOS por rol: un afiliado ve
 * lo del registrado más lo suyo, un editor lo de todos más su bloque de
 * moderación. Así nadie tiene que aprender una interfaz distinta al subir de
 * nivel — solo le aparecen tarjetas nuevas.
 */

function Tarjeta({
  titulo,
  children,
  acento,
}: {
  titulo: string;
  children: React.ReactNode;
  acento?: boolean;
}) {
  return (
    <section
      className={
        acento
          ? 'rounded-tarjeta border border-teal/40 bg-teal/[.06] p-6'
          : 'rounded-tarjeta border border-linea bg-panel p-6 shadow-nav'
      }
    >
      <h2 className="text-[15px] font-bold text-titular">{titulo}</h2>
      <div className="mt-3 text-[13.5px] text-cuerpo">{children}</div>
    </section>
  );
}

function Dato({ valor, etiqueta, href }: { valor: number; etiqueta: string; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-boton border border-linea bg-white px-4 py-3 no-underline transition-colors hover:border-titular"
    >
      <p className="text-[22px] font-extrabold leading-none text-titular">{valor}</p>
      <p className="mt-1 text-[12.5px] text-gris">{etiqueta}</p>
    </Link>
  );
}

export default async function PanelInicioPage() {
  const { user, perfil, supabase } = await requireUsuario('/panel');
  if (!perfil) redirect('/entrar');

  const [
    { data: esAdmin },
    { data: esEditor },
    { data: tieneContrasena },
    { count: creadas },
    { count: apoyadas },
    { data: miembros },
  ] = await Promise.all([
    supabase.rpc('is_admin', { p_user: user.id }),
    supabase.rpc('is_editor', { p_user: user.id }),
    supabase.rpc('has_password'),
    supabase.from('proposals').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    supabase.from('proposal_supports').select('proposal_id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('members').select('status, billing_period').eq('user_id', user.id),
  ]);

  const puedeModerar = Boolean(esAdmin) || Boolean(esEditor);
  const afiliacionActiva = miembros?.find((m) => m.status === 'active');
  const nombre = perfil.display_name?.trim() || perfil.email?.split('@')[0] || '';

  let reportes = 0;
  let borradores = 0;
  if (puedeModerar) {
    [reportes, borradores] = await Promise.all([
      contarReportesAbiertos(supabase).catch(() => 0),
      contarBorradores(supabase).catch(() => 0),
    ]);
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      <header>
        <h1 className="text-[clamp(24px,3.4vw,32px)] font-extrabold leading-tight">
          Hola{nombre ? `, ${nombre}` : ''}
        </h1>
        <p className="mt-1 text-[14px] text-gris">
          Desde aquí gestionas tu cuenta, tu participación y tu afiliación.
        </p>
      </header>

      {/* Avisos accionables primero: lo que le falta al usuario por hacer. */}
      {tieneContrasena === false && (
        <Tarjeta titulo="Crea una contraseña" acento>
          <p>
            Entras con el enlace mágico que te enviamos por correo. Si te creas una contraseña
            podrás entrar directamente, sin depender del correo.
          </p>
          <Link
            href="/panel/perfil#contrasena"
            className="mt-3 inline-block rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white no-underline shadow-boton"
          >
            Crear contraseña
          </Link>
        </Tarjeta>
      )}

      {perfil.level === 'registered' && (
        <Tarjeta titulo="Aún no eres afiliado" acento>
          <p>
            Afiliándote puedes votar las propuestas de departamento y sostienes el partido: Razón
            Común se financia solo con las cuotas de sus afiliados.
          </p>
          <Link
            href="/panel/afiliacion"
            className="mt-3 inline-block rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white no-underline shadow-boton"
          >
            Ver cómo afiliarme
          </Link>
        </Tarjeta>
      )}

      {perfil.level === 'member' && (
        <Tarjeta titulo="Verifica tu identidad">
          <p>
            Con la identidad verificada podrás votar cambios del manifiesto y ser elegible para
            listas y cargos internos.
          </p>
          <Link
            href="/panel/perfil#verificacion"
            className="mt-3 inline-block rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular no-underline hover:border-titular"
          >
            Verificar mi identidad
          </Link>
        </Tarjeta>
      )}

      {/* Actividad: mismos datos para todos los niveles. */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold text-titular">Tu participación</h2>
        <div className="grid gap-3 min-[520px]:grid-cols-3">
          <Dato valor={creadas ?? 0} etiqueta="Propuestas creadas" href="/panel/propuestas" />
          <Dato valor={apoyadas ?? 0} etiqueta="Propuestas apoyadas" href="/panel/propuestas?tab=apoyadas" />
          <Dato
            valor={afiliacionActiva ? 1 : 0}
            etiqueta={afiliacionActiva ? `Cuota ${afiliacionActiva.billing_period === 'annual' ? 'anual' : 'mensual'}` : 'Sin afiliación activa'}
            href="/panel/afiliacion"
          />
        </div>
      </div>

      {/* Bloque exclusivo de editor/admin. Un usuario normal ni lo recibe en el HTML. */}
      {puedeModerar && (
        <Tarjeta titulo="Administración">
          <p>
            Tienes permisos de {esAdmin ? 'administrador' : 'editor'}. El panel de administración
            está en una zona aparte.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Link
              href="/admin"
              className="rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white no-underline shadow-boton"
            >
              Ir al panel de administración
            </Link>
            {borradores > 0 && (
              <Link
                href="/admin/participacion?tab=borradores"
                className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular no-underline hover:border-titular"
              >
                {borradores} borrador{borradores === 1 ? '' : 'es'} por revisar
              </Link>
            )}
            {reportes > 0 && (
              <Link
                href="/admin/participacion?tab=reportes"
                className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular no-underline hover:border-titular"
              >
                {reportes} reporte{reportes === 1 ? '' : 's'} abierto{reportes === 1 ? '' : 's'}
              </Link>
            )}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
