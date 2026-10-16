#!/usr/bin/env bash
# Executes the real deployment script against a deterministic fake Docker command.
set -Eeuo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
root=$(mktemp -d)
trap 'rm -rf -- "$root"' EXIT
old=1111111111111111111111111111111111111111
new=2222222222222222222222222222222222222222
mkdir -p "$root/releases/$old/deploy" "$root/releases/$new/deploy" "$root/bin"
for tag in "$old" "$new"; do
 cp "$repo/deploy/deploy.sh" "$root/releases/$tag/deploy/"
 cp "$repo/compose.yaml" "$root/releases/$tag/"
 printf '%s\n' ghcr.io/example/tracker > "$root/releases/$tag/.image-prefix"
done
touch "$root/.env"
ln -s "$root/releases/$old" "$root/current"
cat > "$root/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
printf '%s %s\n' "$IMAGE_TAG" "$*" >> "$DEPLOY_ROOT/calls"
if [[ "$*" == *' up '* && "$IMAGE_TAG" == 2222222222222222222222222222222222222222 ]]; then exit 1; fi
DOCKER
chmod +x "$root/bin/docker"
export DEPLOY_ROOT="$root" PATH="$root/bin:$PATH"
if bash "$root/releases/$new/deploy/deploy.sh" ghcr.io/example/tracker; then echo 'Expected failed deployment'; exit 1; fi
grep -q "$old.*up -d --no-build --wait" "$root/calls"
test "$(readlink -f "$root/current")" = "$root/releases/$old"
echo 'PASS: deployment health failure restores previous images and release'
