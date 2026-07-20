import type { Metadata } from 'next';
import { Placeholder } from '@/components/layout/Placeholder';
import { metadatosPagina } from '@/lib/seo';

function nombreProvincia(slug: string): string {
  return slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const provincia = nombreProvincia(slug);
  return metadatosPagina({
    titulo: `Razón Común en ${provincia}`,
    descripcion: `Actividad, propuestas y comunidad de Razón Común en ${provincia}. Súmate a la política basada en datos en tu territorio.`,
    ruta: `/provincia/${slug}`,
  });
}

export default async function ProvinciaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const provincia = nombreProvincia(slug);
  return (
    <Placeholder
      eyebrow="Territorio"
      titulo={`Razón Común en ${provincia}`}
      descripcion={`Aquí vivirá la actividad territorial de Razón Común en ${provincia}: comunidad, propuestas locales y eventos.`}
      dueño="Programa Vivo (rc-06) y Panel Admin (rc-09)"
    />
  );
}
