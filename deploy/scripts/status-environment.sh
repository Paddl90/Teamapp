#!/usr/bin/env bash
set -euo pipefail

environment="${1:-}"
case "$environment" in
  dev|qs|prd) ;;
  *) echo "Usage: $0 <dev|qs|prd>" >&2; exit 2 ;;
esac

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_dir="$deploy_dir/.runtime/$environment"
environment_file="$deploy_dir/environments/$environment.env"

supabase status --workdir "$runtime_dir"
docker compose \
  --project-name "teamapp-$environment-web" \
  --env-file "$environment_file" \
  -f "$deploy_dir/compose.vps.yml" \
  ps
