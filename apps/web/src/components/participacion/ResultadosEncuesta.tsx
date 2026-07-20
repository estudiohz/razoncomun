import type { SurveyQuestion } from '@/lib/participacion/types';
import type { TalliesPregunta } from '@/lib/participacion/surveys';

export function ResultadosEncuesta({
  preguntas,
  tallies,
}: {
  preguntas: SurveyQuestion[];
  tallies: TalliesPregunta[];
}) {
  return (
    <div className="space-y-5">
      {preguntas.map((p) => {
        const t = tallies.find((x) => x.question_id === p.id);
        if (!t) return null;
        return (
          <div key={p.id} className="rounded-tarjeta border border-linea bg-panel p-5">
            <p className="text-[14px] font-bold text-titular">{p.text}</p>
            <p className="mt-1 text-[12px] text-gris">{t.total} respuestas</p>
            {p.kind === 'text' ? (
              <p className="mt-2 text-[13px] text-gris">Las respuestas de texto libre no se agregan (privacidad).</p>
            ) : (
              <div className="mt-3 space-y-2">
                {Object.entries(t.conteos).map(([opcion, n]) => {
                  const pct = t.total > 0 ? Math.round((n / t.total) * 100) : 0;
                  return (
                    <div key={opcion}>
                      <div className="flex justify-between text-[12.5px] text-cuerpo">
                        <span>{opcion}</span>
                        <span>
                          {n} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-fondo">
                        <div className="h-full bg-accion" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
