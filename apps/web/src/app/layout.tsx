import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { AvisoCookies } from '@/components/legal/AvisoCookies';
import { CodigoSeguimiento } from '@/components/legal/CodigoSeguimiento';
import { codigoSeguimiento } from '@/lib/legal/seguimiento';
import { ChromePublico } from '@/components/layout/ChromePublico';
import { BandaDonacion } from '@/components/layout/BandaDonacion';
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
  // El icono de pestaña/favicon (`icon`) puede llevar transparencia — lo pinta
  // el navegador sobre su propio fondo. El de "añadir a inicio" de iOS
  // (`apple`) NO: Safari compone el alfa como NEGRO y no le pone ningún
  // padding propio, así que necesita su archivo aparte, ya opaco (fondo
  // blanco) y con el hexágono encogido para no tocar los bordes — el mismo
  // icono transparente y a sangre que usa el carnet de socio (PDF/Wallet) se
  // veía perfecto ahí, pero mal como icono de app (Sergio, 11/09/2026).
  icons: { icon: '/icono-rc.png', apple: '/apple-touch-icon.png' },
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { head, body } = await codigoSeguimiento();

  return (
    <html lang="es" className={montserrat.variable}>
      <body>
        <script
          type="application/ld+json"
          // JSON-LD de organización política (schema.org/PoliticalParty)
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganizacion()) }}
        />
        <ChromePublico nav={<Nav />} footer={<Footer />} donacion={<BandaDonacion />}>
          {children}
        </ChromePublico>
        {/* Menú inferior de la app (móvil). Fuera de ChromePublico a propósito:
            debe verse también en /panel; él mismo se oculta en /admin. */}
        <MenuInferior />
        <RegistroPWA />
        {/* El aviso y el inyector, en este orden. El inyector NO carga nada
            hasta que hay un "Aceptar" explícito: ver CodigoSeguimiento.tsx. */}
        <AvisoCookies />
        <CodigoSeguimiento codigoHead={head} codigoBody={body} />
      </body>
    </html>
  );
}
