#!/bin/bash
TASK=$(aws ecs list-tasks --cluster mcp-agents-staging-cluster --service-name rorr-mcp-infra-service --region us-east-1 --query 'taskArns[0]' --output text | awk -F/ '{print $NF}')
echo "Connecting to task: $TASK"
aws ecs execute-command \
  --cluster mcp-agents-staging-cluster \
  --task "$TASK" \
  --container rorr-mcp-infra \
  --command "/bin/sh" \
  --interactive \
  --region us-east-1
