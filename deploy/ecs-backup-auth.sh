#!/bin/bash
# 컨테이너 안에서 실행: claude /login 후 이 스크립트 실행
SSM_CREDS_PATH="/rorr-mcp-infra/claude-credentials"
CLAUDE_DIR="/root/.claude"
REGION="${AWS_REGION:-us-east-1}"

CREDS_FILE="$CLAUDE_DIR/.credentials.json"
if [ ! -f "$CREDS_FILE" ]; then
  echo "ERROR: $CREDS_FILE 없음. 먼저 claude /login"
  exit 1
fi

aws ssm put-parameter \
  --name "$SSM_CREDS_PATH" \
  --value "$(cat "$CREDS_FILE")" \
  --type SecureString --overwrite --region "$REGION" > /dev/null

echo "Done: $SSM_CREDS_PATH"
