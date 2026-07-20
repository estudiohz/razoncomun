#!/usr/bin/env bash
#
# infra/backup/backup-pg-encrypted.sh
#
# pg_dump diario del Postgres de Supabase self-hosted, cifrado con age antes
# de tocar ningún almacenamiento externo (C4, revision-seguridad.md).
#
# Se ejecuta en el HOST del VPS (no dentro de un contenedor), vía cron, y
# habla con la base de datos a través de `docker exec` sobre el contenedor
# rc-supabase-db definido en infra/docker-compose.supabase.yml.
#
# Requisitos en el host:
#   - docker (el mismo VPS donde corre el compose)
#   - age            (apt install age  /  https://github.com/FiloSottile/age)
#   - gzip (viene de serie en cualquier Linux)
#
# Uso:
#   source infra/.env && infra/backup/backup-pg-encrypted.sh
#   (o instalar via crontab -e, ver infra/GUIA-DOKPLOY.md §7)
#
# Salida: $BACKUP_DIR/daily/rc-supabase-YYYYmmdd-HHMMSS.sql.gz.age
#         (+ copia en $BACKUP_DIR/monthly/ el día 1 de cada mes)
#
set -euo pipefail

# ── Variables (deben venir de infra/.env, vía `source`, o exportadas antes) ──
: "${BACKUP_DB_CONTAINER:?Falta BACKUP_DB_CONTAINER (ver infra/.env.example §12)}"
: "${BACKUP_DIR:?Falta BACKUP_DIR (ver infra/.env.example §12)}"
: "${AGE_RECIPIENT_PUBLIC_KEY:?Falta AGE_RECIPIENT_PUBLIC_KEY (ver infra/.env.example §12)}"
: "${POSTGRES_DB:?Falta POSTGRES_DB}"
: "${BACKUP_RETENTION_DAILY:=30}"
: "${BACKUP_RETENTION_MONTHLY:=12}"

# Postgres corre dentro del contenedor autenticado como superusuario "postgres"
# vía peer auth local (POSTGRES_HOST=/var/run/postgresql en el compose), así
# que no hace falta la contraseña para el `docker exec`.
PG_DUMP_USER="postgres"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
DAY_OF_MONTH="$(date -u +%d)"
DAILY_DIR="${BACKUP_DIR}/daily"
MONTHLY_DIR="${BACKUP_DIR}/monthly"
FILENAME="rc-supabase-${TIMESTAMP}.sql.gz.age"

mkdir -p "$DAILY_DIR" "$MONTHLY_DIR"

echo "[backup] $(date -u --iso-8601=seconds) — iniciando volcado de '${POSTGRES_DB}' desde ${BACKUP_DB_CONTAINER}"

# pg_dump en formato plano SQL (-Fp) para que la restauración no dependa de
# tener pg_restore de una versión compatible — cualquier psql lo aplica.
# Se cifra con age ANTES de que el contenido salga a disco sin cifrar, todo
# en una sola tubería (nunca existe un .sql.gz sin cifrar en el filesystem).
if ! docker exec -i "$BACKUP_DB_CONTAINER" \
    pg_dump -U "$PG_DUMP_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
  | gzip -9 \
  | age -r "$AGE_RECIPIENT_PUBLIC_KEY" -o "${DAILY_DIR}/${FILENAME}"; then
  echo "[backup] ERROR: el volcado falló. No se ha creado ningún archivo válido." >&2
  # Limpieza de un archivo parcial si age llegó a crearlo antes de fallar.
  rm -f "${DAILY_DIR}/${FILENAME}"
  exit 1
fi

SIZE_BYTES="$(stat -c%s "${DAILY_DIR}/${FILENAME}" 2>/dev/null || stat -f%z "${DAILY_DIR}/${FILENAME}")"
if [ "$SIZE_BYTES" -lt 100 ]; then
  echo "[backup] ERROR: el archivo cifrado tiene ${SIZE_BYTES} bytes — sospechosamente pequeño, probable volcado vacío." >&2
  exit 1
fi
echo "[backup] OK: ${DAILY_DIR}/${FILENAME} (${SIZE_BYTES} bytes)"

# Copia mensual: el día 1 de cada mes, conservar también en monthly/.
if [ "$DAY_OF_MONTH" = "01" ]; then
  cp "${DAILY_DIR}/${FILENAME}" "${MONTHLY_DIR}/${FILENAME}"
  echo "[backup] Copia mensual guardada en ${MONTHLY_DIR}/${FILENAME}"
fi

# ── Retención ──
# Diarios: conservar solo los BACKUP_RETENTION_DAILY más recientes.
find "$DAILY_DIR" -maxdepth 1 -name '*.sql.gz.age' -type f -printf '%T@ %p\n' 2>/dev/null \
  | sort -rn \
  | awk -v keep="$BACKUP_RETENTION_DAILY" 'NR>keep {print $2}' \
  | while IFS= read -r old; do
      echo "[backup] Borrando diario expirado: $old"
      rm -f -- "$old"
    done

# Mensuales: conservar solo los BACKUP_RETENTION_MONTHLY más recientes.
find "$MONTHLY_DIR" -maxdepth 1 -name '*.sql.gz.age' -type f -printf '%T@ %p\n' 2>/dev/null \
  | sort -rn \
  | awk -v keep="$BACKUP_RETENTION_MONTHLY" 'NR>keep {print $2}' \
  | while IFS= read -r old; do
      echo "[backup] Borrando mensual expirado: $old"
      rm -f -- "$old"
    done

echo "[backup] $(date -u --iso-8601=seconds) — terminado."

# ── Copia externa semanal (recomendada, no automatizada por este script) ──
# stack-y-despliegue.md pide "copia externa semanal" además de la local.
# Este script deliberadamente NO sube nada a un tercero (evita atar la
# infra a un proveedor concreto sin decisión de Sergio). Opciones de coste
# cero para completar esto manualmente o en un cron aparte:
#   - rclone (Backblaze B2 free tier 10GB, o el propio Google Drive)
#   - rsync a otra máquina bajo control del partido
# El archivo ya está cifrado con age: subirlo tal cual a cualquier proveedor
# no añade riesgo adicional (ver C4/C5 en revision-seguridad.md).
