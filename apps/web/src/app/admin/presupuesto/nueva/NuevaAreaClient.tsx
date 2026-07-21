'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { guardarPartidaAction } from '@/lib/simulador/adminActions';
import type { Ambito, TipoPartida } from '@/lib/simulador/tipos';

const AMBITOS: { valor: Ambito; label: string }[] = [
  { valor: 'estatal', label: 'Estatal' },
  { valor: 'autonomico', label: 'Autonómico' },
  { valor: 'local', label: 'Local' },
  { valor: 'otro', label: 'Otro' },
];

/**
 * Alta rápida de un área raíz. Los campos finos (fórmulas, palanca,
 * ministerio, RC…) se completan luego en el editor de área — aquí solo lo
 * imprescindible para que la ficha aparezca en el tablero.
 */
export function NuevaAreaClient() {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoPartida>('gasto');
  const [nombre, setNombre] = useState('');
  const [ambito, setAmbito] = useState<Ambito>('estatal');
  const [valorEuros, setValorEuros] = useState('');
  const [fuente, setFuente] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function crear() {
    setError(null);
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    const fd = new FormData();
    fd.set('tipo', tipo);
    fd.set('parent_id', '');
    fd.set('nombre', nombre.trim());
    fd.set('ambito', ambito);
    fd.set('actual_modo', 'fijo');
    fd.set('actual_valor_euros', valorEuros);
    fd.set('actual_formula', '');
    fd.set('fuente_actual', fuente);
    fd.set('rc_modo', 'fijo');
    fd.set('rc_valor_euros', '');
    fd.set('rc_pct', '');
    fd.set('rc_formula', '');
    fd.set('justificacion_rc', '');
    fd.set('ministry_id', '');
    fd.set('palanca_min_euros', '');
    fd.set('palanca_max_euros', '');
    fd.set('color', '');

    iniciar(async () => {
      const r = await guardarPartidaAction(fd);
      if (!r.ok) {
        setError(r.error ?? 'No se ha podido crear el área.');
        return;
      }
      router.push(`/admin/presupuesto/${r.id}`);
    });
  }

  return (
    <div className="max-w-xl rounded-tarjeta border border-linea bg-white p-6">
      <div className="mb-4 inline-flex rounded-boton border border-linea bg-fondo p-1">
        {(['gasto', 'ingreso'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`rounded-boton px-4 py-2 text-[13.5px] font-bold ${
              tipo === t ? 'bg-accion text-white' : 'text-cuerpo'
            }`}
          >
            {t === 'gasto' ? 'Gasto' : 'Ingreso'}
          </button>
        ))}
      </div>

      <label className="block text-[12.5px] font-semibold text-gris">
        Nombre del área
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="p. ej. Sanidad"
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2.5 text-[14.5px]"
        />
      </label>

      <label className="mt-3 block text-[12.5px] font-semibold text-gris">
        Ámbito
        <select
          value={ambito}
          onChange={(e) => setAmbito(e.target.value as Ambito)}
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2.5 text-[14.5px]"
        >
          {AMBITOS.map((a) => (
            <option key={a.valor} value={a.valor}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-[12.5px] font-semibold text-gris">
        Valor actual (oficial), en euros
        <input
          type="number"
          step="0.01"
          value={valorEuros}
          onChange={(e) => setValorEuros(e.target.value)}
          placeholder="1200000000000"
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2.5 text-[14.5px]"
        />
      </label>

      <label className="mt-3 block text-[12.5px] font-semibold text-gris">
        Fuente
        <input
          value={fuente}
          onChange={(e) => setFuente(e.target.value)}
          placeholder="PGE 2026, sección…"
          className="mt-1 w-full rounded-boton border border-linea px-3 py-2.5 text-[14.5px]"
        />
      </label>

      {error && <p className="mt-3 text-[13px] font-semibold text-magenta">{error}</p>}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={crear}
          disabled={pendiente}
          className="rounded-boton bg-accion px-5 py-2.5 text-[14px] font-bold text-white shadow-boton disabled:opacity-60"
        >
          {pendiente ? 'Creando…' : 'Crear área'}
        </button>
      </div>
    </div>
  );
}
