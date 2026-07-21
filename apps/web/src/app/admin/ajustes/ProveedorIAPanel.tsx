'use client';

import { useEffect, useState, useTransition } from 'react';
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
import {
  activarProveedorIA,
  revertirProveedorIA,
  eliminarProveedorIA,
  actualizarModeloProveedorIA,
} from './actions';

/** Vista serializable del proveedor activo (la clave completa NUNCA llega aquí). */
export type ActivaView = {
  provider: ProveedorIA;
  model: string;
  keySuffix: string;
  changedByName: string;
  changedAtISO: string;
  hasPrevious: boolean;
} | null;

/** Icono lápiz (editar) — sin texto, para el botón compacto del proveedor activo. */
function IconoLapiz() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3zM13.5 6.5l3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icono papelera (eliminar). */
function IconoPapelera() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7m4 4v6m4-6v6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Panel cliente de gestión del proveedor de IA activo (D-016). Une "Proveedor
 * activo" + "Activar proveedor" en un solo componente cliente. Acciones sobre
 * el proveedor activo, todas con auditoría en el servidor:
 *
 *  - ✏️ Editar modelo (in situ): cambia SOLO el modelo reutilizando la clave ya
 *    cifrada — NO obliga a repegar la API key. Es un editor de un único campo
 *    (desplegable de modelos del proveedor + "Otro…").
 *  - 🗑 Eliminar: borra la credencial activa (para el caso sin anterior al que
 *    revertir).
 *  - Revertir al proveedor anterior (si lo hay).
 *
 * "Activar proveedor" (abajo) es solo para dar de alta uno NUEVO (con su clave),
 * con el modelo también como desplegable dependiente del proveedor.
 */
