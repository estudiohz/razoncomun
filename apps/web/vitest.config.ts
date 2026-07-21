import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Config mínima de Vitest — para el motor puro de `lib/simulador/` (gate de
 * la ola S1) y para `app/pais/cascada.ts` (ola S2, el generador del "efecto
 * en cadena" del panel público): ambos son TypeScript puro sin React, así
 * que comparten el mismo entorno `node` sin DOM ni plugin de Next.
 */
export default defineConfig({
  test: {
    include: ['src/lib/simulador/**/*.test.ts', 'src/app/pais/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
