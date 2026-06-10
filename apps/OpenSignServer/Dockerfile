FROM node:22.14.0

RUN apt-get update \
  && apt-get install -y libreoffice \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --loglevel verbose

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
