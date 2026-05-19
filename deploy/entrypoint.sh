#!/bin/sh
set -e

REGION="${AWS_REGION:-us-east-1}"

# === Claude OAuth credentials → ~/.claude/.credentials.json ===
# SSM에 저장된 형식: {"claudeAiOauth":{"accessToken":"...","refreshToken":"...","expiresAt":<ms>,...}}
SSM_CLAUDE="/rorr-mcp-infra/claude-credentials"
CLAUDE_DIR="${HOME:-/root}/.claude"
mkdir -p "$CLAUDE_DIR"
CREDS=$(aws ssm get-parameter --name "$SSM_CLAUDE" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
if [ -n "$CREDS" ]; then
  printf '%s' "$CREDS" > "$CLAUDE_DIR/.credentials.json"
  chmod 600 "$CLAUDE_DIR/.credentials.json"
  echo "[entrypoint] Claude OAuth credentials installed at $CLAUDE_DIR/.credentials.json"
else
  echo "[entrypoint] WARN: SSM $SSM_CLAUDE empty — claude CLI may fail to auth"
fi

# === Terraform repo URL (PR 대상 repo) ===
SSM_GH_REPO="/rorr-mcp-infra/github-repo-url"
REPO=$(aws ssm get-parameter --name "$SSM_GH_REPO" --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
[ -n "$REPO" ] && export TERRAFORM_GITHUB_REPO_URL="$REPO" && echo "[entrypoint] TERRAFORM_GITHUB_REPO_URL=$REPO"

# GitHub 사용자 토큰은 요청 헤더(Authorization)로 받아 ALS로 전파 — 환경변수 사용 안 함.

exec node /app/src/server.js
