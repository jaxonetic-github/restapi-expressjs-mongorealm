FROM node:latest

WORKDIR /webapp
RUN npm install -g npm@8.3.0


COPY package*.json ./package.json
COPY . .


RUN npm install


EXPOSE 4444

CMD  ["npm", "run", "start"]