import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { ChromePublico } from '@/components/layout/ChromePublico';
import { RegistroPWA } from '@/components/layout/RegistroPWA';
import { MenuInferior } from '@/components/layout/MenuInferior';
import { jsonLdOrganizacion } from '@/lib/seo';
import { site } from '@/lib/site';

// Montserrat self-hosted por Next (subset latin, sin coste de red en runtime).
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.urlBase),
  title: {
    default: `${site.nombre} — ${site.subtitulo}`,
    template: `%s — ${site.nombre}`,
  },
  description: site.descripcion,
  applicationName: site.nombre,
  authors: [{ name: site.nombre }],
  icons: { icon: '/icono-rc.png' },
  // PWA: hace la web instalable en el móvil (icono + pantalla completa).
  // El service worker lo registra <RegistroPWA /> más abajo.
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: site.nombre, statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: site.nombre,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body>
        <script
          type="application/ld+json"
          // JSON-LD de organización política (schema.org/PoliticalParty)
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganizacion()) }}
        />
        <ChromePublico nav={<Nav />} footer={<Footer />}>
          {children}
        </ChromePublico>
        {/* Menú inferior de la app (móvil). Fuera de ChromePublico a propósito:
            debe verse también en /panel; él mismo se oculta en /admin. */}
        <MenuInferior />
        <RegistroPWA />
      </body>
    </html>
  );
}
