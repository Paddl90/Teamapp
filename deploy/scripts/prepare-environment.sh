#!/usr/bin/env bash
set -euo pipefail

environment="${1:-}"
case "$environment" in
  dev|qs|prd) ;;
  *) echo "Usage: $0 <dev|qs|prd>" >&2; exit 2 ;;
esac

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "$deploy_dir/.." && pwd)"
environment_file="$deploy_dir/environments/$environment.env"
runtime_dir="$deploy_dir/.runtime/$environment"

set -a
source "$environment_file"
set +a

mkdir -p "$runtime_dir/supabase/migrations"
cp "$repo_dir"/supabase/migrations/*.sql "$runtime_dir/supabase/migrations/"
cp "$repo_dir/supabase/seed.sql" "$runtime_dir/supabase/seed.sql"

analytics_port=$((SUPABASE_API_PORT + 6))
sed \
  -e "s/__PROJECT_ID__/$TEAMAPP_PROJECT_ID/g" \
  -e "s/__BIND_IP__/$TEAMAPP_BIND_IP/g" \
  -e "s/__WEB_PORT__/$TEAMAPP_WEB_PORT/g" \
  -e "s/__API_PORT__/$SUPABASE_API_PORT/g" \
  -e "s/__DB_PORT__/$SUPABASE_DB_PORT/g" \
  -e "s/__STUDIO_PORT__/$SUPABASE_STUDIO_PORT/g" \
  -e "s/__MAIL_PORT__/$SUPABASE_MAIL_PORT/g" \
  -e "s/__SHADOW_PORT__/$SUPABASE_SHADOW_PORT/g" \
  -e "s/__INSPECTOR_PORT__/$SUPABASE_INSPECTOR_PORT/g" \
  -e "s/__ANALYTICS_PORT__/$analytics_port/g" \
  "$deploy_dir/supabase/config.toml.tpl" > "$runtime_dir/supabase/config.toml"

printf '%s\n' "$runtime_dir"
