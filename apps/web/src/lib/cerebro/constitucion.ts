import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * "Constitución" del cerebro (petición de Sergio, 07/08/2026): además de
 * BD (brain_entries → brain_documents, la capa de chunks+embeddings que ya
 * consume el chat), un espejo en Markdown organizado por categoría, para que
 * una IA pueda leerlo de un tirón sin recorrer tablas — y para que el propio
 * equipo pueda auditar/corregir el conocimiento del partido como si fuera un
 * libro.
 *
 * SOLO entradas `visibility = 'public'`: el repo de código es público en
 * GitHub (github.com/estudiohz/razoncomun), así que cualquier cosa que se
 * escriba aquí y se commitee es pública de facto. Las entradas `internal`
 * (borradores, notas de trabajo) se quedan solo en BD — nunca en este
 * Markdown versionado. El índice deja constancia de cuántas se han excluido
 * por eso, para que no parezca que faltan por error.
 */

export interface EntradaConstitucion {
  title: string;
  body: string;
  area_name: string | null;
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
    return `${cabecera}\n_Todavía no hay entradas públicas en esta categoría._\n`;
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
        .map(
          (e) =>
            `### ${e.title}\n\n${e.body.trim()}\n\n_Actualizado: ${new Date(e.updated_at).toLocaleDateString('es-ES')}_\n`,
        )
        .join('\n---\n\n');
      return `## ${area}\n\n${entradas}`;
    })
    .join('\n\n');

  return `${cabecera}\n${secciones}\n`;
}

function renderIndice(categorias: CategoriaConstitucion[], generatedAt: string, excluidasInternal: number): string {
  const filas = categorias
    .map((c) => `- [${c.name}](./${c.slug}.md) — ${c.entradas.length} entrada${c.entradas.length === 1 ? '' : 's'}`)
    .join('\n');

  return [
    `<!-- GENERADO AUTOMÁTICAMENTE por /api/cerebro/constitucion — no editar a mano, se sobrescribe. -->`,
    '',
    '# La constitución de Razón Común',
    '',
    'Espejo en Markdown del conocimiento público del partido (wiki `brain_entries`),',
    'organizado por categoría. Pensado para que una IA (o una persona) lo lea de un',
    'tirón sin tener que consultar la base de datos.',
    '',
    `Generado: ${new Date(generatedAt).toLocaleString('es-ES')}.`,
    excluidasInternal > 0
      ? `\n> ${excluidasInternal} entrada${excluidasInternal === 1 ? '' : 's'} interna${excluidasInternal === 1 ? '' : 's'} (visibility='internal') no se incluyen aquí a propósito: este repositorio es público.`
      : '',
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

  const [{ data: categorias, error: e1 }, { data: entradas, error: e2 }, { count: internos, error: e3 }] =
    await Promise.all([
      admin.from('brain_categories').select('id, slug, name').order('position', { ascending: true }),
      admin
        .from('brain_entries')
        .select('title, body, category_id, updated_at, area:categories(name)')
        .eq('visibility', 'public')
        .order('updated_at', { ascending: false }),
      admin
        .from('brain_entries')
        .select('id', { count: 'exact', head: true })
        .eq('visibility', 'internal'),
    ]);

  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  const porCategoria = new Map<string, CategoriaConstitucion>();
  for (const cat of categorias ?? []) {
    porCategoria.set(cat.id as string, { slug: cat.slug as string, name: cat.name as string, entradas: [] });
  }

  for (const fila of (entradas ?? []) as unknown as {
    title: string;
    body: string;
    category_id: string;
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
    content: renderIndice(listaCategorias, generatedAt, internos ?? 0),
  };

  return { generated_at: generatedAt, index, files };
}
