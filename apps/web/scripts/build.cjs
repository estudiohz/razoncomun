'use strict';
/**
 * Wrapper de build cross-platform. Inyecta el shim `fix-readlink.cjs` vía
 * NODE_OPTIONS (para el proceso principal y sus workers) y lanza `next build`.
 * En Linux el shim es un no-op, así que el resultado es idéntico al build
 * estándar en el Dockerfile de rc-01.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Barras normales: NODE_OPTIONS trata "\" como escape; Node las acepta igual.
const shim = path.join(__dirname, 'fix-readlink.cjs').replace(/\\/g, '/');
const previo = process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : '';
process.env.NODE_OPTIONS = `${previo}--require "${shim}"`;

const nextBin = require.resolve('next/dist/bin/next');
const res = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(res.status ?? 1);
