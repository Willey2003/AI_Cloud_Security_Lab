#!/usr/bin/env bash
# Sentinel//Lab — one-command GitHub publisher
#
#   bash scripts/publish.sh sentinel-lab            # private (default)
#   bash scripts/publish.sh sentinel-lab --public   # public
#   bash scripts/publish.sh sentinel-lab --org acme # under an org
#
# Requires: git + gh (GitHub CLI). Run `gh auth login` first.
set -euo pipefail

REPO="${1:-sentinel-lab}"
VIS=(--private)
ORG=()

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --public) VIS=(--public); shift ;;
    --org)    ORG=(--org "$2"); shift 2 ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
done

command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }
command -v gh  >/dev/null 2>&1 || { echo "gh (GitHub CLI) required — https://cli.github.com" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "not authenticated — run: gh auth login" >&2; exit 1; }

# 1 — init (idempotent) and hygiene review BEFORE anything leaves the machine
git init -b main >/dev/null 2>&1 || true
echo "== files that will be pushed (review!) =="
git status --porcelain
if git status --porcelain | grep -Ei '\.env|\.key|\.pem|node_modules/|dist/'; then
  echo "✗ refusing: hygiene violation detected (secrets or build output staged)" >&2
  exit 1
fi
read -r -p "looks right? [y/N] " ok
[[ "$ok" =~ ^[Yy]$ ]] || { echo "aborted — nothing pushed"; exit 0; }

# 2 — commit
git add -A
git commit -m "sentinel-lab v0.1 — deterministic triage console, hardened deploy, CI gates" >/dev/null

# 3 — create remote + push (private-first unless --public)
gh repo create "$REPO" "${VIS[@]}" "${ORG[@]}" \
  --description "Defensive AI cloud security analyst console — deterministic triage lab" \
  --source=. --remote=origin --push

# 4 — confirm the CI gates armed
echo "== waiting for the ci workflow to arm =="
sleep 6
gh run list --limit 4 || true

cat <<EOF

✓ published → https://github.com/$(gh api user -q .login 2>/dev/null || echo YOU)/$REPO

next: protect main (Settings → Branches) — require PR review + the four ci checks.
EOF
