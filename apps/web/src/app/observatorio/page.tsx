import type { Metadata } from 'next';
import { Placeholder } from '@/components/layout/Placeholder';
import { metadatosPagina } from '@/lib/seo';

export const metadata: Metadata = metadatosPagina({
  titulo: 'Observatorio de datos',
  descripcion:
    'Análisis diario a partir de fuentes oficiales (INE, Eurostat, BOE, Banco de España), traducido a lenguaje claro y verificado antes de publicarse. Siempre con la fuente enlazada.',
  ruta: '/observatorio',
});

export default function ObservatorioPage() {
  return (
    <Placeholder
      eyebrow="Observatorio"
      titulo="Los datos oficiales, en lenguaje claro"
      descripcion="INE, Eurostat, BOE y Banco de España traducidos y verificados. El feed se alimenta solo: fuentes oficiales → redacción IA → revisión humana → publicación."
      dueño="RC-Brain (rc-08) y Contenido (rc-05)"
    />
  );
}
