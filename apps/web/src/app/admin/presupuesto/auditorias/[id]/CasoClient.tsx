'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import {
  CATEGORIAS,
  CHECKLIST_M5,
  ETIQUETA_ESTADO,
  FUENTES_PRUEBA,
  NIVELES,
  VERIFICACIONES,
  bloqueosAprobar,
  centimosAEuros,
  htmlATexto,
  replicaObligatoria,
  type EstadoCaso,
} from '@/lib/vigia/casos';
import {
  anadirPrueba,
  aprobarCaso,
  borrarPrueba,
  buscarEnFuentes,
  copiarPrueba,
  descartarCaso,
  guardarCaso,
  marcarPrincipal,
  pedirReplica,
  reabrirCaso,
} from '../casos';
import { CONFIANZA_MINIMA, lenguajeDeRiesgo, type CampoConConfianza } from '@/lib/vigia/extraccion';

export interface Caso {
  id: string;
  title: string;
  status: EstadoCaso;
  organismo: string | null;
  organismo_nivel: string | null;
  adjudicatario: string | null;
  adjudicatario_nif: string | null;
  es_persona_fisica: boolean;
  categoria: string | null;
  importe_denunciado_cents: number | null;
  importe_oficial_cents: number | null;
  fecha_adjudicacion: string | null;
  verificacion: string | null;
  hechos_html: string | null;
  valoracion_html: string | null;
  reel_url: string | null;
  reel_autor: string | null;
  reel_autor_url: string | null;
  ai_extraction: (Record<string, unknown> & { _confianzas?: Partial<Record<CampoConConfianza, number>> }) | null;
  ai_model: string | null;
  replica_solicitada_at: string | null;
  replica_texto: string | null;
  dismiss_reason: string | null;
  verified_at: string | null;
  created_at: string;
  revisor: { display_name: string | null; email: string | null } | null;
  fuente: {
    permalink: string | null;
    message_text: string | null;
    telegram_from: string | null;
    received_at: string;
    transcript: string | null;
    notes: string | null;
  } | null;
}

export interface Prueba {
  id: string;
  source_kind: string;
  expediente: string | null;
  organo: string | null;
  adjudicatario: string | null;
  nif: string | null;
  importe_cents: number | null;
  fecha: string | null;
  url: string;
  snapshot_sha256: string | null;
  selected: boolean;
  notes: string | null;
}

const etiqueta = 'mb-1 block text-[12px] font-bold text-gris';
const control = 'w-full rounded-boton border border-linea bg-white px-3 py-2.5 text-[14px] disabled:bg-fondo';
const tarjeta = 'rounded-tarjeta border border-linea bg-white p-5';
const botonPrincipal = 'rounded-boton bg-accion px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50';
const botonSecundario =
  'rounded-boton border border-linea bg-white px-4 py-2.5 text-[13px] font-bold text-titular hover:border-titular disabled:opacity-50';

const NOMBRE_NIVEL: Record<string, string> = { estatal: 'Estatal', autonomico: 'Autonómico', local: 'Local', otro: 'Otro' };
const NOMBRE_CATEGORIA: Record<string, string> = {
  consultoria: 'Consultoría',
  eventos: 'Eventos',
  publicidad: 'Publicidad',
  obras: 'Obras',
  suministros: 'Suministros',
  subvencion: 'Subvención',
  otro: 'Otro',
};
const NOMBRE_VERIFICACION: Record<string, string> = {
  coincide: 'Coincide con la fuente oficial',
  parcial: 'Coincide en parte',
  no_encontrado: 'No se encuentra en fuentes oficiales',
  desmentido: 'La fuente oficial lo desmiente',
};
const NOMBRE_FUENTE: Record<string, string> = {
  placsp: 'PLACSP (contratos)',
  boe: 'BOE',
  bdns: 'BDNS (subvenciones)',
  borme: 'BORME',
  autonomica: 'Boletín autonómico',
  otro: 'Otra',
};

const COLOR_ESTADO: Record<EstadoCaso, string> = {
  flagged: 'bg-accion/10 text-accion',
  analyzed: 'bg-accion/10 text-accion',
  pending_reply: 'bg-naranja/10 text-naranja',
  verified: 'bg-teal-texto/10 text-teal-texto',
  published: 'bg-teal-texto/10 text-teal-texto',
  dismissed: 'bg-gris/15 text-gris',
};

const fechaHora = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' });

