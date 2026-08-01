import type { Metadata } from 'next';
import Link from 'next/link';
import { metadatosPagina } from '@/lib/seo';
import { requireTesoreria } from '@/lib/tesoreria/guard';
import {
  listarMovimientos,
  categoriasUsadas,
  resumen,
  POR_PAGINA,
} from '@/lib/tesoreria/movimientos';
import { LibroClient } from './LibroClient';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Tesorería',
  descripcion: 'Libro de movimientos, importación bancaria y cuentas públicas.',
  ruta: '/admin/tesoreria',
  noindex: true,
});

export const dynamic = 'force-dynamic';

function euros(cents: number): string {
  return (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function Cifra({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: 'in' | 'out' }) {
  return (
    <div className="rounded-tarjeta border border-linea bg-panel p-5 shadow-nav">
      <p className="text-[12px] font-bold uppercase tracking-wide text-gris">{etiqueta}</p>
      <p
        className={`mt-1.5 text-[26px] font-extrabold leading-none ${tono === 'out' ? 'text-magenta' : 'text-titular'}`}
      >
        {valor}
      </p>
    </div>
  );
}

/** Barras de los últimos 12 meses. SVG puro: sin librería de gráficos (0-30€/mes). */
function Grafico({ serie }: { serie: { mes: string; ingresos: number; gastos: number }[] }) {
  const max = Math.max(1, ...serie.map((s) => Math.max(s.ingresos, s.gastos)));
  const ancho = 100 / serie.length;

  return (
    <div className="rounded-tarjeta border border-linea bg-panel p-5 shadow-nav">
      <h2 className="text-[15px] font-bold text-titular">Últimos 12 meses</h2>
      <p className="mt-1 text-[12.5px] text-gris">
        Ingresos en teal, gastos en magenta. Escala relativa al mes más alto.
      </p>
      <svg viewBox="0 0 100 34" className="mt-4 w-full" role="img" aria-label="Ingresos y gastos por mes">
        {serie.map((s, i) => {
          const x = i * ancho;
          const hIn = (s.ingresos / max) * 30;
          const hOut = (s.gastos / max) * 30;
          return (
            <g key={s.mes}>
              <rect x={x + ancho * 0.12} y={30 - hIn} width={ancho * 0.34} height={hIn} fill="#16B8A0" rx="0.4" />
              <rect x={x + ancho * 0.52} y={30 - hOut} width={ancho * 0.34} height={hOut} fill="#C3369E" rx="0.4" />
              <text x={x + ancho / 2} y="33.4" textAnchor="middle" fontSize="2.2" fill="#777777">
                {s.mes.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default async function TesoreriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    direccion?: string;
    categoria?: string;
    publicado?: string;
    orden?: string;
    pagina?: string;
  }>;
}) {
  const { supabase } = await requireTesoreria();
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina ?? '1') || 1);

  const [{ filas, total }, categorias, r] = await Promise.all([
    listarMovimientos(supabase, {
      q: sp.q,
      direccion: sp.direccion === 'in' || sp.direccion === 'out' ? sp.direccion : undefined,
      categoria: sp.categoria,
      publicado: sp.publicado === 'si' || sp.publicado === 'no' ? sp.publicado : undefined,
      orden: (sp.orden as never) ?? 'fecha_desc',
      pagina,
    }),
    categoriasUsadas(supabase),
    resumen(supabase),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'pagina') u.set(k, String(v));
    u.set('pagina', String(p));
    return `/admin/tesoreria?${u.toString()}`;
  };

  // Media de ingresos de los meses que YA tienen datos: es una media, no una
  // predicción. Con pocos meses de histórico, proyectar sería inventar.
  const mesesConDatos = r.serie.filter((s) => s.ingresos > 0);
  const mediaIngresos = mesesConDatos.length
    ? Math.round(mesesConDatos.reduce((a, s) => a + s.ingresos, 0) / mesesConDatos.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold leading-tight min-[720px]:text-[32px]">Tesorería</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-gris">
            El dinero del partido: libro de movimientos, importación del extracto bancario y qué se
            publica en la página de cuentas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/tesoreria/importar"
            className="rounded-boton bg-accion px-4 py-2.5 text-[13px] font-bold text-white no-underline shadow-boton"
          >
            Importar extracto
          </Link>
          <Link
            href="/cuentas"
            className="rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular no-underline hover:border-titular"
          >
            Ver cuentas públicas
          </Link>
        </div>
      </div>

      <div className="grid gap-3 min-[520px]:grid-cols-2 min-[960px]:grid-cols-4">
        <Cifra etiqueta="Ingresos este mes" valor={euros(r.ingresosMes)} />
        <Cifra etiqueta="Gastos este mes" valor={euros(r.gastosMes)} tono="out" />
        <Cifra etiqueta="Ingresos del año" valor={euros(r.ingresosAnyo)} />
        <Cifra etiqueta="Gastos del año" valor={euros(r.gastosAnyo)} tono="out" />
      </div>

      <Grafico serie={r.serie} />

      <div className="rounded-tarjeta border border-linea bg-panel p-5 shadow-nav">
        <h2 className="text-[15px] font-bold text-titular">Media mensual de ingresos</h2>
        <p className="mt-1.5 text-[22px] font-extrabold text-titular">{euros(mediaIngresos)}</p>
        <p className="mt-1 text-[12.5px] text-gris">
          Media de los {mesesConDatos.length} mes{mesesConDatos.length === 1 ? '' : 'es'} con
          movimientos registrados. Es una media de lo ya ocurrido, no una previsión: con este
          histórico, proyectar a futuro daría una cifra sin fundamento.
        </p>
        {r.sinPublicar > 0 && (
          <p className="mt-3 rounded-boton bg-fondo px-3 py-2 text-[12.5px] text-cuerpo">
            Hay <strong>{r.sinPublicar}</strong> movimiento{r.sinPublicar === 1 ? '' : 's'} sin
            publicar: no aparecen todavía en la página de cuentas.
          </p>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-tarjeta border border-linea bg-panel p-4">
        <label className="min-w-[200px] flex-1 text-[12px] font-bold text-gris">
          Buscar
          <input
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Concepto, contraparte o categoría"
            className="mt-1 w-full rounded-boton border border-linea px-3 py-2.5 text-[14px] font-normal text-cuerpo"
          />
        </label>
        <label className="text-[12px] font-bold text-gris">
          Tipo
          <select name="direccion" defaultValue={sp.direccion ?? ''} className="mt-1 block rounded-boton border border-linea px-3 py-2.5 text-[14px] font-normal text-cuerpo">
            <option value="">Todos</option>
            <option value="in">Ingresos</option>
            <option value="out">Gastos</option>
          </select>
        </label>
        <label className="text-[12px] font-bold text-gris">
          Categoría
          <select name="categoria" defaultValue={sp.categoria ?? ''} className="mt-1 block rounded-boton border border-linea px-3 py-2.5 text-[14px] font-normal text-cuerpo">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-bold text-gris">
          En /cuentas
          <select name="publicado" defaultValue={sp.publicado ?? ''} className="mt-1 block rounded-boton border border-linea px-3 py-2.5 text-[14px] font-normal text-cuerpo">
            <option value="">Todos</option>
            <option value="si">Publicados</option>
            <option value="no">Sin publicar</option>
          </select>
        </label>
        <label className="text-[12px] font-bold text-gris">
          Orden
          <select name="orden" defaultValue={sp.orden ?? 'fecha_desc'} className="mt-1 block rounded-boton border border-linea px-3 py-2.5 text-[14px] font-normal text-cuerpo">
            <option value="fecha_desc">Fecha ↓</option>
            <option value="fecha_asc">Fecha ↑</option>
            <option value="importe_desc">Importe ↓</option>
            <option value="importe_asc">Importe ↑</option>
          </select>
        </label>
        <button type="submit" className="rounded-boton bg-accion px-5 py-2.5 text-[13px] font-bold text-white shadow-boton">
          Filtrar
        </button>
        <Link href="/admin/tesoreria" className="text-[13px] text-gris underline">
          Limpiar
        </Link>
      </form>

      {/* Quien pasa el guard es admin o tesorero, y la RLS de 0023 da escritura
          a ambos: no hay un tercer rol de solo lectura que distinguir. */}
      <LibroClient movimientos={filas} categorias={categorias} puedeEditar />

      {paginas > 1 && (
        <div className="flex items-center justify-between text-[13px] text-cuerpo">
          <p>
            {total} movimiento{total === 1 ? '' : 's'} · página {pagina} de {paginas}
          </p>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link href={qs(pagina - 1)} className="rounded-boton border border-linea bg-white px-4 py-2 font-bold text-titular no-underline">
                ← Anterior
              </Link>
            )}
            {pagina < paginas && (
              <Link href={qs(pagina + 1)} className="rounded-boton border border-linea bg-white px-4 py-2 font-bold text-titular no-underline">
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
