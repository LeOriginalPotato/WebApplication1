FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN chmod +x docker/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
