#!/usr/bin/env bash
set -euo pipefail

model="${1:-gpt-4o-mini}"

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' "npm was not found. Install Node.js and npm, then try again." >&2
  exit 1
fi

if [[ ! -t 0 ]]; then
  printf '%s\n' "Run this script in an interactive terminal so the API key can be entered securely." >&2
  exit 1
fi

read -r -s -p "OpenAI API key (input is hidden): " OPENAI_API_KEY
printf '\n'
if [[ -z "$OPENAI_API_KEY" ]]; then
  printf '%s\n' "An API key is required to run the real-provider evaluation." >&2
  exit 1
fi

cd "$(dirname "${BASH_SOURCE[0]}")"
trap 'unset OPENAI_API_KEY OPENAI_MODEL' EXIT
OPENAI_API_KEY="$OPENAI_API_KEY" OPENAI_MODEL="$model" npm run evaluate
