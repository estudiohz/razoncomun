import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * BOE (datos abiertos). No hay buscador por API: solo el sumario de cada día
 * (`/datosabiertos/api/boe/sumario/AAAAMMDD`), así que se indexan a diario
 * las secciones que interesan en `boe_items` (0076) y se busca ahí. De cada
 * candidato se lee el XML del anuncio (poder adjudicador, adjudicatario, NIF,
 * importe), que es además lo que se sella como prueba.
 */

export const BOE = 'https://www.boe.es';
const SECCIONES = new Set(['5A', '3']); // V-A contratación · III otras disposiciones
const UA = 'RazonComun-Auditoria/1.0 (+https://razoncomun.com)';

export interface ItemBoe {
  boe_id: string;
  title: string;
  section: string;
  seccion_codigo: string;
  published_date: string;
  url: string;
  url_xml: string | null;
  departamento: string | null;
  expediente: string | null;
}

const lista = <T>(x: T | T[] | undefined | null): T[] => (Array.isArray(x) ? x : x ? [x] : []);

function cadena(v: unknown, max = 2000): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

/** Expediente al final del título de los anuncios: "… Expediente: SEC20250102." */
export function expedienteDeTitulo(titulo: string): string | null {
  const m = titulo.match(/Expediente:\s*([^\s].*?)\.?\s*$/i);
  return m ? m[1].trim().slice(0, 120) : null;
}

/** Items de las secciones indexadas en el JSON del sumario de un día. */
export function itemsDeSumario(json: unknown, fecha: string): ItemBoe[] {
  const sumario = (json as { data?: { sumario?: { diario?: unknown } } })?.data?.sumario;
  const out: ItemBoe[] = [];
  for (const diario of lista(sumario?.diario as Record<string, unknown>[])) {
    for (const s of lista(diario.seccion as Record<string, unknown>[])) {
      const codigo = cadena(s.codigo, 10);
      if (!codigo || !SECCIONES.has(codigo)) continue;
      for (const dep of lista(s.departamento as Record<string, unknown>[])) {
        const departamento = cadena(dep.nombre, 300);
        // Los items cuelgan del departamento o de sus epígrafes.
        const items = [
          ...lista(dep.item as Record<string, unknown>[]),
          ...lista(dep.epigrafe as Record<string, unknown>[]).flatMap((e) => lista(e.item as Record<string, unknown>[])),
        ];
        for (const it of items) {
          const id = cadena(it.identificador, 40);
          const titulo = cadena(it.titulo, 2000);
          if (!id || !titulo) continue;
          out.push({
            boe_id: id,
            title: titulo,
            section: cadena(s.nombre, 200) ?? codigo,
            seccion_codigo: codigo,
            published_date: `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`,
            url: cadena(it.url_html, 500) ?? `${BOE}/diario_boe/txt.php?id=${id}`,
            url_xml: cadena(it.url_xml, 500),
            departamento,
            expediente: expedienteDeTitulo(titulo),
          });
        }
      }
    }
  }
  return out;
}

async function pedir(url: string, accept: string, timeoutMs = 20000): Promise<Response> {
  const r = await fetch(url, { headers: { accept, 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!r.ok) throw new Error(`BOE ${r.status} ${url}`);
  return r;
}

/** Indexa un día (AAAAMMDD). Devuelve cuántos items guardó; 0 si no hubo BOE ese día. */
export async function indexarDiaBoe(admin: SupabaseClient, fecha: string): Promise<number> {
  const r = await fetch(`${BOE}/datosabiertos/api/boe/sumario/${fecha}`, {
    headers: { accept: 'application/json', 'user-agent': UA },
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  if (r.status === 404) return 0; // domingos y festivos sin BOE
  if (!r.ok) throw new Error(`BOE sumario ${fecha}: ${r.status}`);
  const items = itemsDeSumario(await r.json(), fecha);
  if (!items.length) return 0;
  const { error } = await admin.from('boe_items').upsert(items, { onConflict: 'boe_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return items.length;
}

export interface AnuncioBoe {
  organo: string | null;
  organoNif: string | null;
  adjudicatario: string | null;
  adjudicatarioNif: string | null;
  importeCents: number | null;
  fechaAdjudicacion: string | null;
}

const MESES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

function euros(t: string | null): number | null {
  if (!t) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** Saca los datos clave del texto de un anuncio de formalización (formato estándar del BOE). */
export function leerAnuncio(xml: string): AnuncioBoe {
  const texto = (xml.match(/<texto>([\s\S]*?)<\/texto>/)?.[1] ?? '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
  const tras = (etiqueta: RegExp) => texto.match(new RegExp(`${etiqueta.source}\\s*\\n([^\\n]+)`, 'i'))?.[1]?.replace(/\.$/, '').trim() ?? null;

  const fecha = tras(/10\. Fecha de adjudicaci[oó]n:/)?.match(/(\d{1,2}) de (\w+) de (\d{4})/i);
  const importe =
    tras(/13\.1\) Valor de la oferta seleccionada:/) ??
    texto.match(/Importe (?:neto|total)?[^:\n]*:\s*\n?([\d.]+,\d{2}) euros/i)?.[1] ??
    null;

  return {
    organo: tras(/1\.1\) Nombre:/),
    organoNif: tras(/1\.2\) N[uú]mero de identificaci[oó]n fiscal:/),
    adjudicatario: tras(/12\.1\) Nombre:/),
    adjudicatarioNif: tras(/12\.2\) N[uú]mero de identificaci[oó]n fiscal:/)?.toUpperCase() ?? null,
    importeCents: euros(importe?.replace(/\s*euros?$/i, '') ?? null),
    fechaAdjudicacion: fecha && MESES[fecha[2].toLowerCase()] ? `${fecha[3]}-${MESES[fecha[2].toLowerCase()]}-${fecha[1].padStart(2, '0')}` : null,
  };
}

export async function descargarAnuncio(urlXml: string): Promise<{ xml: string; anuncio: AnuncioBoe }> {
  const xml = await (await pedir(urlXml, 'application/xml')).text();
  return { xml, anuncio: leerAnuncio(xml) };
}

/** Palabras con contenido para buscar en los títulos indexados. */
export function palabrasClave(texto: string, max = 4): string[] {
  const vacias = new Set(['contrato', 'contratos', 'servicio', 'servicios', 'ministerio', 'millones', 'euros', 'publico', 'publica', 'gobierno', 'espana']);
  const cuenta = new Map<string, number>();
  for (const p of texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)) {
    if (p.length >= 6 && !vacias.has(p)) cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([p]) => p);
}
