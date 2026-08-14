/** @type {import('next').NextConfig} */
const nextConfig = {
  // Requerido por el Dockerfile de rc-01 (build en imagen ligera).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
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
