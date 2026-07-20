'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';

/** Formulario de título/cuerpo + toggle de vista previa (texto plano, sin markdown). */
export function EditorConVistaPrevia({
  tituloInicial,
  cuerpoInicial,
}: {
  tituloInicial: string;
  cuerpoInicial: string;
}) {
  const [titulo, setTitulo] = useState(tituloInicial);
  const [cuerpo, setCuerpo] = useState(cuerpoInicial);
  const [previsualizar, setPrevisualizar] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-[12px] font-bold text-gris">Título</label>
        <button
          type="button"
          onClick={() => setPrevisualizar((v) => !v)}
          className="text-[12px] font-bold text-titular underline"
        >
          {previsualizar ? 'Volver a editar' : 'Previsualizar'}
        </button>
      </div>

      {previsualizar ? (
        <div className="rounded-boton border border-linea bg-fondo p-4">
          <p className="text-[18px] font-extrabold text-titular">{titulo || '(sin título)'}</p>
          <p className="mt-2 whitespace-pre-wrap text-[14px] text-cuerpo">{cuerpo || '(sin contenido)'}</p>
        </div>
      ) : (
        <>
          <Input name="title" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <div>
            <label className="mb-1 block text-[12px] font-bold text-gris">Contenido</label>
            <textarea
              name="body"
              required
              rows={8}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              className="w-full rounded-boton border border-linea px-4 py-3 text-[14px]"
            />
          </div>
        </>
      )}

      {/* Cuando se está previsualizando, los inputs reales van ocultos para que el form siga
          enviando los valores actuales (controlados por el mismo estado). */}
      {previsualizar && (
        <>
          <input type="hidden" name="title" value={titulo} />
          <input type="hidden" name="body" value={cuerpo} />
        </>
      )}
    </div>
  );
}
