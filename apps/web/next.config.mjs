// En @sentry/nextjs v11 el wrapper de build vive en el subpath `/config`.
import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
export const nextConfig = {
  // Requerido por el Dockerfile de rc-01 (build en imagen ligera).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Las Server Actions rechazan por defecto cuerpos de más de 1 MB: un PDF de
  // informe (o un vídeo en el editor) no llegaba nunca. 25 MB cubre el PDF de
  // 20 MB del test de estrés con margen para el resto de campos.
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Tienda (docs/tecnico/tienda-printful.md): las fotos de producto las
    // sirve el CDN de Printful, no nuestro dominio. Sin esta entrada
    // next/image responde 400 y la parrilla se queda sin imágenes.
    remotePatterns: [
      { protocol: 'https', hostname: 'files.cdn.printful.com' },
      { protocol: 'https', hostname: '*.cdn.printful.com' },
      // Storage de Supabase: fotos de uso de las fichas de producto (0052) y
      // cualquier media subida desde /admin. Sin esto next/image responde 400.
      { protocol: 'https', hostname: 'api.razoncomun.com', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'dev-api.razoncomun.com', pathname: '/storage/v1/object/public/**' },
    ],
  },
  // La página de afiliación pasó de /afiliate a /unete (Sergio, 10/08/2026).
  // Redirección permanente para no romper los enlaces ya publicados (footer
  // antiguo, correos de Stripe, enlaces compartidos) ni el SEO acumulado.
  async redirects() {
    return [
      { source: '/afiliate', destination: '/unete', permanent: true },
      { source: '/afiliate/:path*', destination: '/unete/:path*', permanent: true },
    ];
  },
};

// Sentry (T-0097, ver SENTRY.md). Los source maps solo se generan/suben si hay
// SENTRY_AUTH_TOKEN en el build, y los del cliente se borran tras subirlos:
// nunca se sirven al público. Sin ruta túnel (no hay CSP connect-src global).
/** @type {import('@sentry/nextjs/config').SentryBuildOptions} */
export const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  widenClientFileUpload: true,
  // Equivalente en v11 del antiguo `disableLogger`: quita el logger de debug del bundle.
  webpack: { treeshake: { removeDebugLogging: true } },
};

export default withSentryConfig(nextConfig, sentryBuildOptions);
