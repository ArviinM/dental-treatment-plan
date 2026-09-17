#!/bin/sh
# Creates the first admin account.
#
# Solves the chicken and egg: only an admin can create accounts in the app, so
# the first one has to be minted outside it. Run this once, hand the password
# over, and everyone after that is created from /admin/accounts.
#
#   ./scripts/create-admin.sh "Ericka Reyes" ericka@siadental.com.au
#
# The password is generated here and printed once. It is never stored, and
# must_change_password is set, so the account is forced to pick its own on first
# sign-in — which means a password passing briefly through a terminal is fine.

set -e

FULL_NAME="$1"
EMAIL="$2"

if [ -z "$FULL_NAME" ] || [ -z "$EMAIL" ]; then
  echo "usage: ./scripts/create-admin.sh \"Full Name\" email@example.com" >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "No .env.local. Copy .env.example and fill it in first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local." >&2
  exit 1
fi

# Readable rather than maximally random: someone will read this down a phone or
# write it on paper, so no ambiguous characters and no symbols to describe.
# It is single-use — the account must change it at first sign-in.
WORDS="Molar Canine Enamel Incisor Bracket Fluoride Crown Veneer"
WORD=$(printf '%s' "$WORDS" | tr ' ' '\n' | sed -n "$(( (RANDOM % 8) + 1 ))p")
DIGITS=$(( (RANDOM % 9000) + 1000 ))
PASSWORD="${WORD}${DIGITS}"

RESPONSE=$(curl -s -w '\n%{http_code}' -X POST "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"email_confirm\": true,
    \"user_metadata\": { \"full_name\": \"${FULL_NAME}\" },
    \"app_metadata\": { \"role\": \"admin\", \"must_change_password\": true }
  }")

STATUS=$(printf '%s' "$RESPONSE" | tail -n1)
BODY=$(printf '%s' "$RESPONSE" | sed '$d')

if [ "$STATUS" != "200" ] && [ "$STATUS" != "201" ]; then
  echo "Could not create the account (HTTP ${STATUS})." >&2
  echo "$BODY" >&2
  exit 1
fi

echo
echo "Admin account created."
echo "  Name:     ${FULL_NAME}"
echo "  Email:    ${EMAIL}"
echo "  Password: ${PASSWORD}"
echo
echo "This password is shown once and is not stored anywhere."
echo "Signing in with it forces a password change straight away."
echo
