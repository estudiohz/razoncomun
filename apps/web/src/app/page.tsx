import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero';
import { Bento } from '@/components/home/Bento';
import { DiscordParallax } from '@/components/home/DiscordParallax';
import { FeedObservatorio } from '@/components/home/FeedObservatorio';
import { IASection } from '@/components/home/IASection';
import { CtaFinal } from '@/components/home/CtaFinal';
import { metadatosPagina } from '@/lib/seo';
import { site } from '@/lib/site';

export const metadata: Metadata = metadatosPagina({
  titulo: `${site.nombre} — ${site.subtitulo}`,
  descripcion: site.descripcion,
  ruta: '/',
});

export default function HomePage() {
  return (
    <>
      <Hero />
      <Bento />
      <DiscordParallax />
      <FeedObservatorio />
      <IASection />
      <CtaFinal />
    </>
  );
}
