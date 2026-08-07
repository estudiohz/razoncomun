import type { SupabaseClient } from '@supabase/supabase-js';
import { slugificar } from '@/lib/blog/markdown';

/**
 * "Constitución" del cerebro (petición de Sergio, 07/08/2026): además de
 * BD (brain_entries → brain_documents, la capa de chunks+embeddings que ya
 * consume el chat), un espejo en Markdown organizado en árbol, para que una
 * IA pueda leerlo de un tirón sin recorrer tablas — y para que el propio
 * equipo pueda auditar/corregir el conocimiento del partido como si fuera
 * un libro.
 *
 * Destino: `razoncomun-docs` (repo PRIVADO de documentación — decisión de
 * Sergio, 07/08/2026, distinto de `razoncomun`, el repo de código, que es
 * público). Por eso incluye TODAS las entradas, también `visibility=
 * 'internal'` (marcadas como tales en el propio Markdown).
 *
 * ÁRBOL A 4 NIVELES (Sergio, 07/08/2026: "se prevé mucha info, hasta 3 o 4
 * niveles sería lo ideal") — cada nivel es un INDICE.md que enlaza hacia
 * abajo (y hacia arriba, con un enlace "← Volver") para poder navegar el
 * árbol sin salir de GitHub:
 *
 *   docs/cerebro/INDICE.md                                   (1: categorías)
 *   docs/cerebro/<categoria>/INDICE.md                        (2: áreas)
 *   docs/cerebro/<categoria>/<area>/INDICE.md                 (3: entradas)
 *   docs/cerebro/<categoria>/<area>/<entrada>.md               (4: contenido)
 *
 * Si una entrada no tiene área (p.ej. Estatutos, Ideario general) cae en el
 * cajón `general/` de su categoría — así el árbol es siempre regular
 * (4 niveles fijos), no condicional según haya área o no.
 */

export interface EntradaConstitucion {
  slug: string;
  title: string;
  body: string;
  visibility: 'public' | 'internal';
  updated_at: string;
}

export interface AreaConstitucion {
  slug: string;
  name: string;
  entradas: EntradaConstitucion[];
}

export interface CategoriaConstitucion {
  slug: string;
  name: string;
  areas: AreaConstitucion[];
}

export interface ArchivoGenerado {
  path: string;
  content: string;
}

export interface ResultadoConstitucion {
  generated_at: string;
  index: ArchivoGenerado;
  files: ArchivoGenerado[];
}

const CARPETA = 'docs/cerebro';
const AREA_GENERAL = { slug: 'general', name: 'General' };

/** Slug único dentro de un mismo directorio: añade -2, -3... en colisión. */
function slugUnico(base: string, usados: Set<string>): string {
  const raiz = slugificar(base) || 'entrada';
  let candidato = raiz;
  let n = 2;
  while (usados.has(candidato)) {
    candidato = `${raiz}-${n}`;
    n += 1;
  }
  usados.add(candidato);
  return candidato;
}

function renderEntrada(cat: CategoriaConstitucion, area: AreaConstitucion, e: EntradaConstitucion, generatedAt: string): string {
  const etiquetaInterna = e.visibility === 'internal' ? '\n\n> `[interno]` — no compartir fuera del equipo.' : '';
  return [
    `<!-- GENERADO AUTOMÁTICAMENTE por /api/cerebro/constitucion — no editar a mano, se sobrescribe. Fuente real: tabla brain_entries. Última generación: ${generatedAt} -->`,
    '',
    `[← ${area.name}](./INDICE.md) · [${cat.name}](../INDICE.md) · [Constitución](../../INDICE.md)`,
    '',
    `# ${e.title}`,
    etiquetaInterna,
    '',
    e.body.trim(),
    '',
    `_Actualizado: ${new Date(e.updated_at).toLocaleDateString('es-ES')}_`,
    '',
  ].join('\n');
}

function renderIndiceArea(cat: CategoriaConstitucion, area: AreaConstitucion, generatedAt: string): string {
  const filas =
    area.entradas.length === 0
      ? '_Todavía no hay entradas aquí._'
      : area.entradas
          .map((e) => `- [${e.title}${e.visibility === 'internal' ? ' `[interno]`' : ''}](./${e.slug}.md)`)
          .join('\n');

  return [
    `<!-- GENERADO AUTOMÁTICAMENTE por /api/cerebro/constitucion — no editar a mano, se sobrescribe. -->`,
    '',
    `[← ${cat.name}](../INDICE.md) · [Constitución](../../INDICE.md)`,
    '',
    `# ${cat.name} · ${area.name}`,
    '',
    filas,
    '',
  ].join('\n');
}

function renderIndiceCategoria(cat: CategoriaConstitucion, generatedAt: string): string {
  const filas = cat.areas
    .map((a) => `- [${a.name}](./${a.slug}/INDICE.md) — ${a.entradas.length} entrada${a.entradas.length === 1 ? '' : 's'}`)
    .join('\n');

  return [
    `<!-- GENERADO AUTOMÁTICAMENTE por /api/cerebro/constitucion — no editar a mano, se sobrescribe. -->`,
    '',
    `[← Constitución](../INDICE.md)`,
    '',
    `# ${cat.name}`,
    '',
    filas || '_Todavía no hay áreas con entradas en esta categoría._',
    '',
  ].join('\n');
}

