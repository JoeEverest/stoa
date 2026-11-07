#!/usr/bin/env bash
# Copy the HyperFrames reference skills into the app plugin so the teacher can load them
# without the user's own ~/.claude settings.
#
# Source: $HYPERFRAMES_SKILLS_DIR (default ~/.claude/skills). If a skill is missing there,
# `npx hyperframes skills update` installs the set into ~/.claude/skills first.
#
# Left out on purpose:
#   hyperframes         - the router. Its description says it is the "mandatory entry point" for
#                         any video work and it runs an intent interview / approval loop for new
#                         videos. The lesson-video skill owns that process in this app.
#   hyperframes-studio  - the interactive companion / review loop of the router.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/agent/plugin/skills"
SRC="${HYPERFRAMES_SKILLS_DIR:-$HOME/.claude/skills}"
SKILLS=(hyperframes-core hyperframes-cli hyperframes-audio hyperframes-animation hyperframes-keyframes hyperframes-creative)

missing=0
for s in "${SKILLS[@]}"; do [ -f "$SRC/$s/SKILL.md" ] || missing=1; done
if [ "$missing" = 1 ]; then
  echo "Some HyperFrames skills are missing in $SRC; running: npx -y hyperframes skills update"
  npx -y hyperframes skills update "${SKILLS[@]}" < /dev/null || npx -y hyperframes skills update < /dev/null
  SRC="$HOME/.claude/skills"
fi

mkdir -p "$DEST"
for s in "${SKILLS[@]}"; do
  if [ ! -f "$SRC/$s/SKILL.md" ]; then echo "warning: $s not found in $SRC, skipped" >&2; continue; fi
  rm -rf "$DEST/$s"
  cp -RL "$SRC/$s" "$DEST/$s"
  echo "synced $s"
done

# anatomy (MIT, https://github.com/wheresryan22/anatomy): isometric explanatory figures for
# lessons. Copied from $SRC/anatomy when it is installed there, else cloned from GitHub.
# Repository files that the agent does not need (CI, tests, evals) are left out.
ANATOMY_REPO="${ANATOMY_REPO:-https://github.com/wheresryan22/anatomy.git}"
anatomy_src="$SRC/anatomy"
tmp=""
if [ ! -f "$anatomy_src/SKILL.md" ]; then
  tmp="$(mktemp -d)"
  echo "anatomy not found in $SRC; cloning $ANATOMY_REPO"
  git clone --depth 1 "$ANATOMY_REPO" "$tmp/anatomy" >/dev/null 2>&1 || { echo "warning: could not clone anatomy, skipped" >&2; rm -rf "$tmp"; exit 0; }
  anatomy_src="$tmp/anatomy"
fi
rm -rf "$DEST/anatomy"
mkdir -p "$DEST/anatomy"
(cd "$anatomy_src" && tar -cf - --exclude .git --exclude .github --exclude tests --exclude evals --exclude agents --exclude 'scripts/*.test.mjs' .) | (cd "$DEST/anatomy" && tar -xf -)
[ -n "$tmp" ] && rm -rf "$tmp"
echo "synced anatomy"
