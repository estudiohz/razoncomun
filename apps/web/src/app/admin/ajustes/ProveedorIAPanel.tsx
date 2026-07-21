'use client';

import { useRef, useState } from 'react';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { Input } from '@/components/ui/Input';
import {
  PROVEEDORES_IA,
  PROVEEDOR_LABEL,
  MODELOS_POR_PROVEEDOR,
  MODELO_OTRO,
  modeloRecomendado,
  esModeloConocido,
  etiquetaModelo,
  type ProveedorIA,
} from '@/lib/admin/modelos-ia';
import { activarProveedorIA, revertirProveedorIA } from './actions';

/** Vista serializable del proveedor activo (la clave completa NUNCA llega aquí). */
export type ActivaView = {
  provider: ProveedorIA;
  model: string;
  keySuffix: string;
  changedByName: string;
  changedAtISO: string;
  hasPrevious: boolean;
} | null;

/**
 * Panel cliente de gestión del proveedor de IA activo (D-016). Sustituye a las
 * dos tarjetas server "Proveedor activo" + "Activar proveedor" para que el
 * botón "Editar" de la primera pueda precargar el formulario de la segunda
 * (comparten estado de cliente). Mejoras sobre el formulario original:
 *
 *  1. El modelo es un DESPLEGABLE dependiente del proveedor (con opción "Otro…"),
 *     no un texto libre — así no se puede volver a escribir un id inexistente
 *     como "gemini-2.5".
 *  2. "Editar / corregir modelo" sobre el proveedor activo precarga proveedor y
 *     modelo; solo hay que reelegir el modelo y repegar la clave (la anterior no
 *     se puede recuperar por diseño de seguridad, migración 0016).
 *
 * Las acciones de servidor (activar/revertir) mantienen TODAS sus puertas
 * (admin + aal2 + motivo + auditoría) intactas: esto es solo la capa de UI.
 */
