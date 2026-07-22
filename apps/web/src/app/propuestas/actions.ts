'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  alternarApoyo,
  buscarPropuestasSimilares,
  contarPropuestasRecientes,
  crearPropuesta,
  obtenerPropuesta,
  usuarioApoya,
} from '@/lib/participacion/proposals';
import { anadirAfirmacion, votarAfirmacion } from '@/lib/participacion/statements';
import {
  alternarLike,
  anadirComentario,
  borrarComentario,
  contarComentariosRecientes,
  usuarioDioLike,
} from '@/lib/participacion/comments';
import { alternarSuscripcion, usuarioSigue } from '@/lib/participacion/follows';
import { notificarComentarioNuevo } from '@/lib/participacion/notifications-admin';
import { verificarCaptcha } from '@/lib/antibot/captcha';
import type { ValorVotoAfirmacion } from '@/lib/participacion/types';

const LIMITE_HILOS_DIA = 3;
const LIMITE_COMENTARIOS_HORA = 20;

/** Hook de duplicados (vision-plataforma.md Pilar 3.2). Llamable desde el formulario cliente. */
export async function buscarSimilaresAction(textoConsulta: string) {
  const supabase = await createClient();
  return buscarPropuestasSimilares(supabase, textoConsulta);
}

export async function crearPropuestaAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?next=/propuestas/nueva');

  const title = (formData.get('title') as string)?.trim();
  const body = (formData.get('body') as string)?.trim();
  const department = (formData.get('department') as string)?.trim();
  const costeRaw = (formData.get('estimated_cost_euros') as string)?.trim();
  const captchaToken = (formData.get('captcha_token') as string) ?? '';
  const captchaRespuesta = (formData.get('captcha_respuesta') as string) ?? '';

  if (!title || !body || !department) {
    throw new Error('Faltan campos obligatorios (título, texto y departamento).');
  }

  // D-P8: captcha HMAC — verificación de coste cero, sin tabla ni servicio externo.
  const veredictoCaptcha = verificarCaptcha(captchaToken, captchaRespuesta);
  if (!veredictoCaptcha.ok) {
    throw new Error(veredictoCaptcha.error);
  }

  // D-P8: rate-limit — 3 hilos/día por usuario (defensa contra humanos con mala fe).
  const recientes = await contarPropuestasRecientes(supabase, user.id);
  if (recientes >= LIMITE_HILOS_DIA) {
    throw new Error('Has alcanzado el límite de 3 propuestas nuevas por día. Vuelve mañana.');
  }

  const estimated_cost_cents = costeRaw ? Math.round(Number(costeRaw) * 100) : null;

  const propuesta = await crearPropuesta(supabase, user.id, {
    title,
    body,
    department,
    estimated_cost_cents,
  });

  // D-P9: auto-suscripción del autor.
  await alternarSuscripcion(supabase, propuesta.id, user.id, false);

  revalidatePath('/propuestas');
  redirect(`/propuestas/${propuesta.slug ?? propuesta.id}`);
}

export async function alternarApoyoAction(proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=/propuestas/${proposalId}`);

  const apoyaActualmente = await usuarioApoya(supabase, proposalId, user.id);
  await alternarApoyo(supabase, proposalId, user.id, apoyaActualmente);
  revalidatePath(`/propuestas/${proposalId}`);
  revalidatePath('/propuestas');
}

export async function anadirAfirmacionAction(proposalId: string, texto: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=/propuestas/${proposalId}`);

  const limpio = texto.trim();
  if (!limpio) return;
  await anadirAfirmacion(supabase, proposalId, user.id, limpio);
  revalidatePath(`/propuestas/${proposalId}`);
}

export async function votarAfirmacionAction(
  proposalId: string,
  statementId: string,
  valor: ValorVotoAfirmacion,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=/propuestas/${proposalId}`);

  await votarAfirmacion(supabase, user.id, statementId, valor);
  revalidatePath(`/propuestas/${proposalId}`);
}

// ── Comentarios (D-P4) ──────────────────────────────────────────────────────

export async function anadirComentarioAction(
  proposalId: string,
  texto: string,
  parentId: string | null = null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=/propuestas/${proposalId}`);

  const limpio = texto.trim();
  if (!limpio) return;

  // D-P8: rate-limit — 20 comentarios/hora por usuario.
  const recientes = await contarComentariosRecientes(supabase, user.id);
  if (recientes >= LIMITE_COMENTARIOS_HORA) {
    throw new Error('Has alcanzado el límite de 20 comentarios por hora. Espera un poco.');
  }

  await anadirComentario(supabase, proposalId, user.id, limpio, parentId);

  // D-P9: auto-suscripción de quien comenta (idempotente por PK compuesto).
  await alternarSuscripcion(supabase, proposalId, user.id, false);

  // D-P9 evento 1 (rc-06): notifica a los seguidores del hilo, excepto a quien comenta.
  const propuesta = await obtenerPropuesta(supabase, proposalId);
  if (propuesta) {
    await notificarComentarioNuevo(supabase, proposalId, propuesta.title, user.id, propuesta.slug);
  }

  revalidatePath(`/propuestas/${proposalId}`);
}

export async function borrarComentarioAction(commentId: string, proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=/propuestas/${proposalId}`);

  // RLS exige author_id=auth.uid() o admin; si no cumple, el delete/update no afecta filas.
  await borrarComentario(supabase, commentId);
  revalidatePath(`/propuestas/${proposalId}`);
}

export async function alternarLikeAction(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  const yaLeDioLike = await usuarioDioLike(supabase, commentId, user.id);
  await alternarLike(supabase, commentId, user.id, yaLeDioLike);
}

// ── Suscripción (D-P9) ──────────────────────────────────────────────────────

export async function alternarSuscripcionAction(proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?next=/propuestas/${proposalId}`);

  const siguiendoActualmente = await usuarioSigue(supabase, proposalId, user.id);
  await alternarSuscripcion(supabase, proposalId, user.id, siguiendoActualmente);

  const propuesta = await obtenerPropuesta(supabase, proposalId);
  revalidatePath(`/propuestas/${propuesta?.slug ?? proposalId}`);
}