export function ProveedorIAPanel({ activa }: { activa: ActivaView }) {
  // --- Estado del formulario "Activar proveedor NUEVO" ---
  const [provider, setProvider] = useState<ProveedorIA | ''>('');
  const [modelSel, setModelSel] = useState<string>('');
  const [modelCustom, setModelCustom] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');

  // --- Estado de las acciones sobre el proveedor ACTIVO ---
  const [editandoModelo, setEditandoModelo] = useState<boolean>(false);
  const [eliminando, setEliminando] = useState<boolean>(false);
  // Editor de modelo in situ (solo modelo, conserva la clave):
  const [modelEditSel, setModelEditSel] = useState<string>('');
  const [modelEditCustom, setModelEditCustom] = useState<string>('');
  const [guardandoModelo, iniciarGuardarModelo] = useTransition();

  // Guarda el modelo y CIERRA el editor de forma fiable. No se puede depender
  // solo del reset por `activaKey`: si el modelo no cambia, la acción sale por
  // su rama "sin cambios" y `changed_at` no se toca, así que `activaKey` no
  // cambia y el editor se quedaría abierto. Aquí lo cerramos explícitamente al
  // terminar la acción (haya cambiado el modelo o no).
  function guardarModelo(formData: FormData) {
    iniciarGuardarModelo(async () => {
      try {
        await actualizarModeloProveedorIA(formData);
        setEditandoModelo(false);
      } catch {
        // Si la acción falla (validación/red), se deja el editor abierto.
      }
    });
  }

  // Identidad estable de la credencial activa. Cuando cambia (activar, borrar,
  // editar modelo -> revalidatePath re-renderiza con otra `activa`, o null),
  // reseteamos los toggles transitorios: si no, `eliminando`/`editandoModelo`
  // sobreviven al cambio y, p. ej., tras ACTIVAR un proveedor reaparecería la
  // confirmación de borrado que quedó abierta de una interacción anterior.
  const activaKey = activa
    ? `${activa.provider}|${activa.model}|${activa.keySuffix}|${activa.changedAtISO}`
    : 'none';
  useEffect(() => {
    setEliminando(false);
    setEditandoModelo(false);
  }, [activaKey]);

  const modelos = provider ? MODELOS_POR_PROVEEDOR[provider] ?? [] : [];
  const usandoOtro = modelSel === MODELO_OTRO;
  const modeloFinal = (usandoOtro ? modelCustom : modelSel).trim();

  function elegirProveedor(p: ProveedorIA | '') {
    setProvider(p);
    setModelSel(p ? modeloRecomendado(p) : '');
    setModelCustom('');
  }

  // Modelos y valor final del editor in situ (usa el proveedor de la fila activa).
  const modelosEdit = activa ? MODELOS_POR_PROVEEDOR[activa.provider] ?? [] : [];
  const editUsandoOtro = modelEditSel === MODELO_OTRO;
  const modeloEditFinal = (editUsandoOtro ? modelEditCustom : modelEditSel).trim();

  function abrirEditorModelo() {
    if (!activa) return;
    setEliminando(false);
    if (esModeloConocido(activa.provider, activa.model)) {
      setModelEditSel(activa.model);
      setModelEditCustom('');
    } else {
      setModelEditSel(MODELO_OTRO);
      setModelEditCustom(activa.model);
    }
    setEditandoModelo(true);
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
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (editandoModelo ? setEditandoModelo(false) : abrirEditorModelo())}
                  title="Editar modelo"
                  className="flex h-9 items-center gap-1.5 rounded-boton border border-linea px-3 text-[12.5px] font-bold text-titular hover:border-titular"
                >
                  <IconoLapiz />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEliminando((v) => !v);
                    setEditandoModelo(false);
                  }}
                  aria-label="Eliminar proveedor activo"
                  title="Eliminar proveedor activo"
                  className="grid h-9 w-9 place-items-center rounded-boton border border-red-300 text-red-600 hover:bg-red-50"
                >
                  <IconoPapelera />
                </button>
              </div>
            </div>
            <p className="text-[12.5px] text-gris">
              Cambiado por {activa.changedByName} el {new Date(activa.changedAtISO).toLocaleString('es-ES')}
            </p>

            {/* Editor de MODELO in situ — conserva la clave (solo cambia el modelo). */}
            {editandoModelo && (
              <form
                action={guardarModelo}
                className="space-y-2 rounded-boton border border-linea bg-fondo p-3"
              >
                <p className="text-[13px] font-bold text-titular">
                  Cambiar el modelo de {PROVEEDOR_LABEL[activa.provider]}
                </p>
                <p className="text-[12.5px] text-gris">
                  La clave de API se mantiene (no hace falta volver a introducirla). Solo cambias el modelo.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-gris">Modelo</label>
                    <select
                      value={modelEditSel}
                      onChange={(e) => setModelEditSel(e.target.value)}
                      className="w-full rounded-boton border border-linea px-3 py-3 text-[14px]"
                    >
                      {modelosEdit.map((m) => (
                        <option key={m.id} value={m.id}>
                          {etiquetaModelo(m)}
                        </option>
                      ))}
                      <option value={MODELO_OTRO}>Otro (escribir a mano)…</option>
                    </select>
                    {editUsandoOtro && (
                      <Input
                        className="mt-2"
                        value={modelEditCustom}
                        onChange={(e) => setModelEditCustom(e.target.value)}
                        placeholder="id exacto, ej. gemini-2.5-flash"
                        aria-label="Id del modelo (escrito a mano)"
                      />
                    )}
                    <input type="hidden" name="model" value={modeloEditFinal} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-gris">
                      Motivo (obligatorio, queda en auditoría)
                    </label>
                    <Input name="motivo" required placeholder="Ej. corrección del id de modelo" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={guardandoModelo}
                    className="rounded-boton bg-accion px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
                  >
                    {guardandoModelo ? 'Guardando…' : 'Guardar modelo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoModelo(false)}
                    disabled={guardandoModelo}
                    className="rounded-boton border border-linea px-4 py-2 text-[13px] font-bold text-titular hover:border-titular disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Confirmación de ELIMINAR. */}
            {eliminando && (
              <form
                action={eliminarProveedorIA}
                className="space-y-2 rounded-boton border border-red-300 bg-red-50 p-3"
              >
                <p className="text-[13px] font-bold text-red-800">
                  Eliminar {PROVEEDOR_LABEL[activa.provider]} · {activa.model}
                </p>
                <p className="text-[12.5px] text-red-900">
                  Se borra por completo esta credencial. Tras esto no quedará ningún proveedor activo
                  hasta que actives otro — el chat dejará de generar respuestas. Esta acción no se puede
                  deshacer.
                </p>
                <label className="block text-[12px] font-bold text-red-800">
                  Motivo de la eliminación (obligatorio, queda en auditoría)
                </label>
                <Input
                  name="motivo"
                  required
                  placeholder="Ej. credencial introducida por error"
                  className="border-red-300 bg-white"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    className="rounded-boton bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-700"
                  >
                    Sí, eliminar proveedor
                  </button>
                  <button
                    type="button"
                    onClick={() => setEliminando(false)}
                    className="rounded-boton border border-red-300 px-4 py-2 text-[13px] font-bold text-red-700 hover:bg-red-100"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

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
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-titular">Activar proveedor</h3>

        <form action={activarProveedorIA} className="mt-3 space-y-3" autoComplete="off">
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
                  placeholder="id exacto del modelo, ej. gemini-flash-latest"
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
            Activar proveedor
          </button>
        </form>
      </Tarjeta>
    </>
  );
}
