#!/bin/sh
# Runs a command with .env.local loaded into the environment.
#
# The Supabase CLI reads SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF from the
# environment, but knows nothing about .env.local. Without this, `yarn db:link`
# would expand $SUPABASE_PROJECT_REF to an empty string and quietly do the wrong
# thing.
#
# Keeping the values in .env.local rather than passing them as flags means no
# secret ends up in shell history or in a terminal transcript, and the file is
# already gitignored.
#
#   ./scripts/with-env.sh npx supabase projects list

set -e

if [ -f .env.local ]; then
  # `set -a` exports everything defined while it is on.
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

exec "$@"
