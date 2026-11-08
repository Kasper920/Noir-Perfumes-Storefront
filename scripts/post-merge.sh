#!/bin/bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm run typecheck:libs
# NOIR uses externally managed Supabase migrations (supabase/migrations).
# Do not push the unused Replit database or reseed inventory during a merge.
