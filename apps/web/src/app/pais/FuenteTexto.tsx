/**
 * app/pais/FuenteTexto.tsx
 *
 * Muestra el texto de una fuente (fuente_actual/fuente) y, si además hay
 * `url` (0031 — "dividir el input de fuente en 2: el actual + URL de la
 * fuente"), lo enlaza de forma clicable en vez de dejarlo como texto plano.
 * Compartido por `PanelPais`, `PanelMinisterio` y `PiramidePoblacional`.
 */

export function FuenteTexto({ texto, url }: { texto: string; url?: string | null }) {
  const enlace = url?.trim();
  if (!enlace) return <>{texto}</>;
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-dotted underline-offset-2 hover:text-titular"
    >
      {texto} ↗
    </a>
  );
}
