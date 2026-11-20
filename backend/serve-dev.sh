#!/bin/sh
# Local development server. Placeholders stand in for OIDC settings until the
# Authentik application exists; real values in .env win over them.
F="${FIIG:-fiig}"
export OIDC_ISSUER="${OIDC_ISSUER:-https://authentik.example.com/application/o/audiobookshelf/}"
export OIDC_CLIENT_ID="${OIDC_CLIENT_ID:-placeholder}"
export OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:-placeholder}"
export ABS_SERVICE_TOKEN="${ABS_SERVICE_TOKEN:-placeholder}"
# One adapter per domain (src/<domain>/<Domain>Api.fiig), served together.
A=abs.recommendations
exec "$F" serve -caps caps.json -env-file .env . \
    $A.sessions.sessionsApi $A.signin.signinApi $A.signin.oidc.oidcApi \
    $A.ratings.ratingsApi $A.ratings.rated.ratedApi $A.library.libraryApi $A.recommendations.recommendationsApi \
    $A.sync.syncApi $A.health.healthApi
