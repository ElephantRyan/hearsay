# Hearsay's API and its hourly sync: the fiig runtime with Hearsay's source.
# One image runs both processes; docker-compose.yml picks which with the last
# argument (`web` or `worker`).
#
# FIIG_IMAGE is fiig's runtime image, pinned to the release Hearsay is tested
# on.
ARG FIIG_IMAGE=ghcr.io/elephantryan/fiig:v0.1.0-alpha.3

# distroless has no shell to make a directory with, so /data is made here, owned
# by distroless's nonroot user, and a new volume mounted there takes that owner.
FROM busybox:1.37 AS data
RUN mkdir -p /data

FROM ${FIIG_IMAGE}
COPY --from=data --chown=65532:65532 /data /data
COPY fiig.pkg.json fiig.lock.json caps.container.json /app/
COPY migrations /app/migrations
COPY src /app/src
ENV DB_PATH=/data/hearsay.db
CMD ["serve", "-caps", "/app/caps.container.json", "/app", "web"]
