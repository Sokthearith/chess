# Counterplay: the built site and the online game server in one small image.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
# The server needs only chess.js and ws at runtime (neither has dependencies);
# everything else is bundled into dist/ by Vite.
COPY package.json ./
COPY --from=build /app/node_modules/chess.js ./node_modules/chess.js
COPY --from=build /app/node_modules/ws ./node_modules/ws
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/online/protocol.ts ./src/online/protocol.ts
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.ts"]
