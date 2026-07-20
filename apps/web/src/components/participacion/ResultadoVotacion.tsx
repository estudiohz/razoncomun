import type { Ballot, Vote } from '@/lib/participacion/types';
import { ETIQUETA_ELECCION } from '@/lib/participacion/types';
import type { ResultadoVotacion as TipoResultado } from '@/lib/participacion/votes';

/**
 * Resultado publicado: participación, quórum, umbral y — D-001 — el detalle
 * NOMINAL de cada voto (quién votó qué), público y sin seudonimizar.
 */
export function ResultadoVotacion({
  vote,
  resultado,
  ballots,
}: {
  vote: Vote;
  resultado: TipoResultado;
  ballots: (Ballot & { display_name: string | null })[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metrica etiqueta="Votos vinculantes" valor={String(resultado.vinculantes)} />
        <Metrica etiqueta="Votos consultivos" valor={String(resultado.consultivos)} />
        <Metrica etiqueta="Quórum exigido" valor={String(vote.quorum)} />
        <Metrica
          etiqueta="Quórum alcanzado"
          valor={resultado.quorumAlcanzado ? 'Sí' : 'No'}
          destacado={resultado.quorumAlcanzado}
        />
      </div>

      <div className="rounded-tarjeta border border-linea bg-panel p-5">
        <h3 className="text-[14px] font-bold text-titular">Voto vinculante (decide)</h3>
        <BarraResultado recuento={resultado.recuentoVinculante} />
        {resultado.proporcionFavorVinculante !== null && (
          <p className="mt-2 text-[13px] text-cuerpo">
            {(resultado.proporcionFavorVinculante * 100).toFixed(1)}% a favor entre decisivos
            (umbral exigido: {(vote.threshold * 100).toFixed(0)}%) —{' '}
            <strong>{resultado.umbralSuperado ? 'umbral superado' : 'umbral no superado'}</strong>
          </p>
        )}
      </div>

      <div className="rounded-tarjeta border border-linea bg-fondo p-5">
        <h3 className="text-[14px] font-bold text-titular">Voto consultivo (registered, orienta)</h3>
        <BarraResultado recuento={resultado.recuentoConsultivo} />
      </div>

      <div>
        <h3 className="text-[14px] font-bold text-titular">
          Detalle nominal de cada voto
        </h3>
        <p className="mt-1 text-[12.5px] text-gris">
          Voto público (D-001): quién votó qué es visible, sin seudonimizar.
        </p>
        <div className="mt-3 overflow-x-auto rounded-tarjeta border border-linea">
          <table className="w-full min-w-[420px] text-left text-[13.5px]">
            <thead className="bg-fondo text-[12px] uppercase tracking-[.04em] text-gris">
              <tr>
                <th className="px-4 py-2.5 font-bold">Persona</th>
                <th className="px-4 py-2.5 font-bold">Voto</th>
                <th className="px-4 py-2.5 font-bold">Peso</th>
                <th className="px-4 py-2.5 font-bold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {ballots.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gris">
                    Todavía no se ha emitido ningún voto.
                  </td>
                </tr>
              )}
              {ballots.map((b) => (
                <tr key={b.user_id} className="border-t border-linea">
                  <td className="px-4 py-2.5 font-semibold text-titular">
                    {b.display_name ?? 'Sin nombre público'}
                  </td>
                  <td className="px-4 py-2.5">{ETIQUETA_ELECCION[b.choice]}</td>
                  <td className="px-4 py-2.5">{b.weight === 1 ? 'Vinculante' : 'Consultivo'}</td>
                  <td className="px-4 py-2.5 text-gris">
                    {new Date(b.cast_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metrica({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="rounded-boton border border-linea bg-white p-4 text-center">
      <p className="text-[11.5px] font-bold uppercase tracking-[.05em] text-gris">{etiqueta}</p>
      <p className={`mt-1 text-[22px] font-extrabold ${destacado ? 'text-cat-agricultura' : 'text-titular'}`}>
        {valor}
      </p>
    </div>
  );
}

function BarraResultado({ recuento }: { recuento: Record<'favor' | 'contra' | 'abstencion', number> }) {
  const total = recuento.favor + recuento.contra + recuento.abstencion;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div className="mt-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-fondo">
        <div className="bg-cat-agricultura" style={{ width: `${pct(recuento.favor)}%` }} />
        <div className="bg-gris/40" style={{ width: `${pct(recuento.abstencion)}%` }} />
        <div className="bg-cat-sanidad" style={{ width: `${pct(recuento.contra)}%` }} />
      </div>
      <p className="mt-1.5 text-[12.5px] text-gris">
        {recuento.favor} a favor · {recuento.abstencion} abstención · {recuento.contra} en contra ({total} votos)
      </p>
    </div>
  );
}
