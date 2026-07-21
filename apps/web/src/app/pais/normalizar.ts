/**
 * app/pais/normalizar.ts
 *
 * Ayuda de presentación (NO es parte del motor `lib/simulador/`): el anon
 * solo ve partidas `publicado=true` (RLS, `0029_simulador.sql`). Si el
 * equipo publica una hija antes que su padre — o despublica el padre más
 * tarde —, esa hija llega al público con un `parent_id` que apunta a una
 * fila que no está en el lote visible. Sin normalizar, esa fila quedaría
 * "colgada": no es raíz (su `parent_id` no es null) pero tampoco cuenta
 * como hija de nadie visible, así que ni aparece en el balance ni en
 * ningún nivel del drill-down.
 *
 * Se trata como raíz suelta (mejor mostrarla que perderla). Se aplica UNA
 * vez, antes de pasar los datos tanto al `resolver()` como al árbol de
 * navegación del panel — así balance y UI nunca se desincronizan.
 */

interface ConPadre {
  id: string;
  parent_id: string | null;
}

export function normalizarRaicesPublicas<T extends ConPadre>(filas: T[]): T[] {
  const ids = new Set(filas.map((f) => f.id));
  return filas.map((f) => (f.parent_id !== null && !ids.has(f.parent_id) ? { ...f, parent_id: null } : f));
}