function renderIndiceRaiz(categorias: CategoriaConstitucion[], generatedAt: string): string {
  const filas = categorias
    .map((c) => {
      const total = c.areas.reduce((acc, a) => acc + a.entradas.length, 0);
      return `- [${c.name}](./${c.slug}/INDICE.md) — ${total} entrada${total === 1 ? '' : 's'} en ${c.areas.length} área${c.areas.length === 1 ? '' : 's'}`;
    })
    .join('\n');

  return [
    `<!-- GENERADO AUTOMÁTICAMENTE por /api/cerebro/constitucion — no editar a mano, se sobrescribe. -->`,
    '',
    '# La constitución de Razón Común',
    '',
    'Espejo en Markdown de la wiki de conocimiento del partido (`brain_entries`),',
    'organizado en árbol (categoría → área → entrada) para que una IA — o una',
    'persona — lo navegue sin tener que consultar la base de datos.',
    '',
    `Generado: ${new Date(generatedAt).toLocaleString('es-ES')}.`,
    '',
    "> Incluye entradas internas (marcadas `[interno]`): este repositorio es PRIVADO.",
    '',
    '## Categorías',
    '',
    filas,
    '',
  ].join('\n');
}

/** Consulta BD y genera el árbol completo de Markdown (no lo escribe: eso lo hace n8n vía GitHub). */
export async function generarConstitucion(admin: SupabaseClient): Promise<ResultadoConstitucion> {
  const generatedAt = new Date().toISOString();

  const [{ data: categoriasBD, error: e1 }, { data: entradasBD, error: e2 }] = await Promise.all([
    admin.from('brain_categories').select('id, slug, name').order('position', { ascending: true }),
    admin
      .from('brain_entries')
      .select('title, body, category_id, visibility, updated_at, area:categories(slug, name)')
      .order('updated_at', { ascending: false }),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;

  // categoría → área → entradas, construido en dos pasadas: primero las
  // áreas (para poder deduplicar slugs de entrada por-área), luego el árbol.
  const categorias = new Map<string, CategoriaConstitucion>();
  const areasPorCategoria = new Map<string, Map<string, AreaConstitucion>>();
  const slugsPorArea = new Map<string, Set<string>>(); // clave: `${categoryId}/${areaSlug}`

  for (const cat of categoriasBD ?? []) {
    const id = cat.id as string;
    categorias.set(id, { slug: cat.slug as string, name: cat.name as string, areas: [] });
    areasPorCategoria.set(id, new Map());
  }

  for (const fila of (entradasBD ?? []) as unknown as {
    title: string;
    body: string;
    category_id: string;
    visibility: 'public' | 'internal';
    updated_at: string;
    area: { slug: string; name: string } | { slug: string; name: string }[] | null;
  }[]) {
    const areasDeCategoria = areasPorCategoria.get(fila.category_id);
    if (!areasDeCategoria) continue; // categoría desconocida (no debería pasar, FK lo garantiza)

    const areaRaw = Array.isArray(fila.area) ? (fila.area[0] ?? null) : fila.area;
    const areaSlug = areaRaw?.slug ?? AREA_GENERAL.slug;
    const areaName = areaRaw?.name ?? AREA_GENERAL.name;

    if (!areasDeCategoria.has(areaSlug)) {
      areasDeCategoria.set(areaSlug, { slug: areaSlug, name: areaName, entradas: [] });
    }

    const claveSlugsArea = `${fila.category_id}/${areaSlug}`;
    if (!slugsPorArea.has(claveSlugsArea)) slugsPorArea.set(claveSlugsArea, new Set());

    areasDeCategoria.get(areaSlug)!.entradas.push({
      slug: slugUnico(fila.title, slugsPorArea.get(claveSlugsArea)!),
      title: fila.title,
      body: fila.body,
      visibility: fila.visibility,
      updated_at: fila.updated_at,
    });
  }

  for (const [id, cat] of categorias) {
    cat.areas = Array.from(areasPorCategoria.get(id)!.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  const listaCategorias = Array.from(categorias.values());

  const files: ArchivoGenerado[] = [];
  for (const cat of listaCategorias) {
    files.push({ path: `${CARPETA}/${cat.slug}/INDICE.md`, content: renderIndiceCategoria(cat, generatedAt) });
    for (const area of cat.areas) {
      files.push({
        path: `${CARPETA}/${cat.slug}/${area.slug}/INDICE.md`,
        content: renderIndiceArea(cat, area, generatedAt),
      });
      for (const entrada of area.entradas) {
        files.push({
          path: `${CARPETA}/${cat.slug}/${area.slug}/${entrada.slug}.md`,
          content: renderEntrada(cat, area, entrada, generatedAt),
        });
      }
    }
  }

  const index: ArchivoGenerado = {
    path: `${CARPETA}/INDICE.md`,
    content: renderIndiceRaiz(listaCategorias, generatedAt),
  };

  return { generated_at: generatedAt, index, files };
}
