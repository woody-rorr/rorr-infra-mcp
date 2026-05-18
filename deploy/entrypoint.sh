#!/bin/sh
set -e

SSM_GH_TOKEN="/rorr-mcp-infra/github-token"
SSM_GH_REPO="/rorr-mcp-infra/github-repo-url"
REGION="${AWS_REGION:-us-east-1}"

# GitHub 시크릿 주입 (PR 생성용 + GitHub MCP 인증용 공용)
TOKEN=$(aws ssm get-parameter --name "$SSM_GH_TOKEN" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)
REPO=$(aws ssm get-parameter --name "$SSM_GH_REPO" --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)

[ -n "$TOKEN" ] && export GITHUB_TOKEN="$TOKEN" && export GITHUB_MCP_TOKEN="$TOKEN" && echo "[entrypoint] GITHUB_TOKEN/GITHUB_MCP_TOKEN injected from SSM."
[ -n "$REPO" ] && export TERRAFORM_GITHUB_REPO_URL="$REPO" && echo "[entrypoint] TERRAFORM_GITHUB_REPO_URL=$REPO"

# LLM은 Bedrock 사용 (ECS Task Role로 자동 인증, OAuth 자격증명 불필요)
exec node /app/src/server.js
