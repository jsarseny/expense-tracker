#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=${DEPLOY_ROOT:-/opt/expense-tracker}
RELEASE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TAG=$(basename "$RELEASE")
PREFIX=${1:?Usage: deploy.sh ghcr.io/owner/repository}
[[ "$TAG" =~ ^[a-f0-9]{40}$ ]] || { echo 'Release directory must be a commit SHA'; exit 1; }
[[ "$PREFIX" =~ ^ghcr.io/[a-z0-9._/-]+$ ]] || exit 1
test -f "$ROOT/.env"
exec 9>"$ROOT/deploy.lock"
flock -w 300 9
PREVIOUS=$(readlink -f "$ROOT/current" || true)
printf '%s\n' "$PREFIX" > "$RELEASE/.image-prefix"
export IMAGE_PREFIX="$PREFIX" IMAGE_TAG="$TAG"
compose() { docker compose --project-name expense-tracker --env-file "$ROOT/.env" -f "$RELEASE/compose.yaml" --profile monitoring "$@"; }
compose config --quiet
compose pull
rollback() {
 trap - ERR
 echo 'Deployment failed; restoring previous release'
 if [[ -n "$PREVIOUS" && -f "$PREVIOUS/compose.yaml" && -f "$PREVIOUS/.image-prefix" ]]; then
  export IMAGE_TAG="$(basename "$PREVIOUS")" IMAGE_PREFIX="$(cat "$PREVIOUS/.image-prefix")"
  docker compose --project-name expense-tracker --env-file "$ROOT/.env" -f "$PREVIOUS/compose.yaml" --profile monitoring up -d --no-build --wait --wait-timeout 180
  echo "Restored $IMAGE_TAG"
 else
  echo 'No previous release; inspect docker compose logs and retry after fixing the cause'
 fi
 exit 1
}
trap rollback ERR
compose up -d --no-build --wait --wait-timeout 180
compose exec -T api node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ln -sfn "$RELEASE" "$ROOT/current"
trap - ERR
echo "Deployed $TAG"
