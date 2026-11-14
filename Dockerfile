FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js index.html ./

ENV NODE_ENV=production
ENV PORT=9302
EXPOSE 9302
CMD ["npm", "start"]
