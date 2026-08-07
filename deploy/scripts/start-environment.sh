#!/usr/bin/env bash
set -euo pipefail

environment="${1:-}"
deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "$deploy_dir/.." && pwd)"
runtime_dir="$($deploy_dir/scripts/prepare-environment.sh "$environment")"
environment_file="$deploy_dir/environments/$environment.env"

set -a
source "$environment_file"
set +a

supabase start --workdir "$runtime_dir"

publishable_key="$(
  supabase status --workdir "$runtime_dir" -o env |
    sed -n 's/^PUBLISHABLE_KEY=//p' |
    tr -d '"'
)"

if [[ -z "$publishable_key" ]]; then
  echo "Supabase publishable key is missing" >&2
  exit 1
fi

export EXPO_PUBLIC_SUPABASE_URL="http://$TEAMAPP_BIND_IP:$SUPABASE_API_PORT"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$publishable_key"

cd "$repo_dir"
docker compose \
  --project-name "$TEAMAPP_COMPOSE_PROJECT" \
  --env-file "$environment_file" \
  -f deploy/compose.vps.yml \
  up -d --build

printf 'Web: http://%s:%s\n' "$TEAMAPP_BIND_IP" "$TEAMAPP_WEB_PORT"
printf 'Studio: http://%s:%s\n' "$TEAMAPP_BIND_IP" "$SUPABASE_STUDIO_PORT"
