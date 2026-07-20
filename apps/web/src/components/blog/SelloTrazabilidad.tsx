import type { SelloTrazabilidad as Sello } from '@/lib/blog/tipos';

/**
 * Sello de trazabilidad — marca de la casa (Pilar 1, vision-plataforma.md).
 *
 * Dos partes inseparables en cada ficha:
 *   1. Las fuentes citadas (`source_urls`). El esquema las exige no nulas y
 *      el editor bloquea la publicación sin al menos una.
 *   2. La declaración de autoría: elaborado con IA sí/no · revisado por quién.
 *
 * Si un artículo llegara sin fuentes, se dice explícitamente en lugar de
 * ocultar el bloque: el silencio aquí sería exactamente lo que criticamos.
 */
export function SelloTrazabilidad({ sello }: { sello: Sello }) {
  return (
    <section className="mt-11 border-t border-linea pt-[26px]" aria-label="Trazabilidad">
      <h2 className="mb-3 text-[15px] font-bold uppercase tracking-[.08em] text-gris">Fuentes</h2>

      {sello.fuentes.length > 0 ? (
        <ol className="ml-5 list-decimal text-[14px] marker:text-gris">
          {sello.fuentes.map((url) => (
            <li key={url} className="mb-1">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-tinta underline-offset-2 hover:underline"
              >
                {url}
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[14px] text-gris">
          Este artículo no cita fuentes externas verificables.
        </p>
      )}

      <dl className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-linea bg-panel px-[18px] py-[14px] text-[13.5px] font-semibold text-cuerpo">
        <div className="flex items-center gap-2">
          <dt className="text-gris">Elaborado con IA:</dt>
          <dd className="text-tinta">{sello.elaboradoConIa ? 'Sí' : 'No'}</dd>
        </div>
        <span aria-hidden className="inline-block h-[3px] w-[3px] rounded-full bg-gris" />
        <div className="flex items-center gap-2">
          <dt className="text-gris">Revisado por:</dt>
          <dd className="text-tinta">{sello.revisadoPor ?? 'Redacción de Razón Común'}</dd>
        </div>
      </dl>
    </section>
  );
}
