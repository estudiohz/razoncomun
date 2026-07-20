/** @type {import('next').NextConfig} */
const nextConfig = {
  // Requerido por el Dockerfile de rc-01 (build en imagen ligera).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
