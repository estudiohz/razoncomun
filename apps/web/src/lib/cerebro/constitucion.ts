import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * "Constitución" del cerebro (petición de Sergio, 07/08/2026): además de
 * BD (brain_entries → brain_documents, la capa de chunks+embeddings que ya
 * consume el chat), un espejo en Markdown organizado por categoría, para que
 * una IA pueda leerlo de un tirón sin recorrer tablas — y para que el propio
 * equipo pueda auditar/corregir el conocimiento del partido como si fuera un
 * libro.
 *
 * Incluye TODAS las entradas, también `visibility='internal'` (marcadas como
 * tal en el propio Markdown): el destino es `razoncomun-docs`, el repo
 * PRIVADO de documentación del proyecto (decisión de Sergio, 07/08/2026,
 * distinto de `razoncomun` — el repo de código, que sí es público). Si algún
 * día el destino cambiara a un repo público, esta función tendría que
 * volver a filtrar por `visibility='public'` — no asumir lo contrario.
 */

export interface EntradaConstitucion {
  title: string;
  body: string;
  area_name: string | null;
  visibility: 'public' | 'internal';
  updated_at: string;
}

export interface CategoriaConstitucion {
  slug: string;
  name: string;
  entradas: EntradaConstitucion[];
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

function slugArchivo(categorySlug: string): string {
  return `${CARPETA}/${categorySlug}.md`;
}

function renderCategoria(cat: CategoriaConstitucion, generatedAt: string): string {
  const cabecera = `<!-- GENERADO AUTOMÁTICAMENTE por /api/cerebro/constitucion — no editar a mano, se sobrescribe. Fuente real: tabla brain_entries. Última generación: ${generatedAt} -->\n\n# ${cat.name}\n`;

  if (cat.entradas.length === 0) {
    return `${cabecera}\n_Todavía no hay entradas en esta categoría._\n`;
  }

  // Agrupadas por área temática dentro de la categoría (Sanidad, Educación...)
  // cuando la tienen; las que no tienen área (Estatutos, Ideario general) van
  // en un bloque "General" al principio.
  const porArea = new Map<string, EntradaConstitucion[]>();
  for (const e of cat.entradas) {
    const clave = e.area_name ?? 'General';
    if (!porArea.has(clave)) porArea.set(clave, []);
    porArea.get(clave)!.push(e);
  }

  const orden = ['General', ...Array.from(porArea.keys()).filter((k) => k !== 'General').sort()];

  const secciones = orden
    .filter((area) => porArea.has(area))
    .map((area) => {
      const entradas = porArea
        .get(area)!
        .map((e) => {
          const etiquetaInterna = e.visibility === 'internal' ? ' `[interno]`' : '';
          return `### ${e.title}${etiquetaInterna}\n\n${e.body.trim()}\n\n_Actualizado: ${new Date(e.updated_at).toLocaleDateString('es-ES')}_\n`;
        })
        .join('\n---\n\n');
      return `## ${area}\n\n${entradas}`;
    })
    .join('\n\n');

  return `${cabecera}\n${secciones}\n`;
}

function renderIndice(categorias: CategoriaConstitucion[], generatedAt: string): string {
  const filas = categorias
    .map((c) => `- [${c.name}](./${c.slug}.md) — ${c.entradas.length} entrada${c.entradas.length === 1 ? '' : 's'}`)
    .join('\n');

  return [
    `<!-- GENERADO AUTOMÁTICAMENTE por /api/cerebro/constitucion — no editar a mano, se sobrescribe. -->`,
    '',
    '# La constitución de Razón Común',
    '',
    'Espejo en Markdown de la wiki de conocimiento del partido (`brain_entries`),',
    'organizado por categoría. Pensado para que una IA (o una persona) lo lea de un',
    'tirón sin tener que consultar la base de datos.',
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

/** Consulta BD y genera el conjunto de archivos Markdown (no los escribe: eso lo hace n8n vía GitHub). */
export async function generarConstitucion(admin: SupabaseClient): Promise<ResultadoConstitucion> {
  const generatedAt = new Date().toISOString();

  const [{ data: categorias, error: e1 }, { data: entradas, error: e2 }] = await Promise.all([
    admin.from('brain_categories').select('id, slug, name').order('position', { ascending: true }),
    admin
      .from('brain_entries')
      .select('title, body, category_id, visibility, updated_at, area:categories(name)')
      .order('updated_at', { ascending: false }),
  ]);

  if (e1) throw e1;
  if (e2) throw e2;

  const porCategoria = new Map<string, CategoriaConstitucion>();
  for (const cat of categorias ?? []) {
    porCategoria.set(cat.id as string, { slug: cat.slug as string, name: cat.name as string, entradas: [] });
  }

  for (const fila of (entradas ?? []) as unknown as {
    title: string;
    body: string;
    category_id: string;
    visibility: 'public' | 'internal';
    updated_at: string;
    area: { name: string } | { name: string }[] | null;
  }[]) {
    const cat = porCategoria.get(fila.category_id);
    if (!cat) continue;
    const areaNombre = Array.isArray(fila.area) ? (fila.area[0]?.name ?? null) : (fila.area?.name ?? null);
    cat.entradas.push({
      title: fila.title,
      body: fila.body,
      area_name: areaNombre,
      visibility: fila.visibility,
      updated_at: fila.updated_at,
    });
  }

  const listaCategorias = Array.from(porCategoria.values());

  const files: ArchivoGenerado[] = listaCategorias.map((cat) => ({
    path: slugArchivo(cat.slug),
    content: renderCategoria(cat, generatedAt),
  }));

  const index: ArchivoGenerado = {
    path: `${CARPETA}/INDICE.md`,
    content: renderIndice(listaCategorias, generatedAt),
  };

  return { generated_at: generatedAt, index, files };
}
