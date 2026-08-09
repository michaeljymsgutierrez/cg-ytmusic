#!/usr/bin/env bash
#
# Cut a new release: bump version, run checks, tag, push, and create a
# GitHub release with generated notes.
#
# Usage:
#   ./scripts/release.sh <patch|minor|major|X.Y.Z>
#
# Requires: pnpm, gh (authenticated), a clean working tree on main.

set -euo pipefail

BRANCH_REQUIRED="main"
REMOTE="origin"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

[ $# -eq 1 ] || die "usage: $0 <patch|minor|major|X.Y.Z>"
BUMP="$1"

command -v pnpm >/dev/null 2>&1 || die "pnpm is required"
command -v gh   >/dev/null 2>&1 || die "gh (GitHub CLI) is required"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$CURRENT_BRANCH" = "$BRANCH_REQUIRED" ] || die "must be on '$BRANCH_REQUIRED' (currently on '$CURRENT_BRANCH')"

[ -z "$(git status --porcelain)" ] || die "working tree is not clean; commit or stash first"

log "fetching latest from $REMOTE/$BRANCH_REQUIRED"
git fetch "$REMOTE" "$BRANCH_REQUIRED"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "$REMOTE/$BRANCH_REQUIRED")"
[ "$LOCAL_SHA" = "$REMOTE_SHA" ] || die "local $BRANCH_REQUIRED is not up to date with $REMOTE/$BRANCH_REQUIRED (pull first)"

log "installing dependencies"
pnpm install --frozen-lockfile

log "running typecheck"
pnpm typecheck

log "running tests"
pnpm test

log "running build"
pnpm build

log "bumping version ($BUMP)"
NEW_VERSION="$(pnpm version "$BUMP" --message "chore(release): v%s" | tail -n1)"
TAG="$NEW_VERSION"

echo
log "about to push commit + tag '$TAG' to $REMOTE and create a GitHub release"
read -r -p "Continue? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  log "aborting; rolling back local commit and tag"
  git tag -d "$TAG" >/dev/null 2>&1 || true
  git reset --hard "$LOCAL_SHA"
  die "release cancelled"
fi

log "pushing commit and tag"
git push "$REMOTE" "$BRANCH_REQUIRED"
git push "$REMOTE" "$TAG"

log "creating GitHub release"
PREV_TAG="$(git tag --sort=-creatordate | grep -v "^${TAG}\$" | head -n1 || true)"
if [ -n "$PREV_TAG" ]; then
  gh release create "$TAG" \
    --title "$TAG" \
    --generate-notes \
    --notes-start-tag "$PREV_TAG"
else
  gh release create "$TAG" \
    --title "$TAG" \
    --generate-notes
fi

log "done: $TAG released -> $(gh release view "$TAG" --json url -q .url)"
