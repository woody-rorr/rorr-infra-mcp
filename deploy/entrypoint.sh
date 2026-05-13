#!/bin/sh
set -e

SSM_CREDS_PATH="/rorr-mcp-infra/claude-credentials"
SSM_GH_TOKEN="/rorr-mcp-infra/github-token"
SSM_GH_REPO="/rorr-mcp-infra/github-repo-url"
CLAUDE_DIR="/root/.claude"
REGION="${AWS_REGION:-us-east-1}"

# Claude credentials 복원
mkdir -p "$CLAUDE_DIR"
CREDS=$(aws ssm get-parameter --name "$SSM_CREDS_PATH" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
if [ -n "$CREDS" ]; then
  echo "$CREDS" > "$CLAUDE_DIR/.credentials.json"
  echo "[entrypoint] Claude credentials restored from SSM."
else
  echo "[entrypoint] WARN: no claude credentials in SSM."
fi

# GitHub 시크릿 주입
TOKEN=$(aws ssm get-parameter --name "$SSM_GH_TOKEN" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
REPO=$(aws ssm get-parameter --name "$SSM_GH_REPO" --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
[ -n "$TOKEN" ] && export GITHUB_TOKEN="$TOKEN" && echo "[entrypoint] GITHUB_TOKEN injected."
[ -n "$REPO" ] && export GITHUB_REPO_URL="$REPO" && echo "[entrypoint] GITHUB_REPO_URL=$REPO"

exec node /app/src/server.js
