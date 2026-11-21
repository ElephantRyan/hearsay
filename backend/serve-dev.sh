#!/bin/sh
# Local development server. The OIDC_* settings are needed only when AUTH_MODE
# isn't `abs`; until the Authentik application exists, set AUTH_MODE=abs in .env.
F="${FIIG:-fiig}"
# One adapter per domain (src/<domain>/<Domain>Api.fiig), served together.
A=abs.recommendations
exec "$F" serve -caps caps.json -env-file .env . \
    $A.sessions.sessionsApi $A.signin.signinApi $A.signin.oidc.oidcApi \
    $A.ratings.ratingsApi $A.ratings.rated.ratedApi $A.library.libraryApi $A.recommendations.recommendationsApi \
    $A.sync.syncApi $A.listening.listeningApi $A.admin.adminApi $A.setup.setupApi $A.health.healthApi
