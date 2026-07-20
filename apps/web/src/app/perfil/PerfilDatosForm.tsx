'use client';

import { useActionState, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { actualizarPerfil, type EstadoActualizarPerfil } from './actions';

type Provincia = { id: number; name: string };

const ESTADO_INICIAL: EstadoActualizarPerfil = { ok: null, mensaje: '' };

/**
 * Formulario de datos personales de /perfil. Cliente y con inputs
 * CONTROLADOS a propósito (BUG reportado por Sergio: con `defaultValue` en
 * un Server Component, tras guardar el <select> "se resetea" — React solo
 * aplica `defaultValue` en el montaje inicial, no en cada re-render, así
 * que un cambio de props no lo actualiza). Al llevar el valor en estado
 * propio, el selector y el nombre SIEMPRE reflejan lo último guardado (o lo
 * que el usuario está escribiendo), nunca "vuelven atrás".
 */
export function PerfilDatosForm({
  displayNameInicial,
  provinciaInicial,
  newsletterInicial,
  newsletterOptInAt,
  provincias,
}: {
  displayNameInicial: string;
  provinciaInicial: number | null;
  newsletterInicial: boolean;
  newsletterOptInAt: string | null;
  provincias: Provincia[];
}) {
  const [estado, formAction, enviando] = useActionState(actualizarPerfil, ESTADO_INICIAL);

  const [nombre, setNombre] = useState(displayNameInicial);
  const [provincia, setProvincia] = useState(provinciaInicial ? String(provinciaInicial) : '');
  const [newsletter, setNewsletter] = useState(newsletterInicial);
  const [optInAt, setOptInAt] = useState(newsletterOptInAt);
  // Se incrementa en cada guardado con éxito y se usa como `key` del
  // <select> (ver más abajo) — fuerza un remount limpio de ese elemento.
  const [selectKey, setSelectKey] = useState(0);

  // Tras un guardado con éxito, resincroniza el formulario con los valores
  // QUE DE VERDAD quedaron en BD (`estado.valores`, eco de la propia acción)
  // en vez de fiarse de que el estado local no se vaya a tocar solo.
  //
  // BUG reportado por Sergio, en dos capas:
  // 1. El `.update()` no comprobaba error (ya arreglado en actions.ts).
  // 2. El <select> de provincia se quedaba mostrando el valor ANTERIOR justo
  //    después de guardar, aunque el estado de React (`provincia`, logueado
  //    aquí durante el diagnóstico) YA tenía el valor correcto en cada
  //    render — es decir, no era un bug de lógica de estado sino de
  //    reconciliación DOM: el <select> controlado y sus <option> se
  //    actualizan en el MISMO commit que la respuesta de la acción del
  //    servidor (vía `useActionState` + `revalidatePath`), y el navegador
  //    pierde la selección real aunque React "cree" que ya está bien.
  //    Al no confiar en que basta con que el estado sea correcto, forzamos
  //    un remount limpio del <select> exactamente en ese momento (`key`
  //    distinta) para que vuelva a pintarse desde cero con el valor ya
  //    corregido — eliminando la ventana de reconciliación problemática.
  useEffect(() => {
    if (estado.ok === true && estado.valores) {
      setNombre(estado.valores.display_name ?? '');
      setProvincia(estado.valores.origin_province_id ? String(estado.valores.origin_province_id) : '');
      setNewsletter(estado.valores.newsletter_opt_in);
      setOptInAt(estado.valores.newsletter_opt_in_at);
      setSelectKey((k) => k + 1);
    }
  }, [estado]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="display_name" className="mb-1.5 block text-[13.5px] font-semibold">
          Nombre a mostrar
        </label>
        <input
          id="display_name"
          name="display_name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
        />
      </div>
      <div>
        <label htmlFor="origin_province_id" className="mb-1.5 block text-[13.5px] font-semibold">
          Provincia de origen <span className="font-normal text-gris">(opcional, autodeclarado)</span>
        </label>
        <select
          key={selectKey}
          id="origin_province_id"
          name="origin_province_id"
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
        >
          <option value="">Sin especificar</option>
          {provincias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2.5 text-[13.5px] text-cuerpo">
        <input
          type="checkbox"
          name="newsletter_opt_in"
          checked={newsletter}
          onChange={(e) => setNewsletter(e.target.checked)}
          className="h-4 w-4 rounded border-linea text-accion"
        />
        Recibir la newsletter
        {optInAt && (
          <span className="text-[12px] text-gris">(opt-in del {formatearFecha(optInAt)})</span>
        )}
      </label>

      {estado.ok !== null && (
        <p
          role="status"
          className={cn(
            'rounded-boton px-3.5 py-2.5 text-[13px] font-medium',
            estado.ok ? 'bg-teal/10 text-titular' : 'bg-magenta/10 text-magenta',
          )}
        >
          {estado.ok ? 'Guardado ✓' : estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white shadow-boton hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
