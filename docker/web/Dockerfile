FROM node:20-alpine AS build

WORKDIR /app

ARG REACT_APP_API_URL
ARG REACT_APP_USE_MINOS_AUTH=false
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_USE_MINOS_AUTH=$REACT_APP_USE_MINOS_AUTH
ENV REACT_APP_ALLOW_LOCALHOST_API=true

COPY package.json package-lock.json ./
RUN npm ci

COPY public ./public
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json ./

RUN npm run build

FROM nginx:alpine

COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80