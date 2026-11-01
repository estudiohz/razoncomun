import type { Metadata } from 'next';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { MencionOrigen } from '@/components/auditoria/MencionOrigen';
import { metadatosPagina } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { NOMBRE_VERIFICACION, auditoriaAbierta, euros, fechaLarga, listarCasosPublicos, totales } from '@/lib/vigia/publico';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Auditoría del gasto público',
  descripcion:
    'Casos reales de gasto público verificados contra la fuente oficial (BDNS, BOE, Plataforma de Contratación): hechos separados de la opinión, prueba enlazada y derecho de réplica.',
  ruta: '/observatorio/auditorias',
  // Hasta el visto bueno legal (T2.5) no se indexa ni se enlaza.
  noindex: !auditoriaAbierta(),
});

export const revalidate = 300;

/**
 * Observatorio › Auditorías (F2, D-A12: Sergio la sitúa dentro del
 * Observatorio). Contador "Gasto público señalado" (M4) y lista de casos
 * publicados. Solo lee lo que la RLS deja ver al público.
 */
export default async function AuditoriasPage() {
  const supabase = await createClient();
  const [casos, total] = await Promise.all([listarCasosPublicos(supabase), totales(supabase)]);

  return (
    <Contenedor as="section" className="py-16">
      <div className="mx-auto w-full max-w-[960px] space-y-10">
        <header className="text-center">
          <Link href="/observatorio" className="text-[13px] font-bold uppercase tracking-[.14em] text-titular no-underline">
            Observatorio
          </Link>
          <h1 className="mt-2 text-[clamp(30px,5vw,44px)] font-extrabold">Auditoría del gasto público</h1>
          <p className="mx-auto mt-3 max-w-[620px] text-[15px] text-cuerpo">
            Casos reales que han circulado en redes o en prensa, comprobados uno a uno contra la fuente oficial. Separamos lo que
            dicen los documentos de lo que opinamos, enlazamos la prueba y damos derecho de réplica.
          </p>
        </header>

        <div className="rounded-tarjeta border border-linea bg-panel p-6 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[.12em] text-gris">Gasto público señalado</p>
          <p className="mt-1 text-[clamp(32px,6vw,52px)] font-extrabold text-titular">{euros(total.importe_cents)}</p>
          <p className="text-[13.5px] text-cuerpo">
            {total.casos} caso{total.casos === 1 ? '' : 's'} verificado{total.casos === 1 ? '' : 's'} contra fuentes oficiales
          </p>
          <p className="mt-2 text-[12px] text-gris">
            Suma solo el importe oficial de los casos publicados que coinciden con la fuente; los rectificados no cuentan.{' '}
            <Link href="/observatorio/auditorias/metodologia">Cómo lo hacemos</Link>
          </p>
        </div>

        {casos.length === 0 ? (
          <p className="rounded-tarjeta border border-linea bg-white p-6 text-center text-[14.5px] text-cuerpo">
            Todavía no hay casos publicados. Cada uno pasa por verificación, réplica y firma antes de salir aquí.
          </p>
        ) : (
          <ul className="space-y-4">
            {casos.map((c) => (
              <li key={c.id} className="rounded-tarjeta border border-linea bg-white p-5">
                <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
                  {c.verificacion && (
                    <span className="rounded-full bg-teal-texto/10 px-2.5 py-1 text-teal-texto">
                      {NOMBRE_VERIFICACION[c.verificacion] ?? c.verificacion}
                    </span>
                  )}
                  {c.rectificado_at && <span className="rounded-full bg-naranja/10 px-2.5 py-1 text-naranja">Rectificado</span>}
                  <span className="text-gris">{fechaLarga(c.published_at)}</span>
                </div>
                <h2 className="mt-2 text-[19px] font-extrabold leading-tight">
                  <Link href={`/observatorio/auditorias/${c.slug}`} className="text-titular no-underline hover:underline">
                    {c.title}
                  </Link>
                </h2>
                <p className="mt-1 text-[14px] text-cuerpo">
                  {[c.organismo, c.adjudicatario, c.importe_oficial_cents != null && euros(c.importe_oficial_cents)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <MencionOrigen url={c.reel_url} autor={c.reel_autor} autorUrl={c.reel_autor_url} className="mt-2" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Contenedor>
  );
}
