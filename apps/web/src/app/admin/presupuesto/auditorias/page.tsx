import type { Metadata } from 'next';
import { requireAuditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { PestanasPresupuesto } from '../PestanasPresupuesto';
import { AuditoriasClient, type EnvioAuditoria } from './AuditoriasClient';
import { altaManual } from './casos';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Admin — Auditorías',
  descripcion: 'Bandeja de reels y enlaces enviados al bot de Telegram para auditar.',
  ruta: '/admin/presupuesto/auditorias',
  noindex: true,
});

export const dynamic = 'force-dynamic';

/**
 * Bandeja de la auditoría en tiempo real (docs/auditoria-tiempo-real, D-A17):
 * lo que el equipo manda al bot de Telegram pulsando "🔍 Es una auditoría".
 * De momento solo se lista y se clasifica a mano; el análisis con IA y el
 * contraste con fuentes oficiales llegan en las fases F1–F3.
 */
export default async function AdminAuditoriasPage() {
  const { supabase, esAdmin, esEditor } = await requireAuditor('/admin/presupuesto/auditorias');
  const [{ data, error }, { data: casos }] = await Promise.all([
    supabase
      .from('watchdog_sources')
      .select('id, telegram_from, message_text, permalink, video_file_id, status, notes, received_at')
      .order('received_at', { ascending: false })
      .limit(500),
    supabase.from('watchdog_alerts').select('id, source_id, status').not('source_id', 'is', null),
  ]);
  const casoDe = new Map((casos ?? []).map((c) => [c.source_id as string, { id: c.id, status: c.status }]));

  return (
    <div className="space-y-6">
      <PestanasPresupuesto activa="auditorias" verPresupuesto={esAdmin || esEditor} />
      <div>
        <h1 className="text-[24px] font-extrabold text-titular">Auditorías</h1>
        <p className="mt-1 max-w-[60ch] text-[13.5px] text-cuerpo">
          Lo que llega desde el bot de Telegram al pulsar <strong>🔍 Es una auditoría</strong>. Abre un caso para
          contrastarlo con la fuente oficial y firmarlo. Nada de esto es público.
        </p>
      </div>
      <details className="rounded-tarjeta border border-linea bg-white p-4">
        <summary className="cursor-pointer text-[13.5px] font-bold text-titular">+ Añadir un enlace a mano</summary>
        <form action={altaManual} className="mt-3 space-y-3">
          <input
            name="permalink"
            type="url"
            required
            placeholder="https://www.instagram.com/reel/…"
            className="w-full rounded-boton border border-linea px-3 py-2.5 text-[14px]"
          />
          <textarea
            name="nota"
            rows={2}
            placeholder="Nota opcional: de dónde sale, qué dice…"
            className="w-full rounded-boton border border-linea px-3 py-2.5 text-[14px]"
          />
          <button type="submit" className="rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white">
            Abrir caso
          </button>
        </form>
      </details>
      {error ? (
        <p className="rounded-boton border border-magenta/40 bg-magenta/5 p-4 text-[13.5px] text-magenta">
          No se pudo cargar la bandeja: {error.message}
        </p>
      ) : (
        <AuditoriasClient
          envios={((data ?? []) as Omit<EnvioAuditoria, 'caso'>[]).map((e) => ({ ...e, caso: casoDe.get(e.id) ?? null }))}
        />
      )}
    </div>
  );
}
