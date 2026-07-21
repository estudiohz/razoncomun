'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { resolverContribucion, reclasificarContribucion } from '@/lib/brain/wikiAdmin';
import { cn } from '@/lib/cn';

export interface TriajeIA {
  categoria: string;
  severidad: string;
  accionable: boolean;
  resumen: string;
  accion_sugerida: string;
  confianza: number;
}

export interface FilaContribucion {
  id: string;
  creado: string;
  body: string;
  claimedWrong: string | null;
  claimedRight: string | null;
  sourceUrl: string | null;
  status: 'nueva' | 'triaged' | 'aceptada' | 'rechazada' | 'fusionada';
  triage: TriajeIA | null;
  pregunta: string | null;
  autor: string | null;
  relatedEntryId: string | null;
  entradaTitulo: string | null;
  resolutionNote: string | null;
}

interface Props {
  filas: FilaContribucion[];
  estado: string;
  conteos: Record<'nueva' | 'triaged' | 'aceptada' | 'rechazada' | 'fusionada', number>;
}

const TABS: { key: string; label: string }[] = [
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'nueva', label: 'Nuevas' },
  { key: 'triaged', label: 'Triadas' },
  { key: 'aceptada', label: 'Aceptadas' },
  { key: 'rechazada', label: 'Rechazadas' },
  { key: 'fusionada', label: 'Fusionadas' },
];

const CAT_LABEL: Record<string, string> = {
  'correccion-factual': 'Corrección',
  'dato-nuevo': 'Dato nuevo',
  matiz: 'Matiz',
  duplicado: 'Duplicado',
  'fuera-de-tema': 'Fuera de tema',
  spam: 'Spam',
  ataque: 'Ataque',
};

function CategoriaChip({ cat }: { cat: string }) {
  const estilo =
    cat === 'correccion-factual'
      ? 'bg-naranja/15 text-naranja'
      : cat === 'dato-nuevo'
        ? 'bg-accion/10 text-accion'
        : cat === 'ataque' || cat === 'spam'
          ? 'bg-magenta/15 text-magenta'
          : 'bg-gris/15 text-gris';
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', estilo)}>
      {CAT_LABEL[cat] ?? cat}
    </span>
  );
}

function SeveridadChip({ sev }: { sev: string }) {
  const estilo =
    sev === 'alta' ? 'bg-magenta/15 text-magenta' : sev === 'media' ? 'bg-naranja/15 text-naranja' : 'bg-gris/15 text-gris';
  return <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', estilo)}>Sev. {sev}</span>;
}

function EstadoChip({ status }: { status: FilaContribucion['status'] }) {
  const map: Record<FilaContribucion['status'], string> = {
    nueva: 'bg-cian/15 text-teal',
    triaged: 'bg-morado/12 text-morado',
    aceptada: 'bg-accion/10 text-accion',
    rechazada: 'bg-gris/15 text-gris',
    fusionada: 'bg-gris/15 text-gris',
  };
  return <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', map[status])}>{status}</span>;
}

