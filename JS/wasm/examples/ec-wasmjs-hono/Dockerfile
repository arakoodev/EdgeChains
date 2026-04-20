FROM node:20 as builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY build.js ./
COPY src ./src

RUN npm run build

FROM tanjim/wasmjs:1.0.0-latest

COPY --from=builder --chown=cnb:cnb --chmod=0777 /app/bin /app

USER 1000:1000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT [ "wasmjs-runtime", "/app" ]
