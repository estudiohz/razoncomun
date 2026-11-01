'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { DEPARTAMENTOS, etiquetaDepartamento } from '@/lib/participacion/departments';
import {
  ESTADOS_SOLICITUD,
  ETIQUETA_SOLICITUD,
  PORTAL_TRANSPARENCIA,
  diasHasta,
  estadoEfectivo,
  plazoReclamar,
  plazoResolver,
  type EstadoSolicitud,
} from '@/lib/vigia/transparencia';
import {
  crearPropuestaDesdeCaso,
  desvincularPartida,
  guardarSolicitud,
  prepararSolicitud,
  vincularPartida,
} from '../casos';

export interface PropuestaEnlazada {
  id: string;
  title: string;
  slug: string | null;
  status: string;
}

export interface PartidaOpcion {
  id: string;
  etiqueta: string;
  publicado: boolean;
}

export interface PartidaEnlazada {
  partida_id: string;
  nota: string | null;
  etiqueta: string;
  slug: string | null;
  publicado: boolean;
}

export interface Solicitud {
  id: string;
  organismo: string;
  asunto: string;
  texto: string;
  estado: EstadoSolicitud;
  presentada_at: string | null;
  numero_registro: string | null;
  ampliada_at: string | null;
  respuesta_at: string | null;
  respuesta_texto: string | null;
  respuesta_url: string | null;
  reclamacion_at: string | null;
  reclamacion_numero: string | null;
  notas: string | null;
}

const etiqueta = 'mb-1 block text-[12px] font-bold text-gris';
const control = 'w-full rounded-boton border border-linea bg-white px-3 py-2.5 text-[14px]';
const tarjeta = 'rounded-tarjeta border border-linea bg-white p-5';
const botonPrincipal = 'rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50';
const botonSecundario =
  'rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular hover:border-titular disabled:opacity-50';

const fecha = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });

type Lanzar = (accion: () => Promise<{ ok: true } | { error: string }>, exito: string) => void;

export function EnlacesCaso({
  alertId,
  tituloCaso,
  hechosTexto,
  propuestas,
  partidas,
  partidasEnlazadas,
  solicitudes,
  hoy,
}: {
  alertId: string;
  tituloCaso: string;
  hechosTexto: string;
  propuestas: PropuestaEnlazada[];
  partidas: PartidaOpcion[];
  partidasEnlazadas: PartidaEnlazada[];
  solicitudes: Solicitud[];
  hoy: string;
}) {
  const [pendiente, start] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const lanzar: Lanzar = (accion, exito) => {
    setAviso(null);
    start(async () => {
      const r = await accion();
      setAviso('error' in r ? { tipo: 'error', texto: r.error } : { tipo: 'ok', texto: exito });
    });
  };

  return (
    <div className="space-y-6">
      {aviso && (
        <p
          role="status"
          className={cn(
            'rounded-boton border p-3 text-[13.5px]',
            aviso.tipo === 'ok' ? 'border-teal-texto/40 bg-teal-texto/5 text-teal-texto' : 'border-magenta/40 bg-magenta/5 text-magenta',
          )}
        >
          {aviso.texto}
        </p>
      )}
      <Simulador
        alertId={alertId}
        partidas={partidas}
        enlazadas={partidasEnlazadas}
        pendiente={pendiente}
        lanzar={lanzar}
      />
      <Propuesta
        alertId={alertId}
        tituloCaso={tituloCaso}
        hechosTexto={hechosTexto}
        propuestas={propuestas}
        pendiente={pendiente}
        lanzar={lanzar}
      />
      <Transparencia alertId={alertId} solicitudes={solicitudes} hoy={hoy} pendiente={pendiente} lanzar={lanzar} />
    </div>
  );
}

