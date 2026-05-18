#!/bin/sh
set -e

REGION="${AWS_REGION:-us-east-1}"

# === Claude OAuth credentials → ~/.claude/.credentials.json ===
# SSM에 저장된 형식: {"claudeAiOauth":{"accessToken":"...","refreshToken":"...","expiresAt":<ms>,...}}
SSM_CLAUDE="/rorr-mcp-infra/claude-credentials"
CLAUDE_DIR="/root/.claude"
mkdir -p "$CLAUDE_DIR"
CREDS=$(aws ssm get-parameter --name "$SSM_CLAUDE" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
if [ -n "$CREDS" ]; then
  printf '%s' "$CREDS" > "$CLAUDE_DIR/.credentials.json"
  chmod 600 "$CLAUDE_DIR/.credentials.json"
  echo "[entrypoint] Claude OAuth credentials installed at $CLAUDE_DIR/.credentials.json"
else
  echo "[entrypoint] WARN: SSM $SSM_CLAUDE empty — claude CLI may fail to auth"
fi

# === GitHub 시크릿 (PR 생성용 + GitHub MCP outbound 인증용) ===
SSM_GH_TOKEN="/rorr-mcp-infra/github-token"
SSM_GH_REPO="/rorr-mcp-infra/github-repo-url"
TOKEN=$(aws ssm get-parameter --name "$SSM_GH_TOKEN" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
REPO=$(aws ssm get-parameter --name "$SSM_GH_REPO" --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)

[ -n "$TOKEN" ] && export GITHUB_TOKEN="$TOKEN" && export GITHUB_MCP_TOKEN="$TOKEN" && echo "[entrypoint] GITHUB_TOKEN/GITHUB_MCP_TOKEN injected from SSM."
[ -n "$REPO" ] && export TERRAFORM_GITHUB_REPO_URL="$REPO" && echo "[entrypoint] TERRAFORM_GITHUB_REPO_URL=$REPO"

exec node /app/src/server.js
