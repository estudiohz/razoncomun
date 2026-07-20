import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { metadatosPagina } from '@/lib/seo';
import { Organigrama, type CargoOrganigrama } from '@/components/organigrama/Organigrama';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Organigrama',
  descripcion:
    'Cargos orgánicos vigentes de Razón Común, nacional y por comunidad autónoma. El organigrama es transparente por diseño: cualquiera puede consultarlo, con o sin cuenta.',
  ruta: '/transparencia/organigrama',
});

/**
 * Página PÚBLICA (sin guard: `positions` y `territories` son de lectura
 * pública por diseño, modelo-datos.md — "el organigrama es transparente").
 * Reutiliza el mismo componente de presentación que `/admin/organizacion`,
 * sin ninguno de los formularios de gestión.
 */
export default async function OrganigramaPublicoPage() {
  const supabase = await createClient();

  const [{ data: comunidades }, { data: cargosRaw }] = await Promise.all([
    supabase.from('territories').select('id, name').eq('type', 'community').order('name'),
    supabase
      .from('positions')
      .select('id, role, scope, territory_id, started_at, profiles(display_name)')
      .is('ended_at', null)
      .order('started_at', { ascending: false }),
  ]);

  const territorioPorId = new Map((comunidades ?? []).map((t) => [t.id, t.name]));

  const cargos: CargoOrganigrama[] = (cargosRaw ?? []).map((c) => {
    const perfil = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      role: c.role,
      scope: c.scope as 'national' | 'community',
      territory_id: c.territory_id,
      started_at: c.started_at,
      display_name: perfil?.display_name ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-wrap space-y-6 px-8 py-12">
      <div>
        <h1 className="text-[28px] font-extrabold text-titular">Organigrama</h1>
        <p className="mt-2 text-[14px] text-gris">
          Cargos orgánicos vigentes. Razón Común publica quién ocupa cada cargo, a qué nivel
          (nacional o de comunidad) y desde cuándo — sin cajas negras.
        </p>
      </div>
      <Organigrama cargos={cargos} territorioPorId={territorioPorId} />
    </div>
  );
}
