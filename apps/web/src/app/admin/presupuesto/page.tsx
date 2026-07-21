import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { listarParametros, listarPartidas, subarbol } from '@/lib/simulador/adminData';
import { resolver } from '@/lib/simulador/resolver';
import { formatoEuros } from '@/lib/simulador/formato';
import { TableroClient, type Ficha } from './TableroClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Presupuesto del País',
  descripcion: 'Gestión de partidas y parámetros del Simulador del Presupuesto del País.',
  ruta: '/admin/presupuesto',
  noindex: true,
});

/**
 * Tablero de fichas (docs/tecnico/simulador-pais.md §5): una ficha por área
 * raíz, con el estado que hace falta rellenar. El motor (`resolver`) corre
 * en el servidor sobre TODO el modelo (publicado o no — el admin ve todo),
 * y de ahí sale tanto el balance global como el estado de cada ficha.
 */
export default async function AdminPresupuestoPage() {
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto');
  const [parametros, partidas] = await Promise.all([listarParametros(supabase), listarPartidas(supabase)]);
  const modelo = resolver(parametros, partidas);

  const infoPorId = new Map(modelo.partidas.map((p) => [p.id, p]));
  const raices = partidas.filter((p) => p.parent_id === null);

  const fichas: Ficha[] = raices.map((raiz) => {
    const info = infoPorId.get(raiz.id)!;
    const nPartidas = subarbol(partidas, raiz.id).length;
    const sinFuente = !raiz.fuente_actual?.trim() || raiz.fuente_actual.toUpperCase().includes('PENDIENTE DE FUENTE');
    const descuadre = info.actual.descuadre || info.rc.descuadre;
    const roto = Boolean(info.actual.error || info.rc.error);

    return {
      id: raiz.id,
      tipo: raiz.tipo,
      nombre: raiz.nombre,
      actualCents: info.actual.propioCents,
      rcCents: info.rc.propioCents,
      nPartidas,
      publicado: raiz.publicado,
      sinFuente,
      descuadre,
      roto,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold text-titular">Presupuesto del País</h1>
          <p className="mt-1 max-w-[60ch] text-[13.5px] text-cuerpo">
            Base de datos del país: parámetros reales y partidas de ingreso/gasto, comparando el
            presupuesto oficial con el de Razón Común. Nada sale a <code>/pais</code> hasta que se
            publica área a área, con la fuente rellenada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/presupuesto/parametros"
            className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular hover:border-titular"
          >
            Parámetros →
          </Link>
          <Link
            href="/admin/presupuesto/poblacion"
            className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular hover:border-titular"
          >
            Población →
          </Link>
          <Link
            href="/admin/presupuesto/nueva"
            className="rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white shadow-boton hover:-translate-y-0.5"
          >
            + Nueva área
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Balance actual (oficial)</p>
          <p
            className={`mt-1 text-[26px] font-extrabold ${modelo.balance.actualCents >= 0 ? 'text-titular' : 'text-magenta'}`}
          >
            {formatoEuros(modelo.balance.actualCents)}
          </p>
        </div>
        <div className="rounded-tarjeta border border-linea bg-white p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Balance Razón Común</p>
          <p className={`mt-1 text-[26px] font-extrabold ${modelo.balance.rcCents >= 0 ? 'text-teal-texto' : 'text-magenta'}`}>
            {formatoEuros(modelo.balance.rcCents)}
          </p>
        </div>
      </div>

      {modelo.sinResolver.length > 0 && (
        <div className="rounded-boton border border-naranja/40 bg-naranja/5 p-4">
          <p className="text-[13.5px] font-bold text-naranja">
            ⚠ {modelo.sinResolver.length} elemento{modelo.sinResolver.length === 1 ? '' : 's'} sin resolver — no
            cuentan en el balance:
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-cuerpo">
            {modelo.sinResolver.slice(0, 8).map((e, i) => (
              <li key={i}>
                <strong>{e.nombre}</strong> ({e.lado === 'actual' ? 'lado actual' : 'lado RC'}): {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <TableroClient fichas={fichas} />
    </div>
  );
}
