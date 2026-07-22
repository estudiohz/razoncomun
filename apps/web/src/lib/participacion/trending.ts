import { votacionAbierta } from './types';
import type { Propuesta } from './types';

/**
 * Score Trending (D-P13), fórmula estilo Hacker News:
 *   support_count / (horas_desde_creacion + 2) ^ 1.5
 *
 * Función PURA y unit-testable en TypeScript (no en SQL — el orden se
 * calcula en la app, no en la BD). Recibe `ahoraMs` explícito para que los
 * tests no dependan del reloj real.
 */
export function scoreTrending(
  p: Pick<Propuesta, 'support_count' | 'created_at'>,
  ahoraMs: number = Date.now(),
): number {
  const horas = Math.max(0, (ahoraMs - new Date(p.created_at).getTime()) / 3_600_000);
  return p.support_count / Math.pow(horas + 2, 1.5);
}

/**
 * Filtra a solo hilos con votación abierta (regla explícita de Sergio,
 * D-P6/D-P13) y ordena por score Trending descendente.
 */
export function ordenarTrending<T extends Pick<Propuesta, 'support_count' | 'created_at' | 'status' | 'deadline_at'>>(
  propuestas: T[],
  ahoraMs: number = Date.now(),
): T[] {
  return propuestas
    .filter((p) => votacionAbierta(p, ahoraMs))
    .map((p) => ({ p, s: scoreTrending(p, ahoraMs) }))
    .sort((a, b) => b.s - a.s)
    .map(({ p }) => p);
}
