#!/usr/bin/env bash
# Push stock-planner to personal GitHub (NOT Marvell). Run once after: gh auth login
set -euo pipefail
cd "$(dirname "$0")"
USER="${GITHUB_USER:-jadhavsagarpune-cmd}"
REPO="${USER}/stock-planner"

if ! gh auth status -h github.com &>/dev/null; then
  echo "Run first: gh auth login  (sign in as ${USER})"
  exit 1
fi

gh auth setup-git -h github.com 2>/dev/null || true

logged=$(gh api user -q .login 2>/dev/null || true)
if [[ -n "$logged" && "$logged" != "$USER" ]]; then
  echo "gh is logged in as ${logged}, not ${USER}. Run: gh auth logout && gh auth login"
  exit 1
fi

if git remote get-url origin &>/dev/null; then
  echo "origin already set: $(git remote get-url origin)"
else
  gh repo create "$REPO" --public --description "Standalone semiconductor watchlist (mobile-friendly)" 2>/dev/null || true
  git remote add origin "https://github.com/${REPO}.git"
fi

git push -u origin main
echo ""
echo "Repo: https://github.com/${REPO}"
echo "Vercel import: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F${USER}%2Fstock-planner"
