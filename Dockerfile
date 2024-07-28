FROM node:20 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG NETWORK=mainnet

RUN npm run $NETWORK
RUN npm run build

FROM nginx:alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
