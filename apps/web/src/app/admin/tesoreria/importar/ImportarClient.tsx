'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { importarExtractoAction, type ResultadoImportacion } from './actions';

export function ImportarClient() {
  const [pendiente, iniciar] = useTransition();
  const [r, setR] = useState<ResultadoImportacion | null>(null);

  return (
    <div className="space-y-5">
      <form
        action={(fd) => iniciar(async () => setR(await importarExtractoAction(fd)))}
        className="rounded-tarjeta border border-linea bg-panel p-6 shadow-nav"
      >
        <label className="block text-[13px] font-bold text-titular">
          Fichero del banco (CSV)
          <input
            type="file"
            name="extracto"
            accept=".csv,.txt,text/csv,text/plain"
            required
            className="mt-2 block w-full rounded-boton border border-linea bg-white px-3 py-2.5 text-[13.5px] font-normal text-cuerpo file:mr-3 file:rounded-boton file:border-0 file:bg-accion file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-white"
          />
        </label>
        <p className="mt-2 text-[12.5px] text-gris">
          Se reconocen los formatos habituales: separador coma o punto y coma, importe en una
          columna con signo o en dos (debe/haber), y fechas tipo 15/07/2026 o 2026-07-15. Si tienes
          un Excel, guárdalo antes como CSV UTF-8.
        </p>
        <button
          type="submit"
          disabled={pendiente}
          className="mt-4 rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton disabled:opacity-50"
        >
          {pendiente ? 'Importando…' : 'Importar'}
        </button>
      </form>

      {r && !r.ok && (
        <div className="rounded-tarjeta border border-magenta/40 bg-magenta/[.06] p-5">
          <p className="text-[14px] font-bold text-magenta">{r.error}</p>
          {r.columnas && r.columnas.length > 0 && (
            <p className="mt-2 text-[12.5px] text-cuerpo">
              Columnas detectadas: {r.columnas.join(' · ')}
            </p>
          )}
          {r.errores && r.errores.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[12.5px] text-cuerpo">
              {r.errores.map((e) => (
                <li key={e.linea}>
                  Línea {e.linea}: {e.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {r?.ok && (
        <div className="rounded-tarjeta border border-teal/40 bg-teal/[.06] p-5">
          <p className="text-[15px] font-bold text-titular">
            {r.importadas} movimiento{r.importadas === 1 ? '' : 's'} importado
            {r.importadas === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-cuerpo">
            <li>Leídos del fichero: {r.leidas}</li>
            {(r.duplicadas ?? 0) > 0 && (
              <li>
                Ya estaban en el libro: {r.duplicadas} (se ignoran, no se duplican importes)
              </li>
            )}
            {(r.errores?.length ?? 0) > 0 && (
              <li>Líneas que no se han podido leer: {r.errores!.length}</li>
            )}
          </ul>
          <p className="mt-3 rounded-boton bg-white px-3 py-2 text-[12.5px] text-cuerpo">
            Han entrado <strong>sin publicar</strong>. Revísalos, quita los nombres de particulares
            donde haga falta y publícalos uno a uno para que salgan en la página de cuentas.
          </p>
          {r.errores && r.errores.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-[12.5px] text-gris">
              {r.errores.map((e) => (
                <li key={e.linea}>
                  Línea {e.linea}: {e.motivo}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/tesoreria?publicado=no"
            className="mt-4 inline-block rounded-boton bg-accion px-5 py-2.5 text-[13px] font-bold text-white no-underline shadow-boton"
          >
            Revisar lo importado
          </Link>
        </div>
      )}
    </div>
  );
}
