#!/bin/sh

# Fetch and merge GammaLedger updates from the author's repository.
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

echo "Fetching $REMOTE_BRANCH and release tags..."
git fetch --prune --tags "$REMOTE" "$BRANCH"

local_head=$(git rev-parse HEAD)
remote_head=$(git rev-parse "$REMOTE_BRANCH")

if [ "$local_head" = "$remote_head" ]; then
    echo "Already up to date with $REMOTE_BRANCH."
    echo "Release tags are up to date. Restart npm run dev if the displayed version is stale."
    exit 0
fi

if git merge-base --is-ancestor "$remote_head" "$local_head"; then
    echo "Local $BRANCH already contains $REMOTE_BRANCH."
    echo "Local-only commits are ahead; no update is needed."
    echo "Release tags are up to date. Restart npm run dev if the displayed version is stale."
    exit 0
fi

merge_base=$(git merge-base "$local_head" "$remote_head")
if git merge-base --is-ancestor "$local_head" "$remote_head"; then
    update_kind="fast-forward"
else
    update_kind="merge"
fi

echo "Incoming commits:"
git --no-pager log --oneline --decorate "$merge_base..$remote_head"
printf "Apply this %s and rebuild? [y/N] " "$update_kind"
read answer

case "$answer" in
    y|Y|yes|YES|Yes) ;;
    *) echo "Update cancelled."; exit 0 ;;
esac

dependencies_changed=false
if ! git diff --quiet "$merge_base" "$remote_head" -- package.json package-lock.json; then
    dependencies_changed=true
fi

if [ "$update_kind" = "fast-forward" ]; then
    git merge --ff-only "$REMOTE_BRANCH"
else
    echo "Merging upstream while preserving local commits..."
    if ! git merge --no-edit "$REMOTE_BRANCH"; then
        echo "Error: the merge has conflicts that need manual resolution." >&2
        echo "Run git status to see them, or git merge --abort to return to the pre-update state." >&2
        exit 1
    fi
fi

if [ "$dependencies_changed" = true ]; then
    echo "Dependency files changed; installing updated dependencies..."
    npm install
fi

echo "Running typecheck and production build..."
npm run build

echo "Update complete."
echo "If npm run dev is already running, stop and restart it to load the new build version."
