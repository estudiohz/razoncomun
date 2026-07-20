import { Tarjeta } from '@/components/ui/Tarjeta';

export const NOMBRE_CARGO: Record<string, string> = {
  president: 'Presidente',
  treasurer: 'Tesorero',
  vocal: 'Vocal',
  council_member: 'Consejero',
  coordinator: 'Coordinador',
  moderator: 'Moderador',
};

export type CargoOrganigrama = {
  id: string;
  role: string;
  scope: 'national' | 'community';
  territory_id: number | null;
  started_at: string;
  display_name: string | null;
};

/**
 * Organigrama vigente, puramente de presentación (sin acciones): lo usa
 * tanto `/admin/organizacion` (con los formularios de gestión alrededor) como
 * la página pública `/transparencia/organigrama` (positions es lectura
 * pública por diseño — modelo-datos.md).
 */
export function Organigrama({
  cargos,
  territorioPorId,
}: {
  cargos: CargoOrganigrama[];
  territorioPorId: Map<number, string>;
}) {
  const nacionales = cargos.filter((c) => c.scope === 'national');
  const porComunidad = new Map<number, CargoOrganigrama[]>();
  for (const c of cargos.filter((c) => c.scope === 'community')) {
    if (c.territory_id == null) continue;
    const lista = porComunidad.get(c.territory_id) ?? [];
    lista.push(c);
    porComunidad.set(c.territory_id, lista);
  }

  return (
    <div className="space-y-6">
      <Tarjeta className="p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Nacional</h2>
        {nacionales.length > 0 ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {nacionales.map((c) => (
              <li key={c.id} className="rounded-boton bg-fondo px-3 py-2 text-[13.5px]">
                <span className="font-bold">{NOMBRE_CARGO[c.role] ?? c.role}</span>
                <span className="text-gris"> · {c.display_name ?? 'Sin nombre'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-gris">Sin cargos nacionales asignados.</p>
        )}
      </Tarjeta>

      <Tarjeta className="p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-titular">Comunidades</h2>
        {porComunidad.size > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(porComunidad.entries()).map(([territorioId, lista]) => (
              <div key={territorioId} className="rounded-boton border border-linea p-3">
                <p className="text-[13px] font-bold">{territorioPorId.get(territorioId) ?? 'Comunidad'}</p>
                <ul className="mt-1.5 space-y-1">
                  {lista.map((c) => (
                    <li key={c.id} className="text-[12.5px] text-cuerpo">
                      {NOMBRE_CARGO[c.role] ?? c.role}: {c.display_name ?? 'Sin nombre'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-gris">Sin cargos de comunidad asignados.</p>
        )}
      </Tarjeta>
    </div>
  );
}
