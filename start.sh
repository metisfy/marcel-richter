#!/usr/bin/env bash
# Rollt eine Fassung der Website aus – oder zurück.
#
#   ./start.sh <commit-sha>   genau diese Fassung ausrollen (Deploy/Rollback)
#   ./start.sh                Fassung aus .env (IMAGE_TAG) neu ziehen und starten
#   ./start.sh --list         lokal vorhandene Fassungen anzeigen
#
# Wird von GitHub Actions per SSH aufgerufen, funktioniert aber genauso von
# Hand. Wird die neue Fassung nicht „healthy“, startet automatisch wieder die
# vorherige – und das Skript endet mit Fehler.
set -euo pipefail
cd "$(dirname "$0")"

NAME=marcel-richter
IMAGE=ghcr.io/metisfy/marcel-richter
ENV_FILE=.env
KEEP_IMAGES=5

current_tag() {
  grep -E '^IMAGE_TAG=' "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- || true
}

set_tag() {
  touch "$ENV_FILE"
  if grep -qE '^IMAGE_TAG=' "$ENV_FILE"; then
    sed -i.bak "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
  else
    echo "IMAGE_TAG=$1" >>"$ENV_FILE"
  fi
}

wait_healthy() {
  local state=unknown
  echo -n "→ Warte auf „healthy“ "
  for _ in $(seq 1 60); do
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$NAME" 2>/dev/null || echo missing)"
    case "$state" in
      healthy | no-healthcheck)
        echo " ✓"
        return 0
        ;;
      unhealthy | missing)
        break
        ;;
    esac
    echo -n "."
    sleep 2
  done
  echo " ✗ (Zustand: $state)"
  return 1
}

if [ "${1:-}" = "--list" ]; then
  echo "Aktiv: $(current_tag || true)"
  docker images "$IMAGE" --format 'table {{.Tag}}\t{{.CreatedSince}}\t{{.Size}}'
  exit 0
fi

previous="$(current_tag)"
requested="${1:-}"

if [ -n "$requested" ]; then
  if ! [[ "$requested" =~ ^[0-9a-f]{40}$ || "$requested" == "latest" ]]; then
    echo "✗ Ungültiger Tag „${requested}“ – erwartet wird der volle Commit-SHA (40 Zeichen) oder „latest“."
    echo "  Den vollen SHA liefert z. B.: git rev-parse <kurzer-sha>"
    exit 1
  fi
  set_tag "$requested"
fi

target="$(current_tag)"
target="${target:-latest}"
echo "→ Fassung: $target (vorher: ${previous:-keine})"

echo "→ Image holen"
docker compose pull

echo "→ Container ersetzen"
docker compose up -d --remove-orphans

if ! wait_healthy; then
  echo "✗ Die neue Fassung startet nicht sauber. Letzte Logzeilen:"
  docker compose logs --tail=50 web || true
  if [ -n "$previous" ] && [ "$previous" != "$target" ]; then
    echo "↩ Automatischer Rollback auf $previous"
    set_tag "$previous"
    docker compose up -d --remove-orphans
    if wait_healthy; then
      echo "✓ Vorherige Fassung $previous läuft wieder."
    else
      echo "✗ Auch die vorherige Fassung startet nicht – bitte manuell prüfen!"
    fi
  fi
  exit 1
fi

# Aufräumen: die letzten $KEEP_IMAGES Fassungen bleiben lokal liegen
# (schneller Rollback auch ohne Registry), ältere werden gelöscht.
docker images "$IMAGE" --format '{{.Repository}}:{{.Tag}}' |
  grep -v -e ':latest$' -e ":${target}\$" -e ':<none>$' |
  tail -n +$((KEEP_IMAGES + 1)) |
  xargs -r docker rmi >/dev/null 2>&1 || true
docker image prune -f >/dev/null

echo "✓ Läuft: $NAME @ $target"
