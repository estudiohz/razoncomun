'use strict';
/**
 * Shim SOLO para build local en Windows con Node 24.
 *
 * Node 24 en Windows tiene una regresión: `fs.readlink` sobre un fichero
 * NORMAL (no symlink) devuelve `EISDIR` en lugar de `EINVAL`. El `realpath`
 * de Next/webpack/Turbopack solo contempla `EINVAL` para "esto no es un
 * enlace", así que `EISDIR` aborta el build (readlink sobre node_modules/*.js).
 *
 * Aquí interceptamos readlink y, cuando el objetivo NO es un symlink,
 * traducimos EISDIR→EINVAL para que realpath lo trate como fichero real.
 * En Linux (Docker/Dokploy, el destino de despliegue) esto no aplica: el
 * shim es un no-op porque readlink ya se comporta bien.
 */
// En Linux/macOS readlink se comporta bien: el shim no debe hacer nada.
if (process.platform !== 'win32') {
  module.exports = {};
  return;
}

const fs = require('fs');

function esEISDIR(err) {
  return err && err.code === 'EISDIR' && err.syscall === 'readlink';
}
function traducir(err) {
  const e = new Error(err.message.replace('EISDIR', 'EINVAL'));
  e.code = 'EINVAL';
  e.errno = -22;
  e.syscall = 'readlink';
  e.path = err.path;
  return e;
}

const readlinkSyncOrig = fs.readlinkSync;
fs.readlinkSync = function patchedReadlinkSync(...args) {
  try {
    return readlinkSyncOrig.apply(fs, args);
  } catch (err) {
    if (esEISDIR(err)) throw traducir(err);
    throw err;
  }
};

const readlinkOrig = fs.readlink;
fs.readlink = function patchedReadlink(...args) {
  const cb = args[args.length - 1];
  if (typeof cb !== 'function') return readlinkOrig.apply(fs, args);
  args[args.length - 1] = function (err, ...rest) {
    if (esEISDIR(err)) return cb(traducir(err));
    return cb(err, ...rest);
  };
  return readlinkOrig.apply(fs, args);
};

if (fs.promises && fs.promises.readlink) {
  const readlinkPromiseOrig = fs.promises.readlink;
  fs.promises.readlink = function patchedReadlinkPromise(...args) {
    return readlinkPromiseOrig.apply(fs.promises, args).catch((err) => {
      if (esEISDIR(err)) throw traducir(err);
      throw err;
    });
  };
}
