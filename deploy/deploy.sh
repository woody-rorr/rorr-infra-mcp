#!/bin/bash
set -e
export AWS_PROFILE=${AWS_PROFILE:-rorr-dev}
REGION=us-east-1
ECR_URI=239460481239.dkr.ecr.${REGION}.amazonaws.com/rorr-mcp-infra
CLUSTER=mcp-agents-staging-cluster
SERVICE=rorr-mcp-infra-service

cd "$(dirname "$0")/.."   # 레포 루트로 이동

echo "🔨 Build & push (linux/amd64)"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI
docker buildx build --platform linux/amd64 -f deploy/Dockerfile -t "$ECR_URI:latest" --push .

echo "🚀 Force new deployment"
aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment --region $REGION > /dev/null

echo "⏳ Waiting for stable..."
aws ecs wait services-stable --cluster $CLUSTER --services $SERVICE --region $REGION

echo "✅ Done: http://mcp-agents-staging-alb-249976027.us-east-1.elb.amazonaws.com:5010/health"
