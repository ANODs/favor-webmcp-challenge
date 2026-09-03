FROM node:20-bookworm-slim

WORKDIR /bot
ENV NODE_ENV=production

COPY bot ./bot
COPY src/entities/contract/og-renderer.json ./src/entities/contract/og-renderer.json
COPY src/entities/subscription ./src/entities/subscription
COPY src/shared/config/contract-limits ./src/shared/config/contract-limits
COPY src/shared/lib/subscription/runtime.cjs ./src/shared/lib/subscription/runtime.cjs
COPY src/shared/lib/telegram/rich-message.runtime.cjs ./src/shared/lib/telegram/rich-message.runtime.cjs

CMD ["node", "bot/src/app/start-bot.js"]
