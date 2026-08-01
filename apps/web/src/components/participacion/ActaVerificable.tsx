import { generarActa } from '@/lib/participacion/acta';
import type { Ballot, Vote } from '@/lib/participacion/types';

/**
 * Bloque de acta de una votación cerrada (server component: el hash se
 * calcula en servidor con node:crypto en cada render — es barato y así no hay
 * ninguna copia almacenada que pudiera divergir de los datos reales; si
 * alguien tocara un voto en BD, el hash mostrado cambiaría y dejaría de
 * coincidir con el que cualquiera guardó o citó el día del cierre).
 */
export function ActaVerificable({ vote, ballots }: { vote: Vote; ballots: Ballot[] }) {
  const acta = generarActa(vote, ballots);

  return (
    <div className="mt-5 rounded-tarjeta border border-linea bg-panel p-6">
      <p className="text-[13.5px] text-cuerpo">
        Huella SHA-256 del acta (reglas selladas + resultado + los {ballots.length} votos, que son
        públicos y nominales). Guárdala o cítala: si algún dato de esta votación cambiara después
        del cierre, la huella dejaría de coincidir.
      </p>
      <p className="mt-3 break-all rounded-boton bg-fondo px-4 py-3 font-mono text-[13px] font-bold text-titular">
        {acta.hash}
      </p>
      <details className="mt-4">
        <summary className="cursor-pointer text-[13px] font-semibold text-titular">
          Cómo verificarla por tu cuenta
        </summary>
        <div className="mt-3 space-y-2 text-[13px] text-cuerpo">
          <p>
            1. Copia el contenido del acta de abajo a un fichero <code>acta.txt</code> (tal cual,
            sin línea final extra).
          </p>
          <p>
            2. Calcula su SHA-256 — en Linux/Mac: <code>shasum -a 256 acta.txt</code>; en Windows:{' '}
            <code>certutil -hashfile acta.txt SHA256</code>.
          </p>
          <p>
            3. Compara con la huella de arriba. El algoritmo de serialización es público:{' '}
            <code>apps/web/src/lib/participacion/acta.ts</code> en el repositorio del partido.
          </p>
        </div>
        <pre className="mt-3 max-h-[320px] overflow-auto rounded-boton bg-fondo p-4 text-[11.5px] leading-relaxed text-cuerpo">
          {acta.contenido}
        </pre>
      </details>
    </div>
  );
}
