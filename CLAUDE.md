# rorr-infra-mcp

Terraform 인프라 자동화 MCP 서버. Claude 에이전트가 호출하면 `rorr-infra-terraform` 레포 코드를 수정하고 plan 결과와 함께 PR을 생성합니다.

> ## 🧭 Claude는 `SUMMARY.md`를 먼저 읽으세요
> 이 CLAUDE.md는 **개발자/운영자용 가이드**입니다.
> Claude가 사용자 인프라 요청을 처리할 때는 **`SUMMARY.md`가 단일 진입점**입니다.
> 자연어 매핑, 문서 매핑, 절대 규칙, 장애 대응 모두 SUMMARY.md에서 시작하세요.

## AWS 배포 환경 (고정)

**모든 AWS 작업은 반드시 아래 프로파일/계정에서 수행합니다.**

| 항목 | 값 |
|---|---|
| AWS Profile | `rorr-dev` |
| AWS Account | `239460481239` |
| Region | `us-east-1` |

```bash
export AWS_PROFILE=rorr-dev
export AWS_REGION=us-east-1
```

## 리소스 네이밍 (고정)

| 리소스 | 이름 |
|---|---|
| ECR 레포 | `rorr-mcp-infra` |
| ECS Cluster | `mcp-agents-staging-cluster` |
| ECS Service | `rorr-mcp-infra-service` |
| ECS Task Definition | `rorr-mcp-infra-task` |
| ALB | `mcp-agents-staging-alb` (공유) |
| Target Group | `rorr-mcp-infra-tg` |
| ALB 리스너 포트 | `5010` |
| 컨테이너 포트 | `5010` |
| CloudWatch 로그 그룹 | `/ecs/rorr-mcp-infra` |
| Task Execution Role | `rorr-mcp-infra-execution` |
| Task Role | `rorr-mcp-infra-task` |
| ALB Security Group | `rorr-mcp-infra-alb-sg` |
| Task Security Group | `rorr-mcp-infra-task-sg` |

## 배포 순서

```bash
export AWS_PROFILE=rorr-dev
export AWS_REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 1. ECR 로그인
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# 2. 빌드 & 푸시 (Fargate는 linux/amd64 필수)
docker build --platform linux/amd64 -t rorr-mcp-infra:latest .
docker tag rorr-mcp-infra:latest ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/rorr-mcp-infra:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/rorr-mcp-infra:latest

# 3. 재배포 (새 이미지 pull)
aws ecs update-service \
  --cluster mcp-agents-staging-cluster \
  --service rorr-mcp-infra-service \
  --force-new-deployment
```

## 환경변수 (ECS Task)

| 변수 | 설명 |
|---|---|
| `PORT` | `5010` |
| `AWS_REGION` | `us-east-1` |
| `BASE_BRANCH` | `main` |
| `TERRAFORM_GITHUB_REPO_URL` | `rorr-infra-terraform` 레포 URL |
| `GITHUB_TOKEN` | GitHub PAT (PR 생성용) |

## MCP 접속 URL

`http://<ALB DNS>:5010/mcp`

`.mcp.json` 참고.
