'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { buscarSimilaresAction, crearPropuestaAction } from '@/app/propuestas/actions';
import type { Propuesta } from '@/lib/participacion/types';

const DEPARTAMENTOS = [
  'agricultura-ganaderia',
  'autonomos',
  'economia',
  'educacion',
  'gasto-publico',
  'igualdad',
  'industria',
  'justicia',
  'sanidad',
  'transportes',
  'vivienda',
];

/**
 * Formulario de nueva propuesta con detección de duplicados
 * (vision-plataforma.md Pilar 3.2: "ya existe, súmate"). Búsqueda por texto
 * mientras se escribe el título (fallback ILIKE/trgm — ver hook para rc-08
 * en lib/participacion/proposals.ts::buscarPropuestasSimilares).
 */
export function FormularioPropuesta() {
  const [titulo, setTitulo] = useState('');
  const [similares, setSimilares] = useState<Propuesta[]>([]);
  const [buscando, iniciarBusqueda] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function alCambiarTitulo(valor: string) {
    setTitulo(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    if (valor.trim().length < 6) {
      setSimilares([]);
      return;
    }
    temporizador.current = setTimeout(() => {
      iniciarBusqueda(async () => {
        const resultado = await buscarSimilaresAction(valor);
        setSimilares(resultado);
      });
    }, 450);
  }

  return (
    <form
      action={(fd) => iniciarEnvio(() => crearPropuestaAction(fd))}
      className="space-y-5 rounded-tarjeta border border-linea bg-panel p-6 shadow-nav"
    >
      <div>
        <label htmlFor="title" className="mb-1.5 block text-[13.5px] font-semibold">
          Título
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={8}
          maxLength={140}
          value={titulo}
          onChange={(e) => alCambiarTitulo(e.target.value)}
          placeholder="Una frase concreta, no una pregunta"
          className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
        />
      </div>

      {(buscando || similares.length > 0) && (
        <div className="rounded-boton border border-cat-educacion/40 bg-cat-educacion/10 p-4">
          <p className="text-[13px] font-bold text-titular">
            {buscando ? 'Buscando propuestas parecidas…' : '¿Ya existe algo parecido? Súmate en vez de duplicar:'}
          </p>
          {!buscando && (
            <ul className="mt-2 space-y-1.5">
              {similares.map((p) => (
                <li key={p.id}>
                  <Link href={`/propuestas/${p.id}`} className="text-[13.5px] font-semibold text-titular underline">
                    {p.title}
                  </Link>
                  <span className="ml-2 text-[12px] text-gris">{p.support_count} apoyos</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <label htmlFor="department" className="mb-1.5 block text-[13.5px] font-semibold">
          Departamento
        </label>
        <select
          id="department"
          name="department"
          required
          className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
        >
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>
              {d.replace(/-/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="body" className="mb-1.5 block text-[13.5px] font-semibold">
          Desarrollo
        </label>
        <textarea
          id="body"
          name="body"
          required
          minLength={40}
          rows={6}
          placeholder="Explica el problema, la propuesta concreta y por qué debería adoptarse."
          className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
        />
      </div>

      <div>
        <label htmlFor="estimated_cost_euros" className="mb-1.5 block text-[13.5px] font-semibold">
          Coste/ahorro estimado en € <span className="font-normal text-gris">(opcional, se pulirá en el test de estrés)</span>
        </label>
        <input
          id="estimated_cost_euros"
          name="estimated_cost_euros"
          type="number"
          step="1"
          placeholder="p.ej. 2000000 (positivo = coste, negativo = ahorro)"
          className="w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[15px]"
        />
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="rounded-boton bg-accion px-6 py-3 text-[14px] font-bold text-white shadow-boton hover:-translate-y-0.5 disabled:opacity-60"
      >
        {enviando ? 'Publicando…' : 'Publicar propuesta'}
      </button>
    </form>
  );
}
