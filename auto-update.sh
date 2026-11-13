#!/usr/bin/env bash
# Rollt automatisch die neueste Fassung aus, sobald GitHub Actions ein neues
# Image gebaut hat. Für cron gedacht (alle 5 Minuten), siehe README →
# „Automatisch ausrollen“:
#
#   */5 * * * * /root/websites/intern/marcel-richter/auto-update.sh >> /var/log/marcel-richter-update.log 2>&1
#
# Ablauf: :latest ziehen → Commit aus dem Image-Label lesen → ist er neu,
# ./start.sh <commit> (mit Healthcheck und automatischem Rollback). Scheitert
# eine Fassung, wird sie gemerkt und nicht alle 5 Minuten erneut versucht –
# erst der nächste Push (neuer Commit) wird wieder ausgerollt.
set -euo pipefail
cd "$(dirname "$0")"

IMAGE=ghcr.io/metisfy/marcel-richter
FAILED_FILE=.auto-update-failed

# Nur ein Lauf gleichzeitig (falls ein Rollout länger als 5 Minuten dauert)
exec 9>/tmp/marcel-richter-auto-update.lock
flock -n 9 || exit 0

docker pull --quiet "$IMAGE:latest" >/dev/null
latest="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGE:latest")"
current="$(grep -E '^IMAGE_TAG=' .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"

if ! [[ "$latest" =~ ^[0-9a-f]{40}$ ]]; then
  echo "$(date '+%F %T') ✗ Image :latest enthält keinen Commit im Label – nichts ausgerollt."
  exit 1
fi
[ "$latest" = "$current" ] && exit 0
if [ -f "$FAILED_FILE" ] && [ "$(cat "$FAILED_FILE")" = "$latest" ]; then
  exit 0
fi

echo "$(date '+%F %T') → Neue Fassung $latest (läuft: ${current:-keine})"
if ./start.sh "$latest"; then
  rm -f "$FAILED_FILE"
  echo "$(date '+%F %T') ✓ Ausgerollt: $latest"
else
  echo "$latest" >"$FAILED_FILE"
  echo "$(date '+%F %T') ✗ Fassung $latest startet nicht sauber – vorherige läuft weiter, wird nicht erneut versucht."
  exit 1
fi
