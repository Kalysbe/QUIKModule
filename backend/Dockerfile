FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    RUNNING_IN_DOCKER=true \
    SERVER_HOST=0.0.0.0 \
    PORT=5000

WORKDIR /app

# Устанавливаем зависимости отдельным слоем для кэширования
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Копируем исходный код
COPY . .

# Директория для рантайм-данных (логи) — монтируется как volume в compose
RUN mkdir -p logs && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/health',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
