import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Config mínima de Vitest — SOLO para el motor puro de `lib/simulador/`
 * (docs/tecnico/simulador-pais.md, gate de la ola S1). Sin entorno DOM,
 * sin plugin de Next: son módulos TypeScript puros, sin React.
 */
export default defineConfig({
  test: {
    include: ['src/lib/simulador/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
