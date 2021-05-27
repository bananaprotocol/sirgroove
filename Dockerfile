FROM node:14-alpine

LABEL maintainer="bananaprotocol@protonmail.com"

WORKDIR /usr/share/app

COPY package.json package-lock.json ./

RUN apk update
RUN apk add --no-cache --virtual build-deps g++ make python 
RUN npm install
RUN apk del build-deps
RUN apk add --no-cache ffmpeg

COPY . .

ENV BOT_TOKEN=
ENV YOUTUBE_API_KEY=
ENV BOT_MASTER=

CMD ["node", "bot.js"]
