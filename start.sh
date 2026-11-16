#!/usr/bin/env bash
# Rollt eine Fassung der Website aus – oder zurück.
#
#   ./start.sh <commit-sha>   genau diese Fassung ausrollen (Deploy/Rollback)
#   ./start.sh                Fassung aus .env (IMAGE_TAG) neu ziehen und starten
#   ./start.sh --list         lokal vorhandene Fassungen anzeigen
#   ./start.sh --einrichtung-zuruecksetzen [<commit-sha>]
#                             Admin-Bereich neu einrichten (Datenbankverbindung
#                             und Markierung weg, App-Geheimnis bleibt)
#
# Vor dem Start holt sich das Skript docker-compose.yml, auto-update.sh und
# sich selbst passend zum Commit von GitHub (öffentliches Repository). Ist
# GitHub nicht erreichbar, bleibt es bei den vorhandenen Dateien.
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
VOLUME=marcel-richter-daten
APP_USER=1000
REPO_RAW=https://raw.githubusercontent.com/metisfy/marcel-richter
ORIGINAL_ARGS=("$@")

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

# docker-compose.yml, auto-update.sh und start.sh zum Commit passend holen.
# start.sh wird per Umbenennen ersetzt (die laufende Fassung liest ungestört
# weiter) und danach neu gestartet.
sync_files() {
  local ref="$1"
  [[ "$ref" =~ ^[0-9a-f]{40}$ ]] || return 0
  [ "${START_SH_SYNCED:-}" = "1" ] && return 0
  command -v curl >/dev/null 2>&1 || return 0
  local tmp f self_updated=0
  tmp="$(mktemp -d ./.sync.XXXXXX)"
  for f in docker-compose.yml auto-update.sh start.sh; do
    if ! curl -fsL --max-time 20 "$REPO_RAW/$ref/$f" -o "$tmp/$f" || [ ! -s "$tmp/$f" ]; then
      echo "→ Dateien zu $ref nicht von GitHub erreichbar – bleibe bei den vorhandenen."
      rm -rf "$tmp"
      return 0
    fi
  done
  for f in docker-compose.yml auto-update.sh start.sh; do
    if ! cmp -s "$tmp/$f" "$f" 2>/dev/null; then
      [[ "$f" == *.sh ]] && chmod +x "$tmp/$f"
      mv "$tmp/$f" "$f"
      echo "→ $f aktualisiert"
      [ "$f" = start.sh ] && self_updated=1
    fi
  done
  rm -rf "$tmp"
  if [ "$self_updated" = 1 ]; then
    echo "→ Starte die neue Fassung von start.sh"
    START_SH_SYNCED=1 exec ./start.sh ${ORIGINAL_ARGS[@]+"${ORIGINAL_ARGS[@]}"}
  fi
}

if [ "${1:-}" = "--list" ]; then
  echo "Aktiv: $(current_tag || true)"
  docker images "$IMAGE" --format 'table {{.Tag}}\t{{.CreatedSince}}\t{{.Size}}'
  exit 0
fi

reset_setup=0
if [ "${1:-}" = "--einrichtung-zuruecksetzen" ]; then
  reset_setup=1
  shift
fi

previous="$(current_tag)"
requested="${1:-}"

if [ -n "$requested" ]; then
  if ! [[ "$requested" =~ ^[0-9a-f]{40}$ || "$requested" == "latest" ]]; then
    echo "✗ Ungültiger Tag „${requested}“ – erwartet wird der volle Commit-SHA (40 Zeichen) oder „latest“."
    echo "  Den vollen SHA liefert z. B.: git rev-parse <kurzer-sha>"
    exit 1
  fi
fi

# Vor dem Umstellen der .env – nach einem Neustart des Skripts stimmt
# „vorher“ sonst nicht mehr (und der automatische Rollback ginge ins Leere).
sync_files "${requested:-$previous}"

[ -n "$requested" ] && set_tag "$requested"

target="$(current_tag)"
target="${target:-latest}"
echo "→ Fassung: $target (vorher: ${previous:-keine})"

echo "→ Image holen"
docker compose pull

# Ablage des Admin-Bereichs: Volume anlegen (idempotent) und dem
# Anwendungsbenutzer geben – sonst scheitert die Einrichtung an
# „Permission denied“, ohne dass ein Container ausfällt.
docker volume create "$VOLUME" >/dev/null
docker run --rm --user root --entrypoint sh -v "$VOLUME":/daten "$IMAGE:$target" \
  -c "chown -R $APP_USER:$APP_USER /daten && chmod 700 /daten" >/dev/null

if [ "$reset_setup" = 1 ]; then
  docker run --rm --user root --entrypoint sh -v "$VOLUME":/daten "$IMAGE:$target" \
    -c "rm -f /daten/datenbank.json /daten/eingerichtet /daten/einrichtungsschluessel" >/dev/null
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  echo "→ Einrichtung verworfen – gleich steht wieder der Assistent."
fi

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

# Ersteinrichtung: Solange die Markierung fehlt, den Schlüssel zeigen
if ! docker exec "$NAME" test -f /app/data/eingerichtet 2>/dev/null; then
  key=""
  for _ in $(seq 1 10); do
    key="$(docker exec "$NAME" cat /app/data/einrichtungsschluessel 2>/dev/null || true)"
    [ -n "$key" ] && break
    sleep 1
  done
  echo
  echo "→ ERSTEINRICHTUNG: Der Admin-Bereich ist noch nicht eingerichtet."
  echo "  Im Browser öffnen:      http://<server>:${HOST_PORT:-3100}/admin  (oder https://admin.<domain>)"
  echo "  Einrichtungsschlüssel:  ${key:-<noch nicht erzeugt – docker logs $NAME>}"
  echo
fi
