'use server';

import { revalidatePath } from 'next/cache';
import { requireTesoreria } from '@/lib/tesoreria/guard';
import { leerExtracto } from '@/lib/tesoreria/csv';

export interface ResultadoImportacion {
  ok: boolean;
  error?: string;
  leidas?: number;
  importadas?: number;
  duplicadas?: number;
  errores?: { linea: number; motivo: string }[];
  columnas?: string[];
  lote?: string;
}

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Importa un extracto bancario (T3).
 *
 * Dos garantías que vienen de la BD, no de aquí:
 *  - Los duplicados los rechaza el índice único sobre `dedupe_key` (0035), así
 *    que reimportar un mes solapado es inofensivo. Se usa `ignoreDuplicates` y
 *    se cuenta lo realmente insertado.
 *  - Todo entra con `published=false`: nada aparece en /cuentas hasta que
 *    alguien lo revisa. La transparencia es publicar, no volcar el banco entero
 *    con los nombres de los donantes.
 */
export async function importarExtractoAction(fd: FormData): Promise<ResultadoImportacion> {
  const { supabase } = await requireTesoreria('/admin/tesoreria/importar');

  const fichero = fd.get('extracto');
  if (!(fichero instanceof File) || fichero.size === 0) {
    return { ok: false, error: 'Elige un fichero.' };
  }
  if (fichero.size > MAX_BYTES) {
    return { ok: false, error: 'El fichero supera los 2 MB. Exporta solo el periodo que necesites.' };
  }
  if (/\.xlsx?$/i.test(fichero.name)) {
    return {
      ok: false,
      error:
        'Los .xls/.xlsx no se leen directamente. Ábrelo en Excel y usa "Guardar como → CSV UTF-8"; se importa igual.',
    };
  }

  const texto = new TextDecoder('utf-8').decode(await fichero.arrayBuffer());
  const { filas, errores, columnas } = leerExtracto(texto);

  if (filas.length === 0) {
    return {
      ok: false,
      error: 'No se ha podido leer ningún movimiento del fichero.',
      errores: errores.slice(0, 10),
      columnas,
    };
  }

  const lote = `${new Date().toISOString().slice(0, 10)}-${fichero.name.replace(/[^\w.-]/g, '_').slice(0, 40)}`;

  const { data, error } = await supabase
    .from('finance_movements')
    .upsert(
      filas.map((f) => ({
        dated: f.dated,
        description: f.description,
        amount_cents: f.amount_cents,
        direction: f.direction,
        counterparty_name: f.counterparty_name,
        import_batch: lote,
        source: 'banco',
        published: false,
      })),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    .select('id');

  if (error) return { ok: false, error: error.message, columnas };

  const importadas = data?.length ?? 0;

  revalidatePath('/admin/tesoreria');
  return {
    ok: true,
    leidas: filas.length,
    importadas,
    duplicadas: filas.length - importadas,
    errores: errores.slice(0, 10),
    columnas,
    lote,
  };
}
