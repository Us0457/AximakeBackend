#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./scripts/git_push.sh [remote] [branch] [repo_url]
# Examples:
#  ./scripts/git_push.sh origin main git@github.com:you/your-repo.git
#  ./scripts/git_push.sh origin main https://github.com/you/your-repo.git

REMOTE=${1:-origin}
BRANCH=${2:-main}
REPO_URL=${3:-}

echo "[git_push] remote=$REMOTE branch=$BRANCH repo_url=${REPO_URL:-<not provided>}"

if ! command -v git >/dev/null 2>&1; then
  echo "git not found. Install git and retry." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install Node.js/npm and retry." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "No git repo found — initializing"
  git init
fi

if [ -n "$REPO_URL" ]; then
  if git remote get-url "$REMOTE" >/dev/null 2>&1; then
    echo "Remote '$REMOTE' already exists: $(git remote get-url $REMOTE)"
  else
    git remote add "$REMOTE" "$REPO_URL"
    echo "Added remote '$REMOTE' -> $REPO_URL"
  fi
fi

git checkout -B "$BRANCH"

echo "Running npm install to ensure lockfile is up-to-date..."
npm install

echo "Staging changes..."
git add --all

if git diff --staged --quiet; then
  echo "No staged changes to commit. Skipping commit."
else
  git commit -m "chore: update lockfile and prepare for deploy"
fi

echo "Pushing to $REMOTE/$BRANCH..."
git push -u "$REMOTE" "$BRANCH"

echo "Done. Remote URL: $(git remote get-url $REMOTE 2>/dev/null || echo 'not set')"