function Tarjeta({ f }: { f: FilaContribucion }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resuelta = f.status === 'aceptada' || f.status === 'rechazada' || f.status === 'fusionada';

  const resolver = (accion: 'aceptada' | 'rechazada' | 'fusionada') => {
    setError(null);
    iniciar(async () => {
      const r = await resolverContribucion(f.id, accion, nota);
      if (!r.ok) setError(r.error ?? 'No se ha podido guardar.');
      else router.refresh();
    });
  };
  const reclasificar = () => {
    setError(null);
    iniciar(async () => {
      const r = await reclasificarContribucion(f.id);
      if (!r.ok) setError(r.error ?? 'No se ha podido reclasificar.');
      else router.refresh();
    });
  };

  return (
    <article className="rounded-tarjeta border border-linea bg-white p-5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {f.triage ? (
          <>
            <CategoriaChip cat={f.triage.categoria} />
            <SeveridadChip sev={f.triage.severidad} />
            {f.triage.accionable && (
              <span className="rounded-full bg-accion/10 px-2.5 py-0.5 text-[11.5px] font-bold text-accion">
                Accionable
              </span>
            )}
          </>
        ) : (
          <span className="rounded-full bg-gris/15 px-2.5 py-0.5 text-[11.5px] font-bold text-gris">
            Sin triar
          </span>
        )}
        <EstadoChip status={f.status} />
        <span className="ml-auto text-[12.5px] text-gris">
          {[f.autor, f.creado].filter(Boolean).join(' · ')}
        </span>
      </div>

      {f.triage?.resumen && (
        <p className="mb-1 text-[14.5px] font-semibold text-titular">{f.triage.resumen}</p>
      )}
      {f.triage?.accion_sugerida && (
        <p className="mb-2 text-[13px] text-cuerpo">
          <span className="font-semibold text-gris">Acción sugerida:</span> {f.triage.accion_sugerida}
        </p>
      )}

      <div className="mb-3 rounded-boton border border-linea bg-fondo p-3">
        <p className="whitespace-pre-wrap text-[14px] text-cuerpo">{f.body}</p>
        {(f.claimedWrong || f.claimedRight) && (
          <p className="mt-2 text-[13px] text-cuerpo">
            {f.claimedWrong && (
              <span>
                <span className="font-semibold text-magenta">Dato erróneo:</span> {f.claimedWrong}{' '}
              </span>
            )}
            {f.claimedRight && (
              <span>
                <span className="font-semibold text-accion">→ Correcto:</span> {f.claimedRight}
              </span>
            )}
          </p>
        )}
        {f.sourceUrl && (
          <p className="mt-2 text-[13px]">
            <span className="font-semibold text-gris">Fuente:</span>{' '}
            {/^https?:\/\//i.test(f.sourceUrl) ? (
              <a
                href={f.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-titular underline break-all"
              >
                {f.sourceUrl}
              </a>
            ) : (
              <span className="break-all text-cuerpo">{f.sourceUrl}</span>
            )}
          </p>
        )}
      </div>

      {f.pregunta && (
        <p className="mb-3 text-[12.5px] text-gris">
          <span className="font-semibold">Pregunta del chat:</span> «{f.pregunta}»
        </p>
      )}

      {f.entradaTitulo && f.relatedEntryId && (
        <p className="mb-3 text-[13px]">
          <span className="text-gris">Entrada relacionada: </span>
          <Link href={`/admin/cerebro/${f.relatedEntryId}`} className="font-semibold text-titular underline">
            {f.entradaTitulo}
          </Link>
        </p>
      )}

      {f.resolutionNote && (
        <p className="mb-3 text-[13px] text-cuerpo">
          <span className="font-semibold text-gris">Nota de revisión:</span> {f.resolutionNote}
        </p>
      )}

      {error && <p className="mb-2 text-[13px] font-semibold text-magenta">{error}</p>}

      {!resuelta && (
        <div className="flex flex-col gap-2">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota de revisión (opcional)"
            className="w-full rounded-boton border border-linea bg-white px-3 py-2 text-[13.5px] text-cuerpo placeholder:text-gris focus:border-titular focus:outline-none"
            maxLength={1000}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => resolver('aceptada')}
              disabled={pendiente}
              className="rounded-boton bg-accion px-4 py-2 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              Aceptar
            </button>
            <button
              type="button"
              onClick={() => resolver('rechazada')}
              disabled={pendiente}
              className="rounded-boton border border-red-300 px-4 py-2 text-[13px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => resolver('fusionada')}
              disabled={pendiente}
              className="rounded-boton border border-linea px-4 py-2 text-[13px] font-semibold text-gris hover:border-titular hover:text-titular disabled:opacity-50"
            >
              Fusionar
            </button>
            {(f.status === 'nueva' || !f.triage) && (
              <button
                type="button"
                onClick={reclasificar}
                disabled={pendiente}
                className="ml-auto text-[12.5px] font-semibold text-gris underline decoration-dotted underline-offset-2 hover:text-titular disabled:opacity-50"
              >
                {pendiente ? 'Procesando…' : 'Reclasificar con IA'}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function ContribucionesClient({ filas, estado, conteos }: Props) {
  const router = useRouter();
  const pendientesTotal = conteos.nueva + conteos.triaged;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const activo = estado === t.key;
          const n =
            t.key === 'pendientes'
              ? pendientesTotal
              : conteos[t.key as keyof typeof conteos] ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() =>
                router.push(t.key === 'pendientes' ? '/admin/cerebro/contribuciones' : `/admin/cerebro/contribuciones?estado=${t.key}`)
              }
              className={cn(
                'rounded-full border px-4 py-1.5 text-[13px] font-bold',
                activo ? 'border-accion bg-accion text-white' : 'border-linea bg-white text-titular hover:border-titular',
              )}
            >
              {t.label} <span className={activo ? 'text-white/80' : 'text-gris'}>· {n}</span>
            </button>
          );
        })}
      </div>

      {filas.length === 0 ? (
        <p className="rounded-tarjeta border border-linea bg-white p-6 text-cuerpo">
          {estado === 'pendientes'
            ? 'No hay contribuciones pendientes de revisión. 🎉'
            : 'No hay contribuciones en este estado.'}
        </p>
      ) : (
        <div className="space-y-4">
          {filas.map((f) => (
            <Tarjeta key={f.id} f={f} />
          ))}
        </div>
      )}
    </div>
  );
}
