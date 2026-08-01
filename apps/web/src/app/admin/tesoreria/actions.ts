'use server';

import { revalidatePath } from 'next/cache';
import { requireTesoreria } from '@/lib/tesoreria/guard';

export interface ResultadoTesoreria {
  ok: boolean;
  error?: string;
}

/**
 * Alta manual de un movimiento (un gasto en efectivo, una corrección…).
 *
 * OJO: no existe una acción de borrar, y no es un olvido. La migración 0035
 * eliminó la policy de DELETE: el libro es solo-añadir por diseño. Si un
 * movimiento se metió mal, se corrige (queda traza) o se compensa con otro
 * apunte, como en cualquier contabilidad seria.
 */
export async function crearMovimientoAction(fd: FormData): Promise<ResultadoTesoreria> {
  const { supabase } = await requireTesoreria();

  const dated = String(fd.get('dated') ?? '').trim();
  const description = String(fd.get('description') ?? '').trim();
  const euros = String(fd.get('amount') ?? '').trim().replace(',', '.');
  const direction = String(fd.get('direction') ?? '').trim();
  const category = String(fd.get('category') ?? '').trim() || null;

  if (!dated) return { ok: false, error: 'La fecha es obligatoria.' };
  if (!description) return { ok: false, error: 'El concepto es obligatorio.' };
  if (direction !== 'in' && direction !== 'out') return { ok: false, error: 'Indica si es ingreso o gasto.' };

  const importe = Number(euros);
  if (!Number.isFinite(importe) || importe <= 0) {
    return { ok: false, error: 'El importe debe ser un número mayor que cero.' };
  }

  const { error } = await supabase.from('finance_movements').insert({
    dated,
    description,
    amount_cents: Math.round(importe * 100),
    direction,
    category,
    import_batch: 'manual',
    source: 'manual',
    published: false, // se revisa antes de que salga en /cuentas
  });

  if (error) {
    // 23505 = dedupe_key repetida (0035): ya existe ese mismo apunte.
    if (error.code === '23505') {
      return { ok: false, error: 'Ya existe un movimiento idéntico (misma fecha, importe y concepto).' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/tesoreria');
  return { ok: true };
}

/**
 * Corrección de un movimiento. Pensado sobre todo para **anonimizar**: quitar
 * el nombre de un particular de la descripción o de la contraparte antes de
 * publicarlo (RGPD). El trigger de 0035 registra el cambio en `audit_log` y
 * marca la fila como editada — la marca es visible también en /cuentas.
 */
export async function editarMovimientoAction(id: string, fd: FormData): Promise<ResultadoTesoreria> {
  const { supabase } = await requireTesoreria();

  const description = String(fd.get('description') ?? '').trim();
  const category = String(fd.get('category') ?? '').trim() || null;
  const anonimizar = fd.get('anonimizar') === 'on';

  if (!description) return { ok: false, error: 'El concepto no puede quedar vacío.' };

  const cambios: Record<string, unknown> = { description, category };
  if (anonimizar) {
    cambios.counterparty_name = null;
    cambios.counterparty_ref = null;
  }

  const { error } = await supabase.from('finance_movements').update(cambios).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/tesoreria');
  revalidatePath('/cuentas');
  return { ok: true };
}

/** Publica o retira un movimiento de la web pública de transparencia. */
export async function publicarMovimientoAction(
  id: string,
  publicado: boolean,
): Promise<ResultadoTesoreria> {
  const { supabase } = await requireTesoreria();

  const { error } = await supabase
    .from('finance_movements')
    .update({ published: publicado })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/tesoreria');
  revalidatePath('/cuentas');
  return { ok: true };
}
