import type { Metadata } from 'next';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { metadatosPagina } from '@/lib/seo';
import { PestanasPresupuesto } from '../PestanasPresupuesto';
import { AuditoriasClient, type EnvioAuditoria } from './AuditoriasClient';

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
  const { supabase } = await requireAdminOrEditor('/admin/presupuesto/auditorias');
  const { data, error } = await supabase
    .from('watchdog_sources')
    .select('id, telegram_from, message_text, permalink, video_file_id, status, notes, received_at')
    .order('received_at', { ascending: false })
    .limit(500);

  return (
    <div className="space-y-6">
      <PestanasPresupuesto activa="auditorias" />
      <div>
        <h1 className="text-[24px] font-extrabold text-titular">Auditorías</h1>
        <p className="mt-1 max-w-[60ch] text-[13.5px] text-cuerpo">
          Lo que llega desde el bot de Telegram al pulsar <strong>🔍 Es una auditoría</strong>. Nada de
          esto es público: aquí se revisa y se decide qué se investiga.
        </p>
      </div>
      {error ? (
        <p className="rounded-boton border border-magenta/40 bg-magenta/5 p-4 text-[13.5px] text-magenta">
          No se pudo cargar la bandeja: {error.message}
        </p>
      ) : (
        <AuditoriasClient envios={(data ?? []) as EnvioAuditoria[]} />
      )}
    </div>
  );
}
