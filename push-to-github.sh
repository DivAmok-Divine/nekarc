#!/usr/bin/env bash
# Commit and push to GitHub. Prompts for a description (with a sensible default).
# Credentials are read from .git-push.env (git-ignored) — never hard-coded here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [ ! -f .git-push.env ]; then
  echo "✗ Missing .git-push.env (needs GITHUB_USER, GITHUB_TOKEN, REPO, BRANCH)."
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .git-push.env; set +a
REPO="${REPO:-nekarc}"
BRANCH="${BRANCH:-main}"

DEFAULT_MSG="chore: update nekarc ($(date '+%Y-%m-%d %H:%M'))"
printf '📝 Push description [default: "%s"]: ' "$DEFAULT_MSG"
read -r MSG
MSG="${MSG:-$DEFAULT_MSG}"

git add -A
if git diff --cached --quiet; then
  echo "· Nothing to commit — pushing existing commits."
else
  git commit -m "$MSG"
fi

echo "▶ Pushing to github.com/$GITHUB_USER/$REPO ($BRANCH)…"
git push "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO}.git" "HEAD:${BRANCH}"
echo "✅ Pushed to github.com/$GITHUB_USER/$REPO"
