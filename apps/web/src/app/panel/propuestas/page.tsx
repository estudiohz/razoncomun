import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import { MisVotos } from '@/components/participacion/MisVotos';
import { listarPropuestasSeguidas } from '@/lib/participacion/follows';
import { cn } from '@/lib/cn';
import type { Propuesta } from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Mis propuestas',
  descripcion: 'Las propuestas que has creado, apoyado y sigues en Razón Común.',
  ruta: '/panel/propuestas',
  noindex: true,
});

type Pestana = 'creadas' | 'apoyadas' | 'sigo' | 'votos';

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'creadas', label: 'Creadas' },
  { id: 'apoyadas', label: 'Apoyadas' },
  { id: 'sigo', label: 'Sigo' },
  { id: 'votos', label: 'Mis votos' },
];

/**
 * Participación del usuario en un solo sitio (U2). Unifica lo que antes estaba
 * repartido entre `/propuestas/mias` (creadas + seguidas, que ahora redirige
 * aquí) y la sección "Mis votos" que colgaba de `/perfil`.
 *
 * Nota sobre borradores: si el usuario tiene propuestas en `draft` (hoy solo
 * las genera el RC-bot, D-U5) las ve en "Creadas" con su chip de estado —
 * la policy de 0034 deja que el autor vea las suyas.
 */
export default async function PanelPropuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, perfil, supabase } = await requireUsuario('/panel/propuestas');
  if (!perfil) redirect('/entrar');

  const { tab } = await searchParams;
  const pestana: Pestana = PESTANAS.some((p) => p.id === tab) ? (tab as Pestana) : 'creadas';

  let lista: Propuesta[] = [];

  if (pestana === 'creadas') {
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });
    lista = (data ?? []) as Propuesta[];
  } else if (pestana === 'apoyadas') {
    const { data } = await supabase
      .from('proposal_supports')
      .select('proposal:proposals(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    lista = ((data ?? []) as unknown as { proposal: Propuesta | null }[])
      .map((f) => f.proposal)
      .filter((p): p is Propuesta => Boolean(p));
  } else if (pestana === 'sigo') {
    lista = await listarPropuestasSeguidas(supabase, user.id);
  }

  const vacio: Record<Exclude<Pestana, 'votos'>, string> = {
    creadas: 'Todavía no has creado ninguna propuesta.',
    apoyadas: 'Todavía no has apoyado ninguna propuesta.',
    sigo: 'Todavía no sigues ninguna propuesta.',
  };

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(24px,3.4vw,32px)] font-extrabold leading-tight">
            Mis propuestas
          </h1>
          <p className="mt-1 text-[14px] text-gris">
            Tu actividad en el tablero: lo que has creado, apoyado y sigues.
          </p>
        </div>
        <Link
          href="/propuestas/nueva"
          className="rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white no-underline shadow-boton"
        >
          Nueva propuesta
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <Link
            key={p.id}
            href={`/panel/propuestas?tab=${p.id}`}
            aria-current={pestana === p.id ? 'page' : undefined}
            className={cn(
              'rounded-boton px-4 py-2 text-[13px] font-semibold no-underline transition-colors',
              pestana === p.id
                ? 'bg-accion text-white'
                : 'border border-linea bg-white text-cuerpo hover:border-titular hover:text-titular',
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {pestana === 'votos' ? (
        <section className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
          <h2 className="text-[15px] font-bold text-titular">Mis votos</h2>
          <p className="mt-1 text-[13px] text-gris">
            Verifica que lo que emitiste quedó registrado tal cual. El voto es público con tu
            nombre (D-001): esta misma información es visible para cualquiera en la página de la
            votación.
          </p>
          <div className="mt-4">
            <MisVotos supabase={supabase} userId={user.id} />
          </div>
        </section>
      ) : (
        <div className="grid gap-4">
          {lista.length === 0 && (
            <p className="rounded-tarjeta border border-linea bg-panel p-6 text-center text-[14px] text-gris">
              {vacio[pestana]}
            </p>
          )}
          {lista.map((p) => (
            <Link
              key={p.id}
              href={`/propuestas/${p.slug ?? p.id}`}
              className="block rounded-tarjeta border border-linea bg-panel p-5 no-underline transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-tarjeta"
            >
              <EstadoBadge status={p.status} />
              <h2 className="mt-2.5 text-[17px] font-extrabold text-titular">{p.title}</h2>
              <p className="mt-1.5 line-clamp-2 text-[14px] text-cuerpo">{p.body}</p>
              <p className="mt-2.5 text-[12.5px] text-gris">👍 {p.support_count} apoyos</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
