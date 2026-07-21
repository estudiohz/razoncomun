// lib/admin/modelos-ia.ts
//
// Catálogo CLIENT-SAFE de proveedores y modelos de IA para el panel de ajustes.
// Deliberadamente SIN imports de servidor (nada de createAdminClient / service
// role): este módulo lo importa tanto el Server Component (page.tsx) como el
// Client Component del formulario (ProveedorIAPanel.tsx), así que no puede
// arrastrar secretos ni el cliente admin al bundle del navegador.
//
// `ia.ts` (server-only) re-exporta PROVEEDORES_IA / PROVEEDOR_LABEL / ProveedorIA
// desde aquí para que el resto del código de servidor siga importando de
// '@/lib/admin/ia' sin cambios.
//
// El catálogo NO es una lista cerrada: el formulario ofrece siempre una opción
// "Otro (escribir a mano)…" para modelos nuevos que aún no estén aquí, de modo
// que un modelo recién publicado no obliga a un deploy. La validación dura del
// id de modelo (que exista de verdad) la hace el proveedor al primer uso y la
// suite de neutralidad; este catálogo solo evita la causa más común de fallo:
// un id mal escrito a mano (p. ej. "gemini-2.5" en vez de "gemini-2.5-flash").

export const PROVEEDORES_IA = ['anthropic', 'openai', 'google'] as const;
export type ProveedorIA = (typeof PROVEEDORES_IA)[number];

export const PROVEEDOR_LABEL: Record<ProveedorIA, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  google: 'Google (Gemini)',
};

export type ModeloIA = {
  /** id EXACTO que espera la API del proveedor (va tal cual en la petición). */
  id: string;
  /** Nombre legible para el desplegable. */
  label: string;
  /** Marca el valor por defecto sugerido al elegir el proveedor. */
  recomendado?: boolean;
  /** Aclaración corta (coste, rapidez, límites) que se muestra en la opción. */
  nota?: string;
};

/**
 * Modelos conocidos por proveedor (enero 2026). El primero marcado
 * `recomendado` se autoselecciona al elegir ese proveedor. Para Google se
 * priorizan los modelos del free tier (presupuesto 0-30 €/mes del partido).
 */
export const MODELOS_POR_PROVEEDOR: Record<ProveedorIA, ModeloIA[]> = {
  // Alias "-latest": apuntan siempre al modelo estable vigente y NO se
  // desactivan para proyectos nuevos (a diferencia de los ids con versión fija
  // como `gemini-2.5-flash`, que Google bloquea para usuarios nuevos con un 404
  // "no longer available to new users"). Verificado en julio 2026 con una key
  // de proyecto nuevo: `gemini-flash-latest` responde 200; `gemini-2.5-flash` da 404.
  google: [
    { id: 'gemini-flash-latest', label: 'Gemini Flash (latest)', recomendado: true, nota: 'gratis · rápido · siempre al día' },
    { id: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (latest)', nota: 'gratis · el más económico' },
    { id: 'gemini-pro-latest', label: 'Gemini Pro (latest)', nota: 'más capaz · free tier limitado' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', nota: 'estable' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', recomendado: true, nota: 'económico' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', nota: 'equilibrado' },
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', nota: 'máxima calidad' },
    { id: 'claude-fable-5', label: 'Claude Fable 5' },
  ],
  openai: [
    { id: 'gpt-5-mini', label: 'GPT-5 mini', recomendado: true, nota: 'económico' },
    { id: 'gpt-5', label: 'GPT-5' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
};

/** Valor sentinela para la opción "Otro (escribir a mano)…" del desplegable. */
export const MODELO_OTRO = '__otro__';

/** Modelo recomendado (por defecto) de un proveedor, o '' si no hay catálogo. */
export function modeloRecomendado(provider: ProveedorIA): string {
  const lista = MODELOS_POR_PROVEEDOR[provider] ?? [];
  return (lista.find((m) => m.recomendado) ?? lista[0])?.id ?? '';
}

/** true si `modelId` está en el catálogo del proveedor (para precargar el select). */
export function esModeloConocido(provider: ProveedorIA, modelId: string): boolean {
  return (MODELOS_POR_PROVEEDOR[provider] ?? []).some((m) => m.id === modelId);
}

/** Texto de una opción del desplegable: "Gemini 2.5 Flash — gratis · rápido (recomendado)". */
export function etiquetaModelo(m: ModeloIA): string {
  const partes = [m.label];
  if (m.nota) partes.push(`— ${m.nota}`);
  if (m.recomendado) partes.push('(recomendado)');
  return partes.join(' ');
}
