# Hearsay's browser app, built, served by nginx with /api/ passed to the API
# container, so the browser sees one origin (no CORS, first-party cookie).
#
# VITE_ABS_URL is built in: the Audiobookshelf address browsers load covers
# from, as they reach it (not a Docker-internal name).
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_ABS_URL=
ENV VITE_ABS_URL=${VITE_ABS_URL}
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
