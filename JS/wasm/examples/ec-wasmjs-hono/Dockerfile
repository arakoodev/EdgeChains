FROM node:20 as builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY build.js ./
COPY src ./src

RUN npm run build

FROM tanjim/wasmjs:latest

COPY --from=builder --chown=cnb:cnb --chmod=0777 /app/bin /app

ENTRYPOINT [ "wasmjs-runtime", "/app" ]
