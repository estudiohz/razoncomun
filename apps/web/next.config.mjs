/** @type {import('next').NextConfig} */
const nextConfig = {
  // Requerido por el Dockerfile de rc-01 (build en imagen ligera).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
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

export default nextConfig;
