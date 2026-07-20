import { createClient } from '@/lib/supabase/server';
import { Tarjeta } from '@/components/ui/Tarjeta';

const NOMBRE_ESTADO: Record<string, string> = {
  seed: 'Semilla',
  deliberation: 'Deliberación',
  stress_test: 'Test de estrés',
  voting: 'En votación',
  adopted: 'Adoptada',
  discarded: 'Descartada',
};

/**
 * Panel de inicio: métricas clave leídas de las tablas reales (no mock).
 * `proposals`, `votes` y `articles` son propiedad de rc-06/rc-05 — aquí solo
 * se lee (RLS pública o de equipo), nunca se escribe.
 */
export default async function AdminInicioPage() {
  const supabase = await createClient();

  const [{ count: afiliadosActivos }, { data: propuestas }, { data: votaciones }, { data: noticias }] =
    await Promise.all([
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('proposals').select('status'),
      supabase
        .from('votes')
        .select('id, opens_at, closes_at, scope, proposals(title)')
        .gt('closes_at', new Date().toISOString())
        .order('opens_at', { ascending: true })
        .limit(5),
      supabase
        .from('articles')
        .select('id, title, slug, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(5),
    ]);

  const propuestasPorEstado = (propuestas ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <h1 className="text-[24px] font-extrabold">Panel de inicio</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Afiliados activos</p>
          <p className="mt-2 text-[32px] font-extrabold text-titular">{afiliadosActivos ?? 0}</p>
        </Tarjeta>
        {Object.entries(NOMBRE_ESTADO)
          .slice(0, 3)
          .map(([clave, etiqueta]) => (
            <Tarjeta key={clave} className="p-5">
              <p className="text-[12px] font-bold uppercase tracking-wide text-gris">{etiqueta}</p>
              <p className="mt-2 text-[32px] font-extrabold">{propuestasPorEstado[clave] ?? 0}</p>
            </Tarjeta>
          ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tarjeta className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Propuestas por estado</p>
          <ul className="mt-3 space-y-1.5 text-[13.5px]">
            {Object.entries(NOMBRE_ESTADO).map(([clave, etiqueta]) => (
              <li key={clave} className="flex justify-between">
                <span className="text-cuerpo">{etiqueta}</span>
                <span className="font-bold">{propuestasPorEstado[clave] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Próximas votaciones</p>
          {votaciones && votaciones.length > 0 ? (
            <ul className="mt-3 space-y-2 text-[13.5px]">
              {votaciones.map((v) => (
                <li key={v.id} className="border-b border-linea pb-2 last:border-0">
                  <p className="font-semibold">
                    {Array.isArray(v.proposals) ? v.proposals[0]?.title : (v.proposals as { title: string } | null)?.title ?? 'Propuesta'}
                  </p>
                  <p className="text-[12px] text-gris">
                    {v.scope === 'manifesto' ? 'Manifiesto' : 'Departamento'} · abre{' '}
                    {new Date(v.opens_at).toLocaleDateString('es-ES')}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-gris">Ninguna votación programada.</p>
          )}
        </Tarjeta>

        <Tarjeta className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-gris">Últimas noticias</p>
          {noticias && noticias.length > 0 ? (
            <ul className="mt-3 space-y-2 text-[13.5px]">
              {noticias.map((n) => (
                <li key={n.id} className="border-b border-linea pb-2 last:border-0">
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-[12px] text-gris">
                    {n.published_at ? new Date(n.published_at).toLocaleDateString('es-ES') : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-gris">Sin artículos publicados todavía.</p>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
