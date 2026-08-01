import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/cn';
import type { Propuesta } from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'La encuesta del mes',
  descripcion:
    'Las propuestas destacadas de este mes en Razón Común: léelas, apóyalas y vota. Al final del año, aquí queda el registro de todo lo votado, mes a mes.',
  ruta: '/mes',
});

export const revalidate = 300;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function claveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * "La encuesta del mes" — el centro de la app (petición de Sergio, 01/08/2026)
 * y el ritual mensual del ideario (ventanas fijas de votación) hecho página.
 *
 * `?m=YYYY-MM` navega el histórico: al acabar el año, esta misma página es el
 * registro de qué se votó cada mes. No hay tablas propias: lee
 * `proposals.featured_month` (0040), que fija el equipo desde moderación.
 */
export default async function MesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const supabase = await createClient();

  const ahora = new Date();
  const mesActual = claveMes(ahora);
  const mes = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : mesActual;
  const [anyo, numMes] = mes.split('-').map(Number);

  const [{ data: fijadas }, { data: delAnyo }] = await Promise.all([
    supabase
      .from('proposals')
      .select('id, title, body, slug, status, support_count, department, featured_month, official_response')
      .eq('featured_month', `${mes}-01`)
      .order('support_count', { ascending: false }),
    supabase
      .from('proposals')
      .select('id, featured_month')
      .gte('featured_month', `${anyo}-01-01`)
      .lte('featured_month', `${anyo}-12-01`),
  ]);

  const lista = (fijadas ?? []) as Pick<
    Propuesta,
    'id' | 'title' | 'body' | 'slug' | 'status' | 'support_count' | 'department' | 'featured_month' | 'official_response'
  >[];

  // Meses del año con contenido, para la cinta de navegación.
  const porMes = new Map<string, number>();
  for (const p of delAnyo ?? []) {
    if (!p.featured_month) continue;
    const k = p.featured_month.slice(0, 7);
    porMes.set(k, (porMes.get(k) ?? 0) + 1);
  }

  const esActual = mes === mesActual;

  return (
    <Contenedor as="section" className="py-14">
      <header className="mx-auto max-w-[720px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">
          {esActual ? 'Participa ahora' : 'Histórico'}
        </span>
        <h1 className="mt-3 text-[clamp(28px,4.4vw,40px)] font-extrabold leading-[1.12]">
          La encuesta de {MESES[numMes - 1]} {anyo}
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] text-cuerpo">
          {esActual
            ? 'Estas son las propuestas destacadas de este mes. Léelas, apóyalas y vota: en dos minutos has participado.'
            : 'Lo que se destacó y votó este mes. El registro completo del año, mes a mes, queda aquí para siempre.'}
        </p>
      </header>

      {/* Cinta de meses del año: el "listado anual" que pidió Sergio. */}
      <nav aria-label="Meses del año" className="mx-auto mt-8 flex max-w-[820px] flex-wrap justify-center gap-2">
        {MESES.map((nombre, i) => {
          const k = `${anyo}-${String(i + 1).padStart(2, '0')}`;
          const n = porMes.get(k) ?? 0;
          const activo = k === mes;
          const futuro = k > mesActual;
          if (futuro && n === 0) return null;
          return (
            <Link
              key={k}
              href={`/mes?m=${k}`}
              aria-current={activo ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[12.5px] font-bold no-underline transition-colors',
                activo
                  ? 'bg-accion text-white'
                  : n > 0
                    ? 'bg-white text-titular ring-1 ring-linea hover:ring-titular'
                    : 'bg-fondo text-gris',
              )}
            >
              {nombre.slice(0, 3)}
              {n > 0 && <span className="ml-1.5 opacity-70">{n}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mx-auto mt-10 grid max-w-[820px] gap-5">
        {lista.length === 0 && (
          <p className="rounded-tarjeta border border-linea bg-panel p-8 text-center text-[14.5px] text-gris">
            {esActual
              ? 'La encuesta de este mes todavía no está publicada. Mientras tanto, el tablero de propuestas está siempre abierto.'
              : 'Este mes no tuvo propuestas destacadas.'}
          </p>
        )}

        {lista.map((p, i) => (
          <article
            key={p.id}
            className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-tarjeta"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grad text-[15px] font-extrabold text-white"
              >
                {i + 1}
              </span>
              <EstadoBadge status={p.status} />
            </div>
            <h2 className="mt-3 text-[19px] font-extrabold text-titular">
              <Link href={`/propuestas/${p.slug ?? p.id}`} className="no-underline hover:underline">
                {p.title}
              </Link>
            </h2>
            <p className="mt-1.5 line-clamp-3 text-[14.5px] text-cuerpo">{p.body}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-gris">👍 {p.support_count} apoyos</span>
              <Link
                href={`/propuestas/${p.slug ?? p.id}`}
                className="rounded-boton bg-accion px-4 py-2 text-[13px] font-bold text-white no-underline shadow-boton"
              >
                {esActual ? 'Leer y votar' : 'Ver cómo quedó'}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mx-auto mt-12 max-w-[560px] text-center text-[13px] text-gris">
        Las decisiones cerradas, con sus informes y actas, están en{' '}
        <Link href="/cambios" className="font-semibold text-titular underline">
          Qué cambió gracias a ti
        </Link>
        .
      </p>
    </Contenedor>
  );
}
