# ⚠️ Cómo añadir una dependencia sin romper el build

**No basta con `npm install` desde tu máquina.**

El `Dockerfile` construye con **`node:20-alpine` (npm 10)** y hace `npm ci`, que exige un
`package-lock.json` **exactamente en sync** con `package.json`. Si tu npm local es otra versión
mayor (npm 11 con Node 22/24, por ejemplo), resuelve el árbol de dependencias de forma distinta
y genera un lockfile **válido en local pero inválido para el build**.

Síntoma, y es engañoso porque no menciona versiones de npm:

```
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json are in sync.
npm error Missing: @floating-ui/dom@1.8.0 from lock file
```

Pasó dos veces el 28/08/2026 al añadir TipTap y luego jsdom.

## Procedimiento correcto

1. Añade la dependencia como quieras (`npm install …`) — para tener los tipos en local.
2. **Regenera el lockfile con la MISMA versión de Node que el Dockerfile** y verifica ahí
   mismo que `npm ci` pasa, antes de hacer commit:

```bash
docker run --rm -v "$PWD":/w -w /w node:20-alpine \
  sh -c 'rm -rf node_modules && npm install --package-lock-only --no-audit --no-fund && npm ci --no-audit --no-fund'
```

3. Haz commit del `package-lock.json` resultante.

> Si no tienes Docker en tu máquina, hazlo en el VPS: copia allí el `package.json`, ejecuta el
> comando de arriba en un directorio temporal y tráete el `package-lock.json`.

## Por qué no se "arregla" cambiando el Dockerfile a `npm install`

`npm ci` es lo que garantiza que el build instala **exactamente** las versiones del lockfile.
Cambiarlo a `npm install` haría que producción y desarrollo pudieran acabar con árboles de
dependencias distintos sin que nadie se entere — mucho peor que este inconveniente.
