import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { Boton } from '@/components/ui/Boton';
import { CaminoIdea, type PasoCamino } from '@/components/programa/CaminoIdea';
import { Contador } from '@/components/programa/Contador';
import { ExplorarIdeas, type IdeaResumen } from '@/components/programa/ExplorarIdeas';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { listarCategorias } from '@/lib/participacion/categories';
import type { EstadoPropuesta } from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'El programa lo eliges tú',
  descripcion:
    'En Razón Común el programa lo crean los socios: se proponen ideas, se debaten, se contrastan con datos y se aprueban por votación. Transparente y democrático. Añade la tuya.',
  ruta: '/programa',
});

export default async function ProgramaPage() {
  const supabase = await createClient();

  const [{ data: filas }, { data: puntos }, categorias] = await Promise.all([
    supabase
      .from('proposals')
      .select('id, slug, title, status, category_id, support_count')
      .order('support_count', { ascending: false }),
    supabase.from('manifesto_points').select('id, title').order('id', { ascending: true }),
    listarCategorias(supabase),
  ]);

  const propuestas = ((filas ?? []) as IdeaResumen[]).filter((p) => p.status !== 'draft');
  const cuenta = (...estados: EstadoPropuesta[]) =>
    propuestas.filter((p) => estados.includes(p.status)).length;
  const vivas = propuestas.filter((p) => p.status !== 'discarded' && p.status !== 'archived');
  const manifiesto = puntos ?? [];

  const pasos: PasoCamino[] = [
    {
      clave: 'seed',
      icono: '💡',
      titulo: 'Propuesta',
      resumen: 'Cualquier socio puede proponer',
      detalle:
        'Una idea, un problema real, una mejora. Se escribe en dos minutos y queda publicada con tu nombre (o sin él) y toda su trazabilidad.',
      ahora: cuenta('seed'),
    },
    {
      clave: 'deliberation',
      icono: '🔎',
      titulo: 'Debate',
      resumen: 'Se debate en abierto',
      detalle:
        'Comentarios, apoyos y objeciones. Nadie decide por ti ni a puerta cerrada: la discusión es pública y se puede seguir hilo a hilo.',
      ahora: cuenta('deliberation'),
    },
    {
      clave: 'stress_test',
      icono: '🧪',
      titulo: 'Contraste',
      resumen: 'Se contrasta con datos',
      detalle:
        'Coste estimado, experiencias de otros países y simulación de impacto. La IA aporta imparcialidad y soluciones ya probadas; no gobierna.',
      ahora: cuenta('stress_test'),
    },
    {
      clave: 'voting',
      icono: '🗳️',
      titulo: 'Votación',
      resumen: 'Los socios votan',
      detalle:
        'Censo congelado al abrir la votación, un socio un voto, resultado verificable. Lo que gana, gana a la vista de todos.',
      ahora: cuenta('voting'),
    },
    {
      clave: 'adopted',
      icono: '✅',
      titulo: 'Programa',
      resumen: 'Pasa a formar parte del programa',
      detalle:
        'La propuesta aprobada se incorpora al programa con su historial completo: quién la propuso, qué se dijo, qué datos la respaldaron y cuántos la votaron.',
      ahora: cuenta('planned', 'adopted'),
    },
  ];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden pb-14 pt-16 min-[720px]:pt-24">
        <div
          className="pointer-events-none absolute -right-[160px] -top-[200px] h-[560px] w-[560px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(139,48,217,.12),transparent 65%)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-[220px] -left-[160px] h-[520px] w-[520px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(43,199,232,.14),transparent 65%)' }}
          aria-hidden
        />
        <Contenedor className="relative text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Programa vivo</span>
          <h1 className="mx-auto mt-3 max-w-[18ch] text-[clamp(36px,6vw,68px)] font-extrabold leading-[1.05]">
            El programa lo eliges <span className="bg-grad bg-clip-text text-transparent">tú</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[62ch] text-[clamp(16px,1.6vw,19px)] text-cuerpo">
            Podríamos darte un programa igual que el del resto de formaciones políticas: lo que quieres
            oír. Pero en Razón Común <strong className="text-titular">el programa lo crean nuestros socios</strong>.
            Se proponen ideas, se debaten, se contrastan con datos y se aprueban. Entonces pasan a formar
            parte del programa. De manera transparente y democrática.
          </p>
          <p className="mt-5 text-[18px] font-extrabold text-titular">¿Quieres añadir tus ideas? ¿A qué estás esperando?</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Boton href="/propuestas/nueva" variante="marca">
              Proponer mi idea
            </Boton>
            <Boton href="/propuestas" variante="suave">
              Ver propuestas
            </Boton>
          </div>

          <dl className="mx-auto mt-14 grid max-w-[760px] grid-cols-3 gap-3">
            {[
              { v: propuestas.length, t: 'propuestas de socios' },
              { v: cuenta('deliberation', 'stress_test', 'voting'), t: 'en debate o votación' },
              { v: manifiesto.length, t: 'puntos de partida' },
            ].map((c) => (
              <div key={c.t} className="rounded-tarjeta border border-linea bg-panel px-3 py-5 shadow-tarjeta">
                <dt className="sr-only">{c.t}</dt>
                <dd>
                  <Contador valor={c.v} className="block text-[clamp(28px,4vw,44px)] font-extrabold leading-none text-titular" />
                  <span className="mt-2 block text-[12.5px] font-semibold text-cuerpo min-[720px]:text-[14px]">{c.t}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Contenedor>
      </section>

      {/* CAMINO DE UNA IDEA */}
      <section className="py-14">
        <Contenedor>
          <div className="mx-auto mb-10 max-w-[640px] text-center">
            <h2 className="text-[clamp(26px,3.4vw,40px)] font-extrabold leading-[1.15]">Así llega una idea al programa</h2>
            <p className="mt-3 text-cuerpo">Cinco pasos, todos a la vista. Toca cada uno para ver qué pasa.</p>
          </div>
          <CaminoIdea pasos={pasos} />
        </Contenedor>
      </section>

      {/* EXPLORAR */}
      <section className="py-14">
        <Contenedor>
          <div className="mx-auto mb-8 max-w-[640px] text-center">
            <h2 className="text-[clamp(26px,3.4vw,40px)] font-extrabold leading-[1.15]">¿Qué te importa a ti?</h2>
            <p className="mt-3 text-cuerpo">
              Esto es lo que se está proponiendo ahora mismo. Elige un tema, apoya lo que te convenza o
              propón lo que falte.
            </p>
          </div>
          {vivas.length > 0 ? (
            <ExplorarIdeas
              ideas={vivas}
              categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre, color: c.color }))}
            />
          ) : (
            <p className="text-center text-gris">Las primeras propuestas están por llegar. Sé de los primeros.</p>
          )}
          <div className="mt-8 text-center">
            <Link href="/propuestas" className="font-bold text-titular underline-offset-4 hover:underline">
              Ver todas las propuestas →
            </Link>
          </div>
        </Contenedor>
      </section>

      {/* PUNTO DE PARTIDA */}
      {manifiesto.length > 0 && (
        <section className="py-14">
          <Contenedor>
            <div className="mx-auto mb-8 max-w-[680px] text-center">
              <h2 className="text-[clamp(26px,3.4vw,40px)] font-extrabold leading-[1.15]">
                No empezamos de cero
              </h2>
              <p className="mt-3 text-cuerpo">
                Estos {manifiesto.length} puntos de gestión real son el punto de partida. No son un dogma: los
                socios pueden mejorarlos, y cada cambio queda publicado con su historial.
              </p>
            </div>
            <ol className="mx-auto grid max-w-[1000px] gap-3 min-[720px]:grid-cols-2">
              {manifiesto.map((p) => (
                <li key={p.id}>
                  <Link
                    href="/manifiesto"
                    className="flex items-center gap-4 rounded-tarjeta border border-linea bg-panel px-5 py-4 no-underline transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-tarjeta"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-grad text-[14px] font-extrabold text-white">
                      {p.id}
                    </span>
                    <span className="text-[15px] font-bold text-titular">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <div className="mt-8 text-center">
              <Link href="/manifiesto" className="font-bold text-titular underline-offset-4 hover:underline">
                Leer el manifiesto completo →
              </Link>
            </div>
          </Contenedor>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="pb-[100px] pt-6">
        <Contenedor>
          <div className="relative overflow-hidden rounded-[28px] border border-linea bg-white px-6 py-16 text-center shadow-caja min-[720px]:px-10 min-[720px]:py-20">
            <div
              className="pointer-events-none absolute -bottom-[300px] -right-[200px] h-[600px] w-[600px] rounded-full"
              style={{ background: 'radial-gradient(circle,rgba(139,48,217,.10),transparent 65%)' }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -left-[180px] -top-[250px] h-[500px] w-[500px] rounded-full"
              style={{ background: 'radial-gradient(circle,rgba(43,199,232,.12),transparent 65%)' }}
              aria-hidden
            />
            <h2 className="relative mx-auto max-w-[24ch] text-[clamp(28px,3.4vw,44px)] font-extrabold leading-[1.18]">
              Un programa que no hace nadie por ti
            </h2>
            <p className="relative mx-auto mb-[34px] mt-[18px] max-w-[52ch] text-cuerpo">
              Únete gratis, propón, debate y vota. Lo que decidamos juntos será el programa.
            </p>
            <div className="relative flex flex-wrap justify-center gap-3">
              <Boton href="/unete" variante="marca">
                Únete
              </Boton>
              <Boton href="/propuestas/nueva" variante="suave">
                Proponer una idea
              </Boton>
            </div>
          </div>
        </Contenedor>
      </section>
    </>
  );
}
