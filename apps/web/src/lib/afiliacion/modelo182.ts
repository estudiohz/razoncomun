import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { calcularCuotasDelAnio } from './certificado';

/**
 * Export para la gestoría del Modelo 182 (declaración anual informativa de
 * donativos/cuotas deducibles, AEAT) — docs/tecnico/afiliados-y-transparencia.md
 * punto 4, vision-plataforma.md Pilar 2.1.
 *
 * ⚠️ IMPORTANTE (declarado, no ocultado): esto es un CSV de trabajo con los
 * campos que la gestoría necesita para preparar la presentación, NO el
 * fichero de registro de ancho fijo que exige el diseño oficial de la AEAT
 * (que no está verificado en esta sesión — "citado de conocimiento general,
 * pendiente de asesoría" según la propia documentación del proyecto). Antes
 * de presentar nada, un profesional debe: (1) confirmar el diseño de
 * registro vigente del ejercicio correspondiente, (2) rellenar el NIF de
 * cada afiliado (no se recoge en el alta actual — hueco de esquema
 * declarado en certificado.ts), (3) confirmar el CIF/domicilio fiscal reales
 * del partido (placeholders en certificado.ts).
 */
export type FilaModelo182 = {
  userId: string;
  nombre: string;
  email: string;
  nif: string; // siempre vacío por ahora — ver nota arriba
  totalAnualCents: number;
  numeroCuotas: number;
};

export async function filasModelo182(admin: SupabaseClient, stripe: Stripe, year: number): Promise<FilaModelo182[]> {
  const { data: miembros } = await admin
    .from('members')
    .select('user_id, stripe_customer_id, profiles(display_name, email)')
    .not('stripe_customer_id', 'is', null);

  const filas: FilaModelo182[] = [];

  for (const m of miembros ?? []) {
    if (!m.stripe_customer_id) continue;
    const { totalCents, numeroCuotas } = await calcularCuotasDelAnio(stripe, m.stripe_customer_id, year);
    if (numeroCuotas === 0) continue;

    const perfil = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    filas.push({
      userId: m.user_id,
      nombre: perfil?.display_name ?? '(sin nombre)',
      email: perfil?.email ?? '',
      nif: '',
      totalAnualCents: totalCents,
      numeroCuotas,
    });
  }

  return filas;
}

export function csvModelo182(filas: FilaModelo182[], year: number): string {
  const lineas: string[] = [];
  lineas.push(`# Razón Común — datos de trabajo para el Modelo 182, ejercicio ${year}`);
  lineas.push('# ATENCION: verificar diseño de registro oficial AEAT con la gestoria antes de presentar. NIF pendiente de recoger.');
  lineas.push('nif_afiliado,nombre_completo,email,num_cuotas_pagadas,importe_total_cents,importe_total_eur,ejercicio');
  for (const f of filas) {
    const nombre = `"${f.nombre.replace(/"/g, '""')}"`;
    lineas.push(
      `${f.nif},${nombre},${f.email},${f.numeroCuotas},${f.totalAnualCents},${(f.totalAnualCents / 100).toFixed(2)},${year}`,
    );
  }
  return '﻿' + lineas.join('\n');
}