export function ProveedorIAPanel({ activa }: { activa: ActivaView }) {
  const [provider, setProvider] = useState<ProveedorIA | ''>('');
  // Valor del <select> de modelo: un id del catálogo o el sentinela "Otro…".
  const [modelSel, setModelSel] = useState<string>('');
  const [modelCustom, setModelCustom] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [editando, setEditando] = useState<boolean>(false);
  const formRef = useRef<HTMLFormElement>(null);

  const modelos = provider ? MODELOS_POR_PROVEEDOR[provider] ?? [] : [];
  const usandoOtro = modelSel === MODELO_OTRO;
  const modeloFinal = (usandoOtro ? modelCustom : modelSel).trim();

  function elegirProveedor(p: ProveedorIA | '') {
    setProvider(p);
    // Autoselecciona el modelo recomendado del proveedor recién elegido.
    setModelSel(p ? modeloRecomendado(p) : '');
    setModelCustom('');
  }

  function editarActivo() {
    if (!activa) return;
    setProvider(activa.provider);
    if (esModeloConocido(activa.provider, activa.model)) {
      setModelSel(activa.model);
      setModelCustom('');
    } else {
      setModelSel(MODELO_OTRO);
      setModelCustom(activa.model);
    }
    setMotivo('Corrección del modelo del proveedor activo');
    setEditando(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <Tarjeta className="p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-titular">Proveedor activo</h3>
        {activa ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accion px-3 py-1 text-[12px] font-bold text-white">Activo</span>
              <span className="text-[15px] font-bold text-titular">{PROVEEDOR_LABEL[activa.provider]}</span>
              <span className="text-[13.5px] text-cuerpo">· {activa.model}</span>
              <span className="rounded bg-fondo px-2 py-0.5 text-[12px] font-mono text-gris">
                •••• {activa.keySuffix}
              </span>
              <button
                type="button"
                onClick={editarActivo}
                className="ml-auto rounded-boton border border-linea px-3 py-1.5 text-[12.5px] font-bold text-titular hover:border-titular"
              >
                Editar / corregir modelo
              </button>
            </div>
            <p className="text-[12.5px] text-gris">
              Cambiado por {activa.changedByName} el {new Date(activa.changedAtISO).toLocaleString('es-ES')}
            </p>

            {activa.hasPrevious ? (
              <form action={revertirProveedorIA} className="flex flex-wrap items-end gap-2 border-t border-linea pt-3">
                <div className="min-w-[260px] flex-1">
                  <label className="mb-1 block text-[12px] font-bold text-gris">
                    Motivo de la reversión (obligatorio, queda en auditoría)
                  </label>
                  <Input name="motivo" required placeholder="Ej. resultado de la suite por debajo del umbral" />
                </div>
                <button
                  type="submit"
                  className="rounded-boton border border-red-300 px-4 py-3 text-[13px] font-bold text-red-600"
                >
                  Revertir al proveedor anterior
                </button>
              </form>
            ) : (
              <p className="border-t border-linea pt-3 text-[12.5px] text-gris">
                Este proveedor no tiene uno anterior registrado — no hay nada a lo que revertir.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-gris">
            No hay ningún proveedor activo todavía. Activa uno con el formulario de abajo.
          </p>
        )}
      </Tarjeta>

      <Tarjeta className="p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-titular">
          {editando ? 'Corregir proveedor activo' : 'Activar proveedor'}
        </h3>

        {editando && (
          <p className="mt-2 rounded-boton border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            Estás corrigiendo el proveedor activo. Reelige el modelo correcto y{' '}
            <strong>vuelve a pegar la clave de API</strong>: la anterior no se puede recuperar (se guarda
            cifrada y solo se descifra al llamar al modelo).
          </p>
        )}

        <form ref={formRef} action={activarProveedorIA} className="mt-3 space-y-3" autoComplete="off">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Proveedor</label>
              <select
                name="provider"
                required
                value={provider}
                onChange={(e) => elegirProveedor(e.target.value as ProveedorIA | '')}
                className="w-full rounded-boton border border-linea px-3 py-3 text-[14px]"
              >
                <option value="" disabled>
                  Elige un proveedor
                </option>
                {PROVEEDORES_IA.map((p) => (
                  <option key={p} value={p}>
                    {PROVEEDOR_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-gris">Modelo</label>
              <select
                value={modelSel}
                onChange={(e) => setModelSel(e.target.value)}
                disabled={!provider}
                className="w-full rounded-boton border border-linea px-3 py-3 text-[14px] disabled:bg-fondo disabled:text-gris"
              >
                {!provider && (
                  <option value="" disabled>
                    Elige primero un proveedor
                  </option>
                )}
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {etiquetaModelo(m)}
                  </option>
                ))}
                <option value={MODELO_OTRO}>Otro (escribir a mano)…</option>
              </select>
              {usandoOtro && (
                <Input
                  className="mt-2"
                  value={modelCustom}
                  onChange={(e) => setModelCustom(e.target.value)}
                  placeholder="id exacto del modelo, ej. gemini-2.5-flash"
                  aria-label="Id del modelo (escrito a mano)"
                />
              )}
              {/* El valor real que recibe la Server Action: id del catálogo o el escrito a mano. */}
              <input type="hidden" name="model" value={modeloFinal} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Clave de API</label>
            <Input
              name="apiKey"
              type="password"
              required
              autoComplete="new-password"
              placeholder="La clave completa no se vuelve a mostrar tras guardarla"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">
              Motivo del cambio (obligatorio, queda en auditoría)
            </label>
            <Input
              name="motivo"
              required
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. mejor rendimiento en la suite de neutralidad"
            />
          </div>
          <label className="flex items-start gap-2 text-[12.5px] text-cuerpo">
            <input name="avisoLeido" type="checkbox" required className="mt-0.5" />
            <span>
              He leído el aviso: sé que se ejecutará la suite de neutralidad y que se revertirá
              automáticamente si el resultado cae por debajo del 95%.
            </span>
          </label>
          <button type="submit" className="w-full rounded-boton bg-accion px-4 py-3 text-[14px] font-bold text-white">
            {editando ? 'Guardar corrección' : 'Activar proveedor'}
          </button>
        </form>
      </Tarjeta>
    </>
  );
}
