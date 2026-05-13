FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl unzip ca-certificates gnupg awscli \
  && curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com bookworm main" > /etc/apt/sources.list.d/hashicorp.list \
  && apt-get update && apt-get install -y --no-install-recommends terraform \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# .md 컨텍스트 + 서버 코드
COPY src ./src
COPY prompts ./prompts
COPY resources ./resources

COPY deploy/entrypoint.sh deploy/ecs-backup-auth.sh ./
RUN chmod +x entrypoint.sh ecs-backup-auth.sh

EXPOSE 5010
ENTRYPOINT []
CMD ["/bin/sh", "/app/entrypoint.sh"]
