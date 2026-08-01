import { createHash } from 'node:crypto';
import type { Ballot, Vote } from './types';
import { calcularResultado, type ResultadoVotacion } from './votes';

/**
 * Acta verificable de una votación cerrada (punto 4 del paquete "consecuencia
 * visible", 01/08/2026). Aplicación interna del punto 8 del manifiesto (voto
 * blindado): demostrarlo en casa antes de proponerlo para el país.
 *
 * La idea: al cerrar una votación se publica, junto al resultado, una huella
 * SHA-256 calculada sobre una serialización CANÓNICA de las reglas selladas,
 * el resultado y todos los votos (que ya son públicos y nominales, D-001).
 * Cualquiera puede descargar los votos, aplicar este mismo algoritmo —está
 * publicado, es este fichero, el repo es público— y comprobar que obtiene la
 * misma huella. Si alguien alterase un voto a posteriori, la huella dejaría de
 * cuadrar.
 *
 * Sin blockchain a propósito: un hash recomputable publicado da la
 * verificabilidad que necesitamos con coste cero y sin dependencia de nadie.
 *
 * REGLA DURA: la serialización es un contrato. Cambiarla invalida la
 * verificación de todas las actas ya publicadas — si algún día hay que
 * cambiarla, se versiona (v2) y las actas viejas se siguen verificando con v1.
 */
export const VERSION_ACTA = 1;

export interface Acta {
  version: number;
  hash: string;
  /** El texto exacto sobre el que se calculó el hash, para que verificar sea trivial. */
  contenido: string;
}

/**
 * Serialización canónica v1. Determinista: mismo conjunto de votos → mismo
 * texto, byte a byte.
 * - Votos ordenados por user_id (orden de emisión no: dos lecturas de BD
 *   podrían devolverlos distinto).
 * - `cast_at` en ISO UTC.
 * - Sin JSON: líneas planas separadas por \n, más fáciles de recomputar a
 *   mano o con una línea de shell que un JSON con orden de claves ambiguo.
 */
export function serializarActa(vote: Vote, ballots: Ballot[], resultado: ResultadoVotacion): string {
  const lineas: string[] = [
    `acta:v${VERSION_ACTA}`,
    `vote:${vote.id}`,
    `proposal:${vote.proposal_id}`,
    `ventana:${new Date(vote.opens_at).toISOString()}/${new Date(vote.closes_at).toISOString()}`,
    `reglas:quorum=${vote.quorum};umbral=${vote.threshold};ambito=${vote.scope}`,
    `resultado:vinculantes=${resultado.vinculantes};consultivos=${resultado.consultivos};favor=${resultado.recuentoVinculante.favor};contra=${resultado.recuentoVinculante.contra};abstencion=${resultado.recuentoVinculante.abstencion};quorum_alcanzado=${resultado.quorumAlcanzado};umbral_superado=${resultado.umbralSuperado}`,
    'votos:',
  ];

  const ordenados = [...ballots].sort((a, b) => a.user_id.localeCompare(b.user_id));
  for (const b of ordenados) {
    lineas.push(`${b.user_id};${b.choice};${b.weight};${new Date(b.cast_at).toISOString()}`);
  }

  return lineas.join('\n');
}

export function generarActa(vote: Vote, ballots: Ballot[]): Acta {
  const resultado = calcularResultado(vote, ballots);
  const contenido = serializarActa(vote, ballots, resultado);
  const hash = createHash('sha256').update(contenido, 'utf8').digest('hex');
  return { version: VERSION_ACTA, hash, contenido };
}
