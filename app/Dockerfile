# Build the React app in a Node environment
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies and build the frontend
COPY package.json tsconfig.json tsconfig.node.json vite.config.ts vite.config.js vite.config.d.ts .
COPY src ./src
COPY index.html .
COPY .env.example .env.example

RUN npm install

ARG VITE_SOLANA_RPC_URL
ARG VITE_PROGRAM_ID
ARG VITE_TREASURY_WALLET
ARG VITE_NETWORK
ARG VITE_BASE_PATH=/

ENV VITE_SOLANA_RPC_URL=${VITE_SOLANA_RPC_URL}
ENV VITE_PROGRAM_ID=${VITE_PROGRAM_ID}
ENV VITE_TREASURY_WALLET=${VITE_TREASURY_WALLET}
ENV VITE_NETWORK=${VITE_NETWORK}
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

RUN npm run build

# Serve the built assets with nginx
FROM nginx:stable-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/dist /var/www/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
