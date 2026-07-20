import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { Boton } from '@/components/ui/Boton';
import { Chip } from '@/components/ui/Chip';
import { EstadoBadge } from '@/components/participacion/EstadoBadge';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { listarDepartamentosConPropuestas, listarPropuestas } from '@/lib/participacion/proposals';
import { ORDEN_ESTADOS, ETIQUETA_ESTADO, type EstadoPropuesta } from '@/lib/participacion/types';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Propuestas',
  descripcion:
    'El tablero de propuestas de Razón Común: de la idea a la votación, con trazabilidad total. Apoya, delibera y sigue cada propuesta hasta el programa vigente.',
  ruta: '/propuestas',
  noindex: true,
});

function euros(cents: number | null): string {
  if (cents === null) return 'Sin estimar';
  const signo = cents < 0 ? 'Ahorro de ' : 'Coste de ';
  return signo + Math.abs(cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export default async function PropuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; department?: string }>;
}) {
  const { status, department } = await searchParams;
  const supabase = await createClient();

  const [propuestas, departamentos] = await Promise.all([
    listarPropuestas(supabase, {
      status: status as EstadoPropuesta | undefined,
      department,
    }),
    listarDepartamentosConPropuestas(supabase),
  ]);

  function hrefFiltro(next: { status?: string; department?: string }) {
    const params = new URLSearchParams();
    const s = next.status !== undefined ? next.status : status;
    const d = next.department !== undefined ? next.department : department;
    if (s) params.set('status', s);
    if (d) params.set('department', d);
    const qs = params.toString();
    return qs ? `/propuestas?${qs}` : '/propuestas';
  }

  return (
    <Contenedor as="section" className="py-14">
      <header className="mx-auto max-w-[820px] text-center">
        <span className="text-[13px] font-bold uppercase tracking-[.14em] text-titular">Programa vivo</span>
        <h1 className="mt-3 text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.12]">
          Propuestas ciudadanas
        </h1>
        <p className="mx-auto mt-3 max-w-[62ch] text-[16px] text-cuerpo">
          De la idea a la votación, con trazabilidad total: apoya, delibera y sigue cada propuesta hasta que
          entra en el programa. La evidencia decide qué es viable; la votación, qué se prioriza.
        </p>
        <div className="mt-6">
          <Boton href="/propuestas/nueva" variante="grad">
            Proponer algo nuevo
          </Boton>
        </div>
      </header>

      <div className="mt-10 flex flex-wrap justify-center gap-2.5">
        <Chip href={hrefFiltro({ status: undefined })} activo={!status}>
          Todos los estados
        </Chip>
        {ORDEN_ESTADOS.map((s) => (
          <Chip key={s} href={hrefFiltro({ status: s })} activo={status === s}>
            {ETIQUETA_ESTADO[s]}
          </Chip>
        ))}
      </div>

      {departamentos.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2.5">
          <Chip href={hrefFiltro({ department: undefined })} activo={!department}>
            Todos los departamentos
          </Chip>
          {departamentos.map((d) => (
            <Chip key={d} href={hrefFiltro({ department: d })} activo={department === d}>
              {d.replace(/-/g, ' ')}
            </Chip>
          ))}
        </div>
      )}

      <div className="mx-auto mt-10 grid max-w-[920px] gap-5">
        {propuestas.length === 0 && (
          <p className="text-center text-[15px] text-gris">No hay propuestas con estos filtros todavía.</p>
        )}
        {propuestas.map((p) => (
          <Link
            key={p.id}
            href={`/propuestas/${p.id}`}
            className="block rounded-tarjeta border border-linea bg-panel p-6 no-underline transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-tarjeta"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <EstadoBadge status={p.status} />
              <span className="rounded-lg bg-fondo px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[.05em] text-cuerpo">
                {p.department.replace(/-/g, ' ')}
              </span>
            </div>
            <h2 className="mt-3 text-[19px] font-extrabold text-titular">{p.title}</h2>
            <p className="mt-1.5 line-clamp-2 text-[14.5px] text-cuerpo">{p.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-gris">
              <span>👍 {p.support_count} apoyos</span>
              <span>{euros(p.estimated_cost_cents)}</span>
              {p.report_url && <span>🧪 Informe de test de estrés disponible</span>}
            </div>
          </Link>
        ))}
      </div>
    </Contenedor>
  );
}
