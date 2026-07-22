import type { Metadata } from 'next';
import { Contenedor } from '@/components/layout/Contenedor';
import { renderizarMarkdown } from '@/lib/blog/markdown';
import { metadatosPagina } from '@/lib/seo';
import { ESTATUTOS_MD } from './estatutos-texto';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Estatutos',
  descripcion:
    'Estatutos, Código de Ética y Conducta y Acta de constitución de Razón Común, partido político inscrito en el Registro de Partidos Políticos del Ministerio del Interior.',
  ruta: '/estatutos',
});

/**
 * Página estática de los estatutos (documento legal). El texto vive en
 * `estatutos-texto.ts` y se renderiza VERBATIM con el mismo renderizador de
 * markdown y el mismo estilo `prose-rc` que los artículos del blog.
 */
export default function EstatutosPage() {
  const { html } = renderizarMarkdown(ESTATUTOS_MD);

  return (
    <Contenedor as="section" className="py-14 min-[720px]:py-20">
      <div className="mx-auto max-w-[780px]">
        <header className="mb-10 text-center">
          <span className="text-[13px] font-bold uppercase tracking-[.14em] text-accion">
            Documentos oficiales
          </span>
          <h1 className="mt-3 text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.1] text-titular">
            Estatutos
          </h1>
          <p className="mx-auto mt-4 max-w-[56ch] text-[15px] leading-relaxed text-gris">
            Estatutos, Código de Ética y Conducta y Acta de constitución de Razón Común. Partido
            político con NIF G26753582, inscrito en el Registro del Ministerio del Interior.
          </p>
        </header>

        <article className="prose-rc" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </Contenedor>
  );
}