/** Marca junto a la etiqueta: el dato lo puso la IA y con cuánta seguridad. */
function MarcaIA({ caso, campo }: { caso: Caso; campo: CampoConConfianza }) {
  const c = caso.ai_extraction?._confianzas?.[campo];
  if (c == null) return null;
  const dudoso = c < CONFIANZA_MINIMA;
  return (
    <span
      title={`Rellenado por la IA con una confianza del ${Math.round(c * 100)} %`}
      className={cn(
        'ml-1.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold',
        dudoso ? 'bg-naranja/15 text-naranja' : 'bg-accion/10 text-accion',
      )}
    >
      {dudoso ? `IA ${Math.round(c * 100)} % · revísalo` : `IA ${Math.round(c * 100)} %`}
    </span>
  );
}

export function CasoClient({ caso, pruebas }: { caso: Caso; pruebas: Prueba[] }) {
  const [pendiente, start] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [motivo, setMotivo] = useState('');

  const cerrado = ['verified', 'published', 'dismissed'].includes(caso.status);
  const hayPrincipal = pruebas.some((p) => p.selected);
  const bloqueos = bloqueosAprobar(caso, hayPrincipal, checklist);

  function lanzar(accion: () => Promise<({ ok: true } | { error: string }) & { resumen?: string }>, exito: string) {
    setAviso(null);
    start(async () => {
      const r = await accion();
      setAviso('error' in r ? { tipo: 'error', texto: r.error } : { tipo: 'ok', texto: r.resumen ?? exito });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={cn('inline-block rounded-full px-2.5 py-1 text-[12px] font-bold', COLOR_ESTADO[caso.status])}>
            {ETIQUETA_ESTADO[caso.status]}
          </span>
          <h1 className="mt-2 break-words text-[22px] font-extrabold text-titular">{caso.title}</h1>
          <p className="mt-1 text-[12.5px] text-gris">
            Abierto el {fechaHora.format(new Date(caso.created_at))}
            {caso.verified_at &&
              ` · Verificado por ${caso.revisor?.display_name ?? caso.revisor?.email ?? '—'} el ${fechaHora.format(new Date(caso.verified_at))}`}
          </p>
        </div>
      </div>

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

      {caso.fuente && (
        <section className={tarjeta}>
          <h2 className="text-[15px] font-extrabold text-titular">Lo que llegó</h2>
          <p className="mt-1 text-[12.5px] text-gris">
            {caso.fuente.telegram_from ? `Enviado por ${caso.fuente.telegram_from} · ` : ''}
            {fechaHora.format(new Date(caso.fuente.received_at))}
          </p>
          {caso.fuente.permalink && (
            <a
              href={caso.fuente.permalink}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 block break-all text-[13.5px] font-semibold"
            >
              {caso.fuente.permalink}
            </a>
          )}
          {caso.fuente.message_text && caso.fuente.message_text !== caso.fuente.permalink && (
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-cuerpo">{caso.fuente.message_text}</p>
          )}
          {caso.fuente.notes && (
            <p className="mt-2 whitespace-pre-wrap break-words rounded-boton bg-gris/10 p-2 text-[13px] text-cuerpo">
              <strong>Notas:</strong> {caso.fuente.notes}
            </p>
          )}
        </section>
      )}

      {caso.ai_extraction && (
        <section className="rounded-tarjeta border border-accion/30 bg-accion/5 p-5 text-[13.5px] text-cuerpo">
          <h2 className="text-[15px] font-extrabold text-titular">Rellenado automáticamente a partir del reel</h2>
          <p className="mt-1">
            {caso.ai_model ? `Modelo: ${caso.ai_model}. ` : ''}Tu trabajo es supervisar: comprueba cada dato contra la
            fuente oficial, corrige lo que esté mal y firma. Los marcados en naranja tienen poca confianza.
          </p>
          {typeof (caso.ai_extraction.expediente as { value?: unknown } | undefined)?.value === 'string' && (
            <p className="mt-2">
              <strong>Expediente que menciona el reel:</strong>{' '}
              {String((caso.ai_extraction.expediente as { value: string }).value)}
            </p>
          )}
          {lenguajeDeRiesgo(caso.ai_extraction).length > 0 && (
            <p className="mt-2 font-semibold text-magenta">
              ⚠ El reel usa lenguaje de riesgo: {lenguajeDeRiesgo(caso.ai_extraction).join(', ')}. No lo repitas en la
              ficha (M5).
            </p>
          )}
        </section>
      )}

      {caso.fuente?.transcript && (
        <details className={tarjeta}>
          <summary className="cursor-pointer text-[15px] font-extrabold text-titular">Transcripción del reel</summary>
          <p className="mt-3 whitespace-pre-wrap break-words text-[13px] text-cuerpo">{caso.fuente.transcript}</p>
        </details>
      )}

      {caso.status === 'dismissed' && caso.dismiss_reason && (
        <p className="rounded-boton border border-linea bg-fondo p-4 text-[13.5px] text-cuerpo">
          <strong>Descartado:</strong> {caso.dismiss_reason}
        </p>
      )}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          lanzar(() => guardarCaso(caso.id, datos), 'Caso guardado.');
        }}
      >
        <fieldset disabled={cerrado || pendiente} className={cn(tarjeta, 'space-y-4')}>
          <legend className="sr-only">Origen</legend>
          <div>
            <h2 className="text-[15px] font-extrabold text-titular">Origen</h2>
            <p className="mt-1 text-[12.5px] text-gris">
              El reel, artículo o web del que nace el caso. Se cita siempre en la ficha pública: es trabajo de otros. Sin enlace y autor no se puede aprobar.
            </p>
          </div>
          <div className="grid gap-4 min-[720px]:grid-cols-[2fr_1fr]">
            <div>
              <label className={etiqueta} htmlFor="reel_url">
                Enlace (reel, artículo o web)
              </label>
              <input
                id="reel_url"
                name="reel_url"
                type="url"
                defaultValue={caso.reel_url ?? ''}
                placeholder="https://…"
                className={control}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="reel_autor">
                Autor o medio
              </label>
              <input
                id="reel_autor"
                name="reel_autor"
                defaultValue={caso.reel_autor ?? ''}
                placeholder="@usuario o nombre del medio"
                className={control}
              />
            </div>
          </div>
          {caso.reel_url && (
            <a href={caso.reel_url} target="_blank" rel="noopener noreferrer nofollow" className="text-[13px] font-semibold">
              Abrir el origen ↗
            </a>
          )}
        </fieldset>

        <fieldset disabled={cerrado || pendiente} className={cn(tarjeta, 'space-y-4')}>
          <legend className="sr-only">Datos del contrato</legend>
          <h2 className="text-[15px] font-extrabold text-titular">Datos del contrato</h2>
          <div>
            <label className={etiqueta} htmlFor="title">
              Título interno
            </label>
            <input id="title" name="title" defaultValue={caso.title} required maxLength={200} className={control} />
          </div>
          <div className="grid gap-4 min-[720px]:grid-cols-[2fr_1fr]">
            <div>
              <label className={etiqueta} htmlFor="organismo">
                Organismo que contrata
              <MarcaIA caso={caso} campo="organismo" />
              </label>
              <input id="organismo" name="organismo" defaultValue={caso.organismo ?? ''} className={control} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="organismo_nivel">
                Nivel
              <MarcaIA caso={caso} campo="organismo_nivel" />
              </label>
              <select id="organismo_nivel" name="organismo_nivel" defaultValue={caso.organismo_nivel ?? ''} className={control}>
                <option value="">—</option>
                {NIVELES.map((n) => (
                  <option key={n} value={n}>
                    {NOMBRE_NIVEL[n]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 min-[720px]:grid-cols-[2fr_1fr]">
            <div>
              <label className={etiqueta} htmlFor="adjudicatario">
                Adjudicatario (empresa o persona)
              <MarcaIA caso={caso} campo="adjudicatario" />
              </label>
              <input id="adjudicatario" name="adjudicatario" defaultValue={caso.adjudicatario ?? ''} className={control} />
            </div>
            <div>
              <label className={etiqueta} htmlFor="adjudicatario_nif">
                NIF
              <MarcaIA caso={caso} campo="nif" />
              </label>
              <input id="adjudicatario_nif" name="adjudicatario_nif" defaultValue={caso.adjudicatario_nif ?? ''} className={control} />
            </div>
          </div>
          <label className="flex items-start gap-2 text-[13.5px] text-cuerpo">
            <input type="checkbox" name="es_persona_fisica" defaultChecked={caso.es_persona_fisica} className="mt-1" />
            El adjudicatario es una persona física (autónomo): la ficha mostrará los datos mínimos.
          </label>
          <div className="grid gap-4 min-[720px]:grid-cols-4">
            <div>
              <label className={etiqueta} htmlFor="categoria">
                Categoría
              <MarcaIA caso={caso} campo="categoria" />
              </label>
              <select id="categoria" name="categoria" defaultValue={caso.categoria ?? ''} className={control}>
                <option value="">—</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {NOMBRE_CATEGORIA[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiqueta} htmlFor="importe_denunciado">
                Importe que dice el reel (€)
              <MarcaIA caso={caso} campo="importe_cents" />
              </label>
              <input
                id="importe_denunciado"
                name="importe_denunciado"
                inputMode="decimal"
                defaultValue={centimosAEuros(caso.importe_denunciado_cents)}
                className={control}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="importe_oficial">
                Importe oficial (€)
              </label>
              <input
                id="importe_oficial"
                name="importe_oficial"
                inputMode="decimal"
                defaultValue={centimosAEuros(caso.importe_oficial_cents)}
                className={control}
              />
            </div>
            <div>
              <label className={etiqueta} htmlFor="fecha_adjudicacion">
                Fecha de adjudicación
              <MarcaIA caso={caso} campo="fecha" />
              </label>
              <input
                id="fecha_adjudicacion"
                name="fecha_adjudicacion"
                type="date"
                defaultValue={caso.fecha_adjudicacion ?? ''}
                className={control}
              />
            </div>
          </div>
          <div>
            <label className={etiqueta} htmlFor="verificacion">
              Resultado del contraste
            </label>
            <select id="verificacion" name="verificacion" defaultValue={caso.verificacion ?? ''} className={control}>
              <option value="">Sin contrastar todavía</option>
              {VERIFICACIONES.map((v) => (
                <option key={v} value={v}>
                  {NOMBRE_VERIFICACION[v]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-gris">
              Solo «coincide» y «coincide en parte» suman en el contador público, y solo una vez publicado.
            </p>
          </div>
        </fieldset>

        <fieldset disabled={cerrado || pendiente} className={cn(tarjeta, 'space-y-4')}>
          <legend className="sr-only">Hechos y valoración</legend>
          <div>
            <label className="mb-1 block text-[15px] font-extrabold text-titular" htmlFor="hechos">
              Hechos verificados
            </label>
            <p className="mb-2 text-[12.5px] text-gris">
              Solo lo que dice la fuente oficial: quién contrata, a quién, cuánto, cuándo y por qué procedimiento. Sin
              adjetivos.{caso.ai_extraction ? ' El borrador es lo que afirma el reel: déjalo solo en lo que confirme la prueba.' : ''}
            </p>
            <textarea id="hechos" name="hechos" rows={6} defaultValue={htmlATexto(caso.hechos_html)} className={control} />
          </div>
          <div>
            <label className="mb-1 block text-[15px] font-extrabold text-titular" htmlFor="valoracion">
              Valoración de Razón Común
            </label>
            <p className="mb-2 text-[12.5px] text-gris">Opinión, separada de los hechos. Sin imputar delitos.</p>
            <textarea
              id="valoracion"
              name="valoracion"
              rows={5}
              defaultValue={htmlATexto(caso.valoracion_html)}
              className={control}
            />
          </div>
          <div>
            <label className="mb-1 block text-[15px] font-extrabold text-titular" htmlFor="replica_texto">
              Réplica recibida
            </label>
            <p className="mb-2 text-[12.5px] text-gris">
              {caso.replica_solicitada_at
                ? `Réplica pedida el ${fechaHora.format(new Date(caso.replica_solicitada_at))}. Pega aquí la respuesta si llega.`
                : 'Todavía no se ha pedido réplica.'}
            </p>
            <textarea
              id="replica_texto"
              name="replica_texto"
              rows={3}
              defaultValue={caso.replica_texto ?? ''}
              className={control}
            />
          </div>
        </fieldset>

        {!cerrado && (
          <button type="submit" disabled={pendiente} className={botonPrincipal}>
            {pendiente ? 'Guardando…' : 'Guardar caso'}
          </button>
        )}
      </form>

      <Pruebas caso={caso} pruebas={pruebas} cerrado={cerrado} pendiente={pendiente} lanzar={lanzar} />

      <section className={cn(tarjeta, 'space-y-4')}>
        <h2 className="text-[15px] font-extrabold text-titular">Decisión</h2>

        {(caso.status === 'flagged' || caso.status === 'analyzed') && (
          <div className="space-y-2">
            <p className="text-[13px] text-cuerpo">
              {replicaObligatoria(caso)
                ? 'Este caso nombra a una empresa o a una persona: antes de aprobar hay que pedirle réplica (D-A13).'
                : 'Solo nombra al organismo: la réplica es recomendable, no obligatoria.'}{' '}
              Envía el correo fuera del panel y márcalo aquí.
            </p>
            <button
              type="button"
              disabled={pendiente}
              className={botonSecundario}
              onClick={() => lanzar(() => pedirReplica(caso.id), 'Réplica anotada como pedida.')}
            >
              Anotar réplica pedida
            </button>
          </div>
        )}

        {!cerrado && (
          <div className="space-y-3 border-t border-linea pt-4">
            <p className="text-[13.5px] font-bold text-titular">Checklist de lenguaje (M5)</p>
            {CHECKLIST_M5.map((c) => (
              <label key={c.id} className="flex items-start gap-2 text-[13.5px] text-cuerpo">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checklist.includes(c.id)}
                  onChange={(e) =>
                    setChecklist((l) => (e.target.checked ? [...l, c.id] : l.filter((x) => x !== c.id)))
                  }
                />
                {c.texto}
              </label>
            ))}
            {bloqueos.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-naranja">
                {bloqueos.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <p className="text-[12px] text-gris">Guarda el caso antes de aprobar: se comprueba lo guardado.</p>
            <button
              type="button"
              disabled={pendiente || bloqueos.length > 0}
              className={botonPrincipal}
              onClick={() => lanzar(() => aprobarCaso(caso.id, checklist), 'Caso verificado con tu firma.')}
            >
              Aprobar y firmar
            </button>
          </div>
        )}

        {caso.status !== 'published' && caso.status !== 'dismissed' && (
          <div className="space-y-2 border-t border-linea pt-4">
            <label className={etiqueta} htmlFor="motivo">
              Descartar el caso
            </label>
            <input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (obligatorio)"
              className={control}
            />
            <button
              type="button"
              disabled={pendiente || !motivo.trim()}
              className={botonSecundario}
              onClick={() => lanzar(() => descartarCaso(caso.id, motivo), 'Caso descartado.')}
            >
              Descartar
            </button>
          </div>
        )}

        {(caso.status === 'verified' || caso.status === 'dismissed') && (
          <div className="space-y-2">
            <p className="text-[13px] text-cuerpo">
              {caso.status === 'verified'
                ? 'Verificado. La publicación llegará con la sección pública (fase F2). Para corregir algo, reábrelo: se quitará la firma.'
                : 'Para retomarlo, reábrelo.'}
            </p>
            <button
              type="button"
              disabled={pendiente}
              className={botonSecundario}
              onClick={() => lanzar(() => reabrirCaso(caso.id), 'Caso reabierto.')}
            >
              Reabrir
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Pruebas({
  caso,
  pruebas,
  cerrado,
  pendiente,
  lanzar,
}: {
  caso: Caso;
  pruebas: Prueba[];
  cerrado: boolean;
  pendiente: boolean;
  lanzar: (accion: () => Promise<({ ok: true } | { error: string }) & { resumen?: string }>, exito: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <section className={cn(tarjeta, 'space-y-4')}>
      <div>
        <h2 className="text-[15px] font-extrabold text-titular">Pruebas oficiales</h2>
        <p className="mt-1 text-[12.5px] text-gris">
          El expediente en la fuente oficial. Una de ellas es la principal: es la que se enseñará en la ficha.
        </p>
      </div>

      {!cerrado && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pendiente}
            className={botonPrincipal}
            onClick={() => lanzar(() => buscarEnFuentes(caso.id), 'Búsqueda hecha.')}
          >
            {pendiente ? 'Buscando…' : '🔎 Buscar en fuentes oficiales'}
          </button>
          <span className="text-[12px] text-gris">
            Consulta la BDNS (subvenciones) y el BOE (contratos) con el NIF, el beneficiario, el importe y el expediente, y guarda copia sellada de lo que encuentre.
          </span>
        </div>
      )}

      {pruebas.length === 0 && <p className="text-[13px] text-cuerpo">Todavía no hay ninguna.</p>}

      <ul className="space-y-3">
        {pruebas.map((p) => (
          <li
            key={p.id}
            className={cn('rounded-boton border p-3', p.selected ? 'border-teal-texto bg-teal-texto/5' : 'border-linea')}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 text-[13px] text-cuerpo">
                <p className="font-bold text-titular">
                  {NOMBRE_FUENTE[p.source_kind] ?? p.source_kind}
                  {p.expediente && ` · Exp. ${p.expediente}`}
                  {p.selected && <span className="ml-2 text-teal-texto">★ Principal</span>}
                </p>
                <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="block break-all">
                  {p.url}
                </a>
                <p className="mt-1 text-gris">
                  {[p.organo, p.adjudicatario, p.nif, p.importe_cents != null && `${centimosAEuros(p.importe_cents)} €`, p.fecha]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {p.notes && <p className="mt-1 whitespace-pre-wrap">{p.notes}</p>}
                <p className="mt-1 text-[12px] text-gris">
                  {p.snapshot_sha256 ? (
                    <>✔ Copia sellada guardada · sha256 {p.snapshot_sha256.slice(0, 12)}…</>
                  ) : (
                    'Sin copia sellada: hace falta una para poder publicar.'
                  )}
                </p>
              </div>
              {!cerrado && (
                <div className="flex gap-2">
                  {!p.snapshot_sha256 && (
                    <button
                      type="button"
                      disabled={pendiente}
                      className={botonSecundario}
                      onClick={() => lanzar(() => copiarPrueba(caso.id, p.id), 'Copia sellada guardada.')}
                    >
                      Guardar copia
                    </button>
                  )}
                  {!p.selected && (
                    <button
                      type="button"
                      disabled={pendiente}
                      className={botonSecundario}
                      onClick={() => lanzar(() => marcarPrincipal(caso.id, p.id), 'Prueba principal marcada.')}
                    >
                      Hacer principal
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pendiente}
                    className={botonSecundario}
                    onClick={() => lanzar(() => borrarPrueba(caso.id, p.id), 'Prueba quitada.')}
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!cerrado &&
        (abierto ? (
          <form
            className="space-y-3 border-t border-linea pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const datos = new FormData(form);
              lanzar(async () => {
                const r = await anadirPrueba(caso.id, datos);
                if ('ok' in r) form.reset();
                return r;
              }, 'Prueba añadida.');
            }}
          >
            <div className="grid gap-3 min-[720px]:grid-cols-[1fr_2fr]">
              <div>
                <label className={etiqueta} htmlFor="source_kind">
                  Fuente
                </label>
                <select id="source_kind" name="source_kind" required defaultValue="placsp" className={control}>
                  {FUENTES_PRUEBA.map((f) => (
                    <option key={f} value={f}>
                      {NOMBRE_FUENTE[f]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiqueta} htmlFor="url">
                  Enlace al documento oficial
                </label>
                <input id="url" name="url" type="url" required placeholder="https://contrataciondelestado.es/…" className={control} />
              </div>
            </div>
            <div className="grid gap-3 min-[720px]:grid-cols-3">
              <div>
                <label className={etiqueta} htmlFor="expediente">
                  Expediente
                </label>
                <input id="expediente" name="expediente" className={control} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="importe">
                  Importe (€)
                </label>
                <input id="importe" name="importe" inputMode="decimal" className={control} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="fecha">
                  Fecha
                </label>
                <input id="fecha" name="fecha" type="date" className={control} />
              </div>
            </div>
            <div className="grid gap-3 min-[720px]:grid-cols-3">
              <div>
                <label className={etiqueta} htmlFor="organo">
                  Órgano
                </label>
                <input id="organo" name="organo" className={control} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="ev_adjudicatario">
                  Adjudicatario
                </label>
                <input id="ev_adjudicatario" name="adjudicatario" className={control} />
              </div>
              <div>
                <label className={etiqueta} htmlFor="nif">
                  NIF
                </label>
                <input id="nif" name="nif" className={control} />
              </div>
            </div>
            <div>
              <label className={etiqueta} htmlFor="notes">
                Notas
              </label>
              <textarea id="notes" name="notes" rows={2} className={control} />
            </div>
            <button type="submit" disabled={pendiente} className={botonPrincipal}>
              Añadir prueba
            </button>
          </form>
        ) : (
          <button type="button" className={botonSecundario} onClick={() => setAbierto(true)}>
            + Añadir prueba
          </button>
        ))}
    </section>
  );
}
