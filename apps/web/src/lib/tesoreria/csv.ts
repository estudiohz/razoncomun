/**
 * Lector de extractos bancarios (T3).
 *
 * Deliberadamente sin dependencias: un CSV de banco es un fichero pequeño y
 * añadir una librería de parseo por esto no compensa (presupuesto 0-30€/mes y
 * una dependencia más que auditar en un repo público).
 *
 * Soporta lo que de verdad varía entre bancos y entre exportaciones de Excel:
 * separador coma o punto y coma, campos entrecomillados con comas dentro,
 * cabeceras en español o inglés, importe en una sola columna con signo o en dos
 * (debe/haber), y decimales con coma o con punto.
 */

export interface FilaExtracto {
  dated: string; // YYYY-MM-DD
  description: string;
  amount_cents: number; // siempre positivo
  direction: 'in' | 'out';
  counterparty_name: string | null;
  linea: number;
}

export interface ResultadoLectura {
  filas: FilaExtracto[];
  errores: { linea: number; motivo: string }[];
  columnas: string[];
}

/** Divide respetando comillas dobles (y "" como comilla escapada). */
function partirLinea(linea: string, sep: string): string[] {
  const out: string[] = [];
  let actual = '';
  let enComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (enComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        enComillas = !enComillas;
      }
    } else if (c === sep && !enComillas) {
      out.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  out.push(actual);
  return out.map((s) => s.trim());
}

function detectarSeparador(cabecera: string): string {
  const puntoYComa = (cabecera.match(/;/g) ?? []).length;
  const comas = (cabecera.match(/,/g) ?? []).length;
  return puntoYComa >= comas ? ';' : ',';
}

function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const ALIAS: Record<string, string[]> = {
  fecha: ['fecha', 'fechaoperacion', 'fechavalor', 'date', 'completiondate', 'transactiondate'],
  concepto: ['concepto', 'descripcion', 'description', 'detalle', 'reference', 'referencia', 'movimiento'],
  importe: ['importe', 'amount', 'cantidad', 'valor'],
  cargo: ['cargo', 'debe', 'debit', 'salida', 'paidout'],
  abono: ['abono', 'haber', 'credit', 'entrada', 'paidin'],
  contraparte: ['beneficiario', 'ordenante', 'contrapartida', 'nombre', 'payee', 'counterparty', 'name'],
};

function indiceDe(columnas: string[], clave: keyof typeof ALIAS): number {
  const alias = ALIAS[clave];
  return columnas.findIndex((c) => alias.includes(normaliza(c)));
}

/** "1.234,56" · "1,234.56" · "-45,00" → céntimos (con signo). */
function aCentimos(bruto: string): number | null {
  let s = bruto.replace(/[^\d,.\-+]/g, '').trim();
  if (!s) return null;

  const negativo = s.startsWith('-');
  s = s.replace(/[-+]/g, '');

  const ultimaComa = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');

  if (ultimaComa > -1 && ultimoPunto > -1) {
    // El separador decimal es el que va más a la derecha.
    if (ultimaComa > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (ultimaComa > -1) {
    // Coma sola: decimal si deja 1-2 dígitos detrás, si no es de millares.
    s = s.length - ultimaComa - 1 <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) * (negativo ? -1 : 1);
}

/** "15/07/2026" · "2026-07-15" · "15-07-2026" → "2026-07-15". */
function aFecha(bruto: string): string | null {
  const s = bruto.trim().split(' ')[0];
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function leerExtracto(texto: string): ResultadoLectura {
  // Quita BOM: Excel lo pone al guardar como CSV UTF-8 y rompe la 1ª cabecera.
  const limpio = texto.replace(/^﻿/, '');
  const lineas = limpio.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (lineas.length < 2) {
    return { filas: [], errores: [{ linea: 0, motivo: 'El fichero no tiene datos.' }], columnas: [] };
  }

  const sep = detectarSeparador(lineas[0]);
  const columnas = partirLinea(lineas[0], sep);

  const iFecha = indiceDe(columnas, 'fecha');
  const iConcepto = indiceDe(columnas, 'concepto');
  const iImporte = indiceDe(columnas, 'importe');
  const iCargo = indiceDe(columnas, 'cargo');
  const iAbono = indiceDe(columnas, 'abono');
  const iContraparte = indiceDe(columnas, 'contraparte');

  if (iFecha < 0) {
    return {
      filas: [],
      columnas,
      errores: [{ linea: 1, motivo: 'No se encuentra una columna de fecha. Cabeceras leídas: ' + columnas.join(' · ') }],
    };
  }
  if (iImporte < 0 && iCargo < 0 && iAbono < 0) {
    return {
      filas: [],
      columnas,
      errores: [{ linea: 1, motivo: 'No se encuentra una columna de importe (ni debe/haber). Cabeceras leídas: ' + columnas.join(' · ') }],
    };
  }

  const filas: FilaExtracto[] = [];
  const errores: { linea: number; motivo: string }[] = [];

  for (let i = 1; i < lineas.length; i++) {
    const celdas = partirLinea(lineas[i], sep);
    const numero = i + 1;

    const dated = aFecha(celdas[iFecha] ?? '');
    if (!dated) {
      errores.push({ linea: numero, motivo: `Fecha no reconocida: "${celdas[iFecha] ?? ''}"` });
      continue;
    }

    let centimos: number | null = null;
    if (iImporte > -1) {
      centimos = aCentimos(celdas[iImporte] ?? '');
    } else {
      const cargo = iCargo > -1 ? aCentimos(celdas[iCargo] ?? '') : null;
      const abono = iAbono > -1 ? aCentimos(celdas[iAbono] ?? '') : null;
      if (abono) centimos = Math.abs(abono);
      else if (cargo) centimos = -Math.abs(cargo);
    }

    if (centimos === null || centimos === 0) {
      errores.push({ linea: numero, motivo: 'Importe vacío o no reconocido' });
      continue;
    }

    const description = (iConcepto > -1 ? celdas[iConcepto] : '')?.trim() || 'Movimiento bancario';

    filas.push({
      dated,
      description: description.slice(0, 200),
      amount_cents: Math.abs(centimos),
      direction: centimos > 0 ? 'in' : 'out',
      counterparty_name: iContraparte > -1 ? (celdas[iContraparte] || '').trim() || null : null,
      linea: numero,
    });
  }

  return { filas, errores, columnas };
}
