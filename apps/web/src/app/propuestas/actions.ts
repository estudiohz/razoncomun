'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  alternarApoyo,
  buscarPropuestasSimilares,
  crearPropuesta,
  usuarioApoya,
} from '@/lib/participacion/proposals';
import { anadirAfirmacion, votarAfirmacion } from '@/lib/participacion/statements';
import type { ValorVotoAfirmacion } from '@/lib/participacion/types';

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

  if (!title || !body || !department) {
    throw new Error('Faltan campos obligatorios (título, texto y departamento).');
  }

  const estimated_cost_cents = costeRaw ? Math.round(Number(costeRaw) * 100) : null;

  const propuesta = await crearPropuesta(supabase, user.id, {
    title,
    body,
    department,
    estimated_cost_cents,
  });

  revalidatePath('/propuestas');
  redirect(`/propuestas/${propuesta.id}`);
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
