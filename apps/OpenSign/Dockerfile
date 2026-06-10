FROM node:22.14.0

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
COPY .husky .
COPY entrypoint.sh .

RUN chmod +x entrypoint.sh

ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false
RUN npm run build

RUN sed -i '/<head>/a\<script src="/env.js"></script>' build/index.html

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "start"]
