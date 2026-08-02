#!/bin/sh

# Fetch and optionally fast-forward GammaLedger from the author's repository.
# Usage: ./scripts/update-from-upstream.sh [remote] [branch]

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REMOTE=${1:-upstream}
BRANCH=${2:-main}
REMOTE_BRANCH="$REMOTE/$BRANCH"

cd "$REPO_ROOT"

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "Error: this script must run inside a Git repository." >&2
    exit 1
fi

current_branch=$(git branch --show-current)
if [ "$current_branch" != "$BRANCH" ]; then
    echo "Error: checked out branch is '$current_branch'; expected '$BRANCH'." >&2
    exit 1
fi

# Do not risk overwriting local edits. Commit or stash them before updating.
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Error: tracked working-tree changes are present." >&2
    echo "Commit or stash them before running this updater." >&2
    git status --short
    exit 1
fi

echo "Fetching $REMOTE_BRANCH..."
git fetch --prune "$REMOTE" "$BRANCH"

local_head=$(git rev-parse HEAD)
remote_head=$(git rev-parse "$REMOTE_BRANCH")

if [ "$local_head" = "$remote_head" ]; then
    echo "Already up to date with $REMOTE_BRANCH."
    exit 0
fi

if ! git merge-base --is-ancestor "$local_head" "$remote_head"; then
    echo "Error: local $BRANCH and $REMOTE_BRANCH have diverged." >&2
    echo "Resolve the branch history manually; no changes were made." >&2
    exit 1
fi

echo "Incoming commits:"
git --no-pager log --oneline --decorate "$local_head..$remote_head"
printf "Apply this fast-forward and rebuild? [y/N] "
read answer

case "$answer" in
    y|Y|yes|YES|Yes) ;;
    *) echo "Update cancelled."; exit 0 ;;
esac

git merge --ff-only "$REMOTE_BRANCH"

echo "Running typecheck and production build..."
npm run build

echo "Update complete."
