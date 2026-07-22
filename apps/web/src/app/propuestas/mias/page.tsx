import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { Chip } from '@/components/ui/Chip';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import { metadatosPagina } from '@/lib/seo';
import { requireUsuario } from '@/lib/auth/niveles';
import { listarPropuestasSeguidas } from '@/lib/participacion/follows';
import type { Propuesta } from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Mis hilos',
  descripcion: 'Las propuestas que has creado y las que sigues en el tablero de Razón Común.',
  ruta: '/propuestas/mias',
  noindex: true,
});

/** D-P14: "Mis hilos" — pestañas Creados / Sigo. Requiere sesión. */
export default async function MisHilosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, supabase } = await requireUsuario('/propuestas/mias');
  const { tab } = await searchParams;
  const pestana = tab === 'sigo' ? 'sigo' : 'creados';

  const [creados, seguidos] = await Promise.all([
    supabase
      .from('proposals')
      .select('*')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: Propuesta[] | null }>,
    listarPropuestasSeguidas(supabase, user.id),
  ]);

  const lista = pestana === 'creados' ? creados.data ?? [] : seguidos;

  return (
    <Contenedor as="section" className="py-14">
      <header className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Programa vivo</span>
        <h1 className="mt-3 text-[clamp(28px,4vw,38px)] font-extrabold leading-[1.12]">Mis hilos</h1>
      </header>

      <div className="mt-8 flex justify-center gap-2.5">
        <Chip href="/propuestas/mias?tab=creados" activo={pestana === 'creados'}>
          Creados
        </Chip>
        <Chip href="/propuestas/mias?tab=sigo" activo={pestana === 'sigo'}>
          Sigo
        </Chip>
      </div>

      <div className="mx-auto mt-10 grid max-w-[820px] gap-5">
        {lista.length === 0 && (
          <p className="text-center text-[15px] text-gris">
            {pestana === 'creados' ? 'Todavía no has creado ninguna propuesta.' : 'Todavía no sigues ninguna propuesta.'}
          </p>
        )}
        {lista.map((p) => (
          <Link
            key={p.id}
            href={`/propuestas/${p.slug ?? p.id}`}
            className="block rounded-tarjeta border border-linea bg-panel p-6 no-underline transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-tarjeta"
          >
            <EstadoBadge status={p.status} />
            <h2 className="mt-3 text-[19px] font-extrabold text-titular">{p.title}</h2>
            <p className="mt-1.5 line-clamp-2 text-[14.5px] text-cuerpo">{p.body}</p>
            <p className="mt-3 text-[13px] text-gris">👍 {p.support_count} apoyos</p>
          </Link>
        ))}
      </div>
    </Contenedor>
  );
}
