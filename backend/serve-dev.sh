#!/bin/sh
# Local development server. Placeholders stand in for OIDC settings until the
# Authentik application exists; real values in .env win over them.
F="${FIIG:-fiig}"
export OIDC_ISSUER="${OIDC_ISSUER:-https://authentik.example.com/application/o/audiobookshelf/}"
export OIDC_CLIENT_ID="${OIDC_CLIENT_ID:-placeholder}"
export OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:-placeholder}"
export ABS_SERVICE_TOKEN="${ABS_SERVICE_TOKEN:-placeholder}"
exec "$F" serve -caps caps.json -env-file .env . api
