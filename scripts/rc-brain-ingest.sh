#!/usr/bin/env bash
# scripts/rc-brain-ingest.sh
#
# Atajo de desarrollo para lanzar el job de ingesta del RC-Brain sin pasar
# por Docker (útil en el VPS mismo, con acceso directo a Ollama, o para
# revisar la lógica). La lógica real vive en lib/brain/ingest/ — este script
# solo evita tener que recordar el `cd` + variables de entorno.
#
# Uso:
#   scripts/rc-brain-ingest.sh                     # ingesta real (manifiesto+docs)
#   scripts/rc-brain-ingest.sh --dry-run
#   scripts/rc-brain-ingest.sh control-questions    # corre src/controlQuestions.mjs
#
# Requiere lib/brain/ingest/.env poblado (copiar de .env.example) o las
# variables ya exportadas en el entorno (p.ej. por Dokploy).

set -euo pipefail
cd "$(dirname "$0")/../lib/brain/ingest"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ "${1:-}" = "control-questions" ]; then
  exec node src/controlQuestions.mjs
else
  exec node src/index.mjs --sources=manifiesto,docs "$@"
fi
