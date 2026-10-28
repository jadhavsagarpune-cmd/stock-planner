#!/usr/bin/env bash
# Production deploy to Vercel (personal stock-planner only).
# Requires VERCEL_TOKEN from https://vercel.com/account/tokens
set -euo pipefail
cd "$(dirname "$0")"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Set VERCEL_TOKEN first (Vercel → Settings → Tokens)."
  echo "  export VERCEL_TOKEN='...'"
  echo "Or run from your laptop: npx vercel login && npx vercel --prod"
  echo "Or import GitHub in browser: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjadhavsagarpune-cmd%2Fstock-planner"
  exit 1
fi

# Marvell lab proxy often breaks vercel CLI; bypass for this command only.
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
  sh -c 'npm run build && npx vercel link --yes && npx vercel deploy --prebuilt --prod --yes'
