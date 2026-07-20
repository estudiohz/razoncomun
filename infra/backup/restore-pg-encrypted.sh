#!/usr/bin/env bash
#
# infra/backup/restore-pg-encrypted.sh
#
# Restaura un backup cifrado producido por backup-pg-encrypted.sh.
# Dos modos, porque "ensayar la restauración" (C4, revision-seguridad.md)
# tiene que poder hacerse SIN tocar la base de datos real:
#
#   ./restore-pg-encrypted.sh --dry-run <archivo.sql.gz.age>
#       Descifra y restaura en un Postgres EFÍMERO (contenedor nuevo,
#       puerto aparte, se destruye al terminar). No toca rc-supabase-db.
#       Esto es lo que se ejecuta como "ensayo de restauración obligatorio
#       antes de producción" del plan de lanzamiento.
#
#   ./restore-pg-encrypted.sh --real <archivo.sql.gz.age>
#       Restaura SOBRE rc-supabase-db de verdad. Pide confirmación explícita
#       escribiendo la palabra RESTAURAR. Pensado solo para un incidente real
#       de pérdida de datos, no para pruebas.
#
# Requiere: la clave PRIVADA de age en la variable de entorno AGE_IDENTITY_FILE
# (ruta a un fichero con la clave privada, generado con age-keygen). Esa clave
# NO vive en el VPS de forma permanente — para restaurar, Sergio la trae desde
# donde la tenga guardada offline y la borra del host al terminar.
#
set -euo pipefail

MODE="${1:-}"
BACKUP_FILE="${2:-}"

usage() {
  echo "Uso: $0 --dry-run|--real <ruta-al-archivo.sql.gz.age>" >&2
  exit 1
}

[ -n "$MODE" ] && [ -n "$BACKUP_FILE" ] || usage
[ -f "$BACKUP_FILE" ] || { echo "[restore] No existe el archivo: $BACKUP_FILE" >&2; exit 1; }
: "${AGE_IDENTITY_FILE:?Falta AGE_IDENTITY_FILE (ruta al fichero con la clave privada age)}"
[ -f "$AGE_IDENTITY_FILE" ] || { echo "[restore] No existe AGE_IDENTITY_FILE: $AGE_IDENTITY_FILE" >&2; exit 1; }

TMP_SQL="$(mktemp)"
cleanup() { rm -f "$TMP_SQL"; }
trap cleanup EXIT

echo "[restore] Descifrando $BACKUP_FILE ..."
age --decrypt -i "$AGE_IDENTITY_FILE" "$BACKUP_FILE" | gunzip > "$TMP_SQL"
LINES="$(wc -l < "$TMP_SQL")"
echo "[restore] OK: SQL descifrado, ${LINES} líneas."
if [ "$LINES" -lt 5 ]; then
  echo "[restore] ERROR: el SQL descifrado parece vacío o corrupto (${LINES} líneas). Abortando." >&2
  exit 1
fi

case "$MODE" in
  --dry-run)
    DRY_CONTAINER="rc-restore-drill"
    DRY_DB="restore_drill"
    DRY_PORT="55432"
    DRY_PASSWORD="drill-only-$(date +%s)"

    echo "[restore][dry-run] Levantando Postgres efímero '$DRY_CONTAINER' en puerto $DRY_PORT ..."
    docker rm -f "$DRY_CONTAINER" >/dev/null 2>&1 || true
    docker run -d --name "$DRY_CONTAINER" \
      -e POSTGRES_PASSWORD="$DRY_PASSWORD" \
      -e POSTGRES_DB="$DRY_DB" \
      -p "${DRY_PORT}:5432" \
      postgres:17-alpine >/dev/null

    echo "[restore][dry-run] Esperando a que Postgres esté listo ..."
    for i in $(seq 1 30); do
      if docker exec "$DRY_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
        break
      fi
      sleep 1
      if [ "$i" -eq 30 ]; then
        echo "[restore][dry-run] ERROR: Postgres efímero no arrancó a tiempo." >&2
        docker logs "$DRY_CONTAINER" >&2 || true
        docker rm -f "$DRY_CONTAINER" >/dev/null 2>&1 || true
        exit 1
      fi
    done

    echo "[restore][dry-run] Aplicando el dump ..."
    if docker exec -i "$DRY_CONTAINER" psql -U postgres -d "$DRY_DB" -v ON_ERROR_STOP=1 < "$TMP_SQL" >/tmp/restore-drill.log 2>&1; then
      echo "[restore][dry-run] Dump aplicado sin errores."
    else
      echo "[restore][dry-run] ERROR aplicando el dump — ver /tmp/restore-drill.log" >&2
      tail -n 40 /tmp/restore-drill.log >&2
      docker rm -f "$DRY_CONTAINER" >/dev/null 2>&1 || true
      exit 1
    fi

    echo "[restore][dry-run] Verificando que hay tablas y filas reales ..."
    TABLE_COUNT="$(docker exec "$DRY_CONTAINER" psql -U postgres -d "$DRY_DB" -tAc \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
    echo "[restore][dry-run] Tablas en 'public': ${TABLE_COUNT}"

    echo "[restore][dry-run] Ensayo COMPLETO. Contenedor de prueba: $DRY_CONTAINER (puerto $DRY_PORT)."
    echo "[restore][dry-run] Para inspeccionar a mano:  docker exec -it $DRY_CONTAINER psql -U postgres -d $DRY_DB"
    echo "[restore][dry-run] Para destruir el ensayo:    docker rm -f $DRY_CONTAINER"
    ;;

  --real)
    : "${BACKUP_DB_CONTAINER:?Falta BACKUP_DB_CONTAINER (source infra/.env primero)}"
    : "${POSTGRES_DB:?Falta POSTGRES_DB (source infra/.env primero)}"
    echo "############################################################"
    echo "# RESTAURACIÓN REAL sobre el contenedor: ${BACKUP_DB_CONTAINER}"
    echo "# Base de datos: ${POSTGRES_DB}"
    echo "# Esto puede SOBRESCRIBIR datos existentes. No hay deshacer."
    echo "############################################################"
    read -r -p "Escribe RESTAURAR (en mayúsculas) para continuar: " CONFIRM
    if [ "$CONFIRM" != "RESTAURAR" ]; then
      echo "[restore][real] Cancelado por el operador." >&2
      exit 1
    fi
    echo "[restore][real] Aplicando el dump sobre ${BACKUP_DB_CONTAINER} ..."
    docker exec -i "$BACKUP_DB_CONTAINER" psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 < "$TMP_SQL"
    echo "[restore][real] Restauración aplicada. Verificar la aplicación manualmente antes de dar por bueno el incidente."
    ;;

  *)
    usage
    ;;
esac
