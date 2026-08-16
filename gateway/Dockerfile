FROM node:22-alpine
WORKDIR /app
COPY server.mjs index.mjs ./
USER node
EXPOSE 8787
CMD ["node", "index.mjs"]