function Simulador({
  alertId,
  partidas,
  enlazadas,
  pendiente,
  lanzar,
}: {
  alertId: string;
  partidas: PartidaOpcion[];
  enlazadas: PartidaEnlazada[];
  pendiente: boolean;
  lanzar: Lanzar;
}) {
  const [partidaId, setPartidaId] = useState('');
  const [nota, setNota] = useState('');
  const yaEnlazadas = new Set(enlazadas.map((e) => e.partida_id));

  return (
    <section className={cn(tarjeta, 'space-y-4')}>
      <div>
        <h2 className="text-[15px] font-extrabold text-titular">Simulador del País</h2>
        <p className="mt-1 text-[12.5px] text-gris">
          En qué partida del presupuesto cae este gasto. Cuando el caso se publique, la partida lo enseñará en /pais.
        </p>
      </div>

      {enlazadas.length > 0 && (
        <ul className="space-y-2">
          {enlazadas.map((e) => (
            <li key={e.partida_id} className="flex flex-wrap items-start justify-between gap-2 rounded-boton border border-linea p-3">
              <div className="min-w-0 text-[13px] text-cuerpo">
                <p className="font-bold text-titular">
                  {e.etiqueta}
                  {!e.publicado && <span className="ml-2 text-[11.5px] font-semibold text-naranja">sin publicar</span>}
                </p>
                {e.nota && <p className="mt-1">{e.nota}</p>}
                {e.slug && e.publicado && (
                  <Link href={`/pais/${e.slug}`} className="text-[12.5px] font-semibold">
                    Ver en el simulador →
                  </Link>
                )}
              </div>
              <button
                type="button"
                disabled={pendiente}
                className={botonSecundario}
                onClick={() => lanzar(() => desvincularPartida(alertId, e.partida_id), 'Partida quitada.')}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 min-[720px]:grid-cols-[2fr_2fr_auto] min-[720px]:items-end">
        <div>
          <label className={etiqueta} htmlFor="partida">
            Partida
          </label>
          <select id="partida" value={partidaId} onChange={(e) => setPartidaId(e.target.value)} className={control}>
            <option value="">Elige una partida…</option>
            {partidas
              .filter((p) => !yaEnlazadas.has(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta}
                  {p.publicado ? '' : ' (sin publicar)'}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={etiqueta} htmlFor="nota_partida">
            Nota (opcional)
          </label>
          <input
            id="nota_partida"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="p. ej. sale del programa 143A"
            className={control}
          />
        </div>
        <button
          type="button"
          disabled={pendiente || !partidaId}
          className={botonPrincipal}
          onClick={() =>
            lanzar(async () => {
              const r = await vincularPartida(alertId, partidaId, nota);
              if ('ok' in r) {
                setPartidaId('');
                setNota('');
              }
              return r;
            }, 'Partida enlazada.')
          }
        >
          Enlazar
        </button>
      </div>
      {partidas.length === 0 && (
        <p className="text-[12.5px] text-gris">No hay partidas visibles. Los auditores que no son editores solo ven las publicadas.</p>
      )}
    </section>
  );
}

function Propuesta({
  alertId,
  tituloCaso,
  hechosTexto,
  propuestas,
  pendiente,
  lanzar,
}: {
  alertId: string;
  tituloCaso: string;
  hechosTexto: string;
  propuestas: PropuestaEnlazada[];
  pendiente: boolean;
  lanzar: Lanzar;
}) {
  const [abierta, setAbierta] = useState(false);
  const plantilla = `Lo que hemos encontrado:\n${hechosTexto || '(resume aquí los hechos verificados)'}\n\nLo que proponemos:\n(la regla que evitaría que vuelva a pasar, concreta y medible)\n\nPor qué:\n(qué se ahorra o qué mejora, con datos)`;

  return (
    <section className={cn(tarjeta, 'space-y-4')}>
      <div>
        <h2 className="text-[15px] font-extrabold text-titular">Convertir en propuesta</h2>
        <p className="mt-1 text-[12.5px] text-gris">
          Denunciar lo hace cualquiera; proponer la regla que lo evita es lo nuestro. La propuesta queda enlazada a este
          caso y nace como borrador: un editor la abre a votación desde Propuestas.
        </p>
      </div>

      {propuestas.map((p) => (
        <p key={p.id} className="rounded-boton border border-teal-texto/40 bg-teal-texto/5 p-3 text-[13.5px]">
          Propuesta creada: <strong>{p.title}</strong> ({p.status === 'draft' ? 'borrador' : p.status}) ·{' '}
          <Link href={p.status === 'draft' ? '/admin/participacion' : `/propuestas/${p.slug ?? p.id}`}>
            {p.status === 'draft' ? 'Revisar en Propuestas →' : 'Ver propuesta →'}
          </Link>
        </p>
      ))}

      {propuestas.length === 0 &&
        (abierta ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const datos = new FormData(e.currentTarget);
              lanzar(() => crearPropuestaDesdeCaso(alertId, datos), 'Propuesta creada como borrador.');
            }}
          >
            <div>
              <label className={etiqueta} htmlFor="p_titulo">
                Título de la propuesta
              </label>
              <input id="p_titulo" name="titulo" required maxLength={200} defaultValue={tituloCaso} className={control} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="p_pregunta">
                Pregunta para la votación (opcional)
              </label>
              <input
                id="p_pregunta"
                name="pregunta"
                maxLength={300}
                placeholder="¿Debe exigirse…?"
                className={control}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="p_departamento">
                Departamento
              </label>
              <select id="p_departamento" name="departamento" defaultValue="gasto-publico" className={control}>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d} value={d}>
                    {etiquetaDepartamento(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiqueta} htmlFor="p_cuerpo">
                Texto
              </label>
              <textarea id="p_cuerpo" name="cuerpo" rows={10} defaultValue={plantilla} className={control} />
            </div>
            <button type="submit" disabled={pendiente} className={botonPrincipal}>
              Crear propuesta
            </button>
          </form>
        ) : (
          <button type="button" className={botonSecundario} onClick={() => setAbierta(true)}>
            + Crear propuesta a partir de este caso
          </button>
        ))}
    </section>
  );
}

function Transparencia({
  alertId,
  solicitudes,
  hoy,
  pendiente,
  lanzar,
}: {
  alertId: string;
  solicitudes: Solicitud[];
  hoy: string;
  pendiente: boolean;
  lanzar: Lanzar;
}) {
  return (
    <section className={cn(tarjeta, 'space-y-4')}>
      <div>
        <h2 className="text-[15px] font-extrabold text-titular">Solicitudes de transparencia</h2>
        <p className="mt-1 text-[12.5px] text-gris">
          Pide la documentación completa al organismo (Ley 19/2013). El Portal exige Cl@ve, así que se presenta a mano: copia
          el texto, preséntalo y anota aquí el número de registro. El plazo se sigue solo.
        </p>
      </div>

      {solicitudes.map((s) => (
        <FichaSolicitud key={s.id} alertId={alertId} s={s} hoy={hoy} pendiente={pendiente} lanzar={lanzar} />
      ))}

      <button
        type="button"
        disabled={pendiente}
        className={botonSecundario}
        onClick={() => lanzar(() => prepararSolicitud(alertId), 'Solicitud redactada. Revísala y preséntala.')}
      >
        + Preparar solicitud con los datos del caso
      </button>
    </section>
  );
}

function FichaSolicitud({
  alertId,
  s,
  hoy,
  pendiente,
  lanzar,
}: {
  alertId: string;
  s: Solicitud;
  hoy: string;
  pendiente: boolean;
  lanzar: Lanzar;
}) {
  const [copiado, setCopiado] = useState(false);
  const efectivo = estadoEfectivo(s, hoy);
  const limite = plazoResolver(s);
  const reclamar = plazoReclamar(s, hoy);

  let resumen = 'Sin presentar todavía.';
  if (limite && (efectivo === 'presentada' || efectivo === 'ampliada')) {
    const d = diasHasta(limite, hoy);
    resumen = `Tienen hasta el ${fecha(limite)} para responder (${d === 0 ? 'hoy' : `${d} días`}).`;
  } else if (efectivo === 'silencio' && reclamar) {
    const d = diasHasta(reclamar, hoy);
    resumen =
      d >= 0
        ? `Plazo vencido sin respuesta: silencio administrativo. Se puede reclamar al Consejo de Transparencia hasta el ${fecha(reclamar)} (${d} días).`
        : `Plazo vencido sin respuesta. El plazo para reclamar terminó el ${fecha(reclamar)}.`;
  } else if (efectivo === 'denegada' && reclamar) {
    resumen = `Denegada. Se puede reclamar al Consejo de Transparencia hasta el ${fecha(reclamar)}.`;
  }

  const alerta = efectivo === 'silencio' || efectivo === 'denegada';

  return (
    <details className={cn('rounded-boton border p-3', alerta ? 'border-naranja' : 'border-linea')} open={s.estado === 'borrador'}>
      <summary className="cursor-pointer text-[13.5px]">
        <span className="font-bold text-titular">{s.asunto}</span>
        <span
          className={cn(
            'ml-2 rounded-full px-2 py-0.5 text-[11.5px] font-bold',
            alerta ? 'bg-naranja/15 text-naranja' : 'bg-accion/10 text-accion',
          )}
        >
          {ETIQUETA_SOLICITUD[efectivo]}
        </span>
        <span className="mt-1 block text-[12.5px] text-gris">{resumen}</span>
      </summary>

      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          lanzar(() => guardarSolicitud(alertId, s.id, datos), 'Solicitud actualizada.');
        }}
      >
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          <div>
            <label className={etiqueta}>Organismo</label>
            <input name="organismo" defaultValue={s.organismo} className={control} />
          </div>
          <div>
            <label className={etiqueta}>Asunto</label>
            <input name="asunto" defaultValue={s.asunto} className={control} />
          </div>
        </div>
        <div>
          <label className={etiqueta}>Texto de la solicitud</label>
          <textarea name="texto" rows={8} defaultValue={s.texto} className={control} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={botonSecundario}
              onClick={() => {
                navigator.clipboard?.writeText(`${s.asunto}\n\n${s.texto}`).then(
                  () => setCopiado(true),
                  () => setCopiado(false),
                );
              }}
            >
              {copiado ? 'Copiado ✓' : 'Copiar texto'}
            </button>
            <a href={PORTAL_TRANSPARENCIA} target="_blank" rel="noopener noreferrer" className={botonSecundario}>
              Abrir el Portal de Transparencia ↗
            </a>
          </div>
        </div>

        <div className="grid gap-3 min-[720px]:grid-cols-3">
          <div>
            <label className={etiqueta}>Estado</label>
            <select name="estado" defaultValue={s.estado} className={control}>
              {ESTADOS_SOLICITUD.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_SOLICITUD[e]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiqueta}>Presentada el</label>
            <input name="presentada_at" type="date" defaultValue={s.presentada_at ?? ''} className={control} />
          </div>
          <div>
            <label className={etiqueta}>Nº de registro</label>
            <input name="numero_registro" defaultValue={s.numero_registro ?? ''} className={control} />
          </div>
          <div>
            <label className={etiqueta}>Plazo ampliado el</label>
            <input name="ampliada_at" type="date" defaultValue={s.ampliada_at ?? ''} className={control} />
          </div>
          <div>
            <label className={etiqueta}>Respuesta recibida el</label>
            <input name="respuesta_at" type="date" defaultValue={s.respuesta_at ?? ''} className={control} />
          </div>
          <div>
            <label className={etiqueta}>Enlace a la respuesta</label>
            <input name="respuesta_url" type="url" defaultValue={s.respuesta_url ?? ''} className={control} />
          </div>
        </div>
        <div>
          <label className={etiqueta}>Resumen de la respuesta</label>
          <textarea name="respuesta_texto" rows={3} defaultValue={s.respuesta_texto ?? ''} className={control} />
        </div>
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          <div>
            <label className={etiqueta}>Reclamación al CTBG presentada el</label>
            <input name="reclamacion_at" type="date" defaultValue={s.reclamacion_at ?? ''} className={control} />
          </div>
          <div>
            <label className={etiqueta}>Nº de la reclamación</label>
            <input name="reclamacion_numero" defaultValue={s.reclamacion_numero ?? ''} className={control} />
          </div>
        </div>
        <div>
          <label className={etiqueta}>Notas</label>
          <textarea name="notas" rows={2} defaultValue={s.notas ?? ''} className={control} />
        </div>
        <button type="submit" disabled={pendiente} className={botonPrincipal}>
          Guardar seguimiento
        </button>
      </form>
    </details>
  );
}
