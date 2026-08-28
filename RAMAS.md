# Ramas y despliegue

| Rama | Entorno | Despliegue |
|---|---|---|
| `dev` | `dev.razoncomun.com` (cerrado, solo con sesión) | **automático** al hacer push (webhook de GitHub) |
| `main` | `razoncomun.com` (producción) | **manual**, a propósito |

## Por qué así

Antes ambos entornos desplegaban de `main`, así que nada impedía que algo sin
probar llegara a producción por un despliegue a destiempo. Con ramas separadas,
para llegar a producción hay que pasar por un **merge explícito**: es una
decisión consciente, no un efecto secundario.

Producción se despliega **a mano** a propósito. Un merge a `main` no debe poder
publicar solo: casi siempre hace falta aplicar migraciones de base ANTES del
despliegue, y un automatismo se las saltaría. Ya pasó: desplegar el editor sin
la migración `0049` habría roto el blog entero, porque las consultas piden
`body_format` y la columna no existía.

## Flujo de trabajo

```bash
git checkout dev
# ... cambios ...
git push                      # despliega dev solo, en ~5 min
# probar en dev.razoncomun.com

git checkout main
git merge dev
git push                      # NO despliega nada todavia
```

Y entonces, en este orden:

1. **Aplicar las migraciones pendientes** a la base de producción.
2. Lanzar el despliegue:

```bash
curl -s -X POST "https://panel.razoncomun.com/api/application.deploy" \
  -H "Content-Type: application/json" -H "x-api-key: <RC_DOKPLOY_API_KEY>" \
  -d '{"applicationId":"smLJ0y1Gg97iN25_V5SFF"}'
```

   O en el panel → **razon comun PRODUCCION** → `rc-webapp-prod` → *Deploy*.

## Diferencias de entorno (NO están en el código)

`dev` y `main` contienen el mismo código. Lo que distingue los entornos son las
variables de Dokploy, y por eso un merge **no puede** arrastrar la configuración
de uno al otro:

- `RC_ENTORNO_CERRADO=true` — **solo en dev**. Cierra la web tras el login y la
  marca como no indexable. Producción no define esta variable.
- Claves de Supabase, `JWT_SECRET`, Stripe: distintas en cada entorno.

El único camino por el que la configuración de dev podría llegar a producción es
que alguien **copie el env de dev al de producción** a mano. No lo hagas.

## Panel

https://panel.razoncomun.com (respaldo por IP: `http://169.58.242.42:3000`)
# prueba del webhook rotado
