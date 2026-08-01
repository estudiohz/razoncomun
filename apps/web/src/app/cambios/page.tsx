import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { calcularResultado } from '@/lib/participacion/votes';
import type { Ballot, Propuesta, Vote } from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Qué cambió gracias a ti',
  descripcion:
    'El ciclo completo de cada propuesta ciudadana: de la idea a la decisión, con fechas, votos e informes. Participar aquí tiene consecuencias visibles.',
  ruta: '/cambios',
});

export const revalidate = 300;

/**
 * El bucle de retorno hecho página (democracia-semidirecta.md: "lo que mata o
 * salva el sistema" — lección de ION: escucha sin consecuencia visible =
 * participación muerta). Cada propuesta que llegó a una decisión se cuenta
 * entera: cuándo nació, cuántos la apoyaron, qué se votó y qué se decidió —
 * incluidos los RECHAZOS con su informe, porque "esto no se puede pagar, aquí
 * están los números" da más credibilidad que aprobarlo todo.
 *
 * Todo sale de datos que ya existen (proposals, votes, ballots): esta página
 * no tiene tablas propias — es el ensamblaje público del rastro real.
 */
export default async function CambiosPage() {
  const supabase = await createClient();

  const [{ data: decididas }, { data: votaciones }] = await Promise.all([
    supabase
      .from('proposals')
      .select(
        'id, title, slug, status, support_count, department, created_at, official_response, official_response_at',
      )
      .in('status', ['adopted', 'discarded', 'planned'])
      .order('official_response_at', { ascending: false, nullsFirst: false })
      .limit(60),
    supabase
      .from('votes')
      .select('*')
      .lt('closes_at', new Date().toISOString())
      .order('closes_at', { ascending: false })
      .limit(60),
  ]);

  const cerradas = (votaciones ?? []) as Vote[];

  // Los recuentos de las votaciones cerradas, para mostrar el dato junto a la
  // decisión. Una consulta por votación es aceptable con este volumen.
  const recuentos = new Map<string, { favor: number; contra: number; total: number }>();
  await Promise.all(
    cerradas.map(async (v) => {
      const { data } = await supabase.from('ballots').select('*').eq('vote_id', v.id);
      const r = calcularResultado(v, (data ?? []) as Ballot[]);
      recuentos.set(v.proposal_id, {
        favor: r.recuentoVinculante.favor,
        contra: r.recuentoVinculante.contra,
        total: r.vinculantes,
      });
    }),
  );

  const lista = (decididas ?? []) as Pick<
    Propuesta,
    | 'id'
    | 'title'
    | 'slug'
    | 'status'
    | 'support_count'
    | 'department'
    | 'created_at'
    | 'official_response'
    | 'official_response_at'
  >[];

  const fecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  return (
    <Contenedor as="section" className="py-14">
      <header className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
          El bucle de retorno
        </span>
        <h1 className="mt-3 text-[clamp(28px,4.4vw,40px)] font-extrabold leading-[1.12]">
          Qué cambió gracias a ti
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] text-cuerpo">
          Aquí está el destino de cada propuesta que llegó a una decisión: aprobada, planificada o
          rechazada — y si fue rechazada, el informe que lo justifica. Participar tiene
          consecuencias, y se pueden ver.
        </p>
      </header>

      <div className="mx-auto mt-12 grid max-w-[820px] gap-6">
        {lista.length === 0 && (
          <p className="rounded-tarjeta border border-linea bg-panel p-8 text-center text-[14.5px] text-gris">
            Todavía no hay decisiones cerradas. Las propuestas en marcha están en{' '}
            <Link href="/propuestas" className="font-semibold text-titular underline">
              el tablero
            </Link>
            .
          </p>
        )}

        {lista.map((p) => {
          const recuento = recuentos.get(p.id);
          return (
            <article key={p.id} className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <EstadoBadge status={p.status} />
                {p.official_response_at && (
                  <span className="text-[12.5px] text-gris">Decidido el {fecha(p.official_response_at)}</span>
                )}
              </div>

              <h2 className="mt-3 text-[19px] font-extrabold text-titular">
                <Link href={`/propuestas/${p.slug ?? p.id}`} className="no-underline hover:underline">
                  {p.title}
                </Link>
              </h2>

              {/* El recorrido, en una línea de hechos con fechas — el "ciclo
                  completo" que exige el ideario, no solo el final. */}
              <p className="mt-2 text-[13.5px] text-cuerpo">
                Propuesta el {fecha(p.created_at)} · {p.support_count} apoyo
                {p.support_count === 1 ? '' : 's'}
                {recuento &&
                  ` · votada: ${recuento.favor} a favor, ${recuento.contra} en contra (${recuento.total} votos vinculantes)`}
              </p>

              {p.official_response && (
                <div className="mt-4 rounded-boton border-l-4 border-titular bg-fondo px-4 py-3">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-gris">
                    {p.status === 'discarded' ? 'Informe de la decisión' : 'Respuesta oficial'}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-[13.5px] text-cuerpo">
                    {p.official_response}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p className="mx-auto mt-12 max-w-[560px] text-center text-[13px] text-gris">
        ¿Falta la tuya? Las propuestas siguen su ciclo en{' '}
        <Link href="/propuestas" className="font-semibold text-titular underline">
          el tablero
        </Link>{' '}
        y las votaciones cerradas publican su{' '}
        <Link href="/votaciones" className="font-semibold text-titular underline">
          acta verificable
        </Link>
        .
      </p>
    </Contenedor>
  );
}
