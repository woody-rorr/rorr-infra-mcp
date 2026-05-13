# 네트워크 / 공유 인프라 (실값)

> ⚠️ **모든 ID/ARN은 절대 하드코딩하지 말 것. 반드시 data source로 조회.**
> 하드코딩하면 ARN suffix 같은 부분에서 자주 틀려서 apply가 깨짐.

## 공유 인프라 (모든 MCP/오케스트레이터/staging 리소스가 여기 위치)

| 리소스 | 식별값 | 비고 |
|---|---|---|
| VPC | `vpc-0e4611af2c26c7223` | Name: `mcp-agents-staging-vpc`, CIDR 10.0.0.0/16 |
| Public Subnet 1 | `subnet-02b19e578de089a89` | us-east-1a, 10.0.0.0/24 |
| Public Subnet 2 | `subnet-011389a22f856c694` | us-east-1b, 10.0.1.0/24 |
| ECS Cluster | `mcp-agents-staging-cluster` | 공유 |
| ALB Name | `mcp-agents-staging-alb` | DNS: `mcp-agents-staging-alb-249976027.us-east-1.elb.amazonaws.com` (DNS suffix ≠ ARN suffix) |
| ALB SG | `sg-0ebd5a00d52cd3731` | mcp-agents-staging-alb-sg |
| ECS Task SG | `sg-082696c1f710d394d` | mcp-agents-staging-ecs-sg |

## ✅ Terraform data source 올바른 패턴

```hcl
# 1. ALB는 반드시 data source로 조회 (ARN 하드코딩 금지)
data "aws_lb" "shared" {
  name = "mcp-agents-staging-alb"
}

resource "aws_lb_listener" "x" {
  load_balancer_arn = data.aws_lb.shared.arn     # ✅ data로 가져옴
  port              = 4000
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.x.arn
  }
}

# 2. ECS Cluster
data "aws_ecs_cluster" "shared" {
  cluster_name = "mcp-agents-staging-cluster"  # ⚠️ "name" 아님!
}

# 3. VPC (가능하면 data source, 정 안 되면 ID 직접)
data "aws_vpc" "shared" {
  id = "vpc-0e4611af2c26c7223"
}

# 4. Subnets
data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.shared.id]
  }
  filter {
    name   = "tag:Name"
    values = ["mcp-agents-staging-public-*"]
  }
}
```

## ❌ 절대 하지 말 것

```hcl
# 잘못 1: ALB ARN 하드코딩
load_balancer_arn = "arn:aws:elasticloadbalancing:us-east-1:239460481239:loadbalancer/app/mcp-agents-staging-alb/249976027"
# → DNS suffix "249976027"는 ARN의 일부가 아님. 실제 ARN suffix는 다름.

# 잘못 2: data source attribute 이름 틀림
data "aws_ecs_cluster" "x" {
  name = "..."         # ❌
  cluster_name = "..." # ✅
}
```

## 자주 틀리는 attribute 이름 (Terraform AWS provider)

| Data source | 올바른 인자 | 자주 틀리는 형태 |
|---|---|---|
| `aws_ecs_cluster` | `cluster_name` | ❌ `name` |
| `aws_ecs_service` | `cluster_arn`, `service_name` | ❌ `name` |
| `aws_lb` | `name` 또는 `arn` | ❌ ARN 하드코딩 |
| `aws_lb_target_group` | `name` 또는 `arn` | — |
| `aws_iam_role` | `name` | ❌ `role_name` |
| `aws_vpc` | `id`, `tags`, `cidr_block` | ❌ `vpc_id` |
| `aws_subnets` (복수) | `filter` 블록 | ❌ `tags` 직접 |

## 신규 ECS 서비스 만들 때 표준 패턴

1. CloudWatch Log Group 생성
2. IAM Execution Role + AmazonECSTaskExecutionRolePolicy attach
3. IAM Task Role (도메인별 권한, 예: Bedrock invoke)
4. ECS Task Definition (Fargate, awsvpc)
5. ALB Target Group (target_type=ip, vpc_id 명시, health check path)
6. ALB Listener (위 data.aws_lb.shared.arn 사용)
7. ECS Service (network_configuration: subnets/security_groups, load_balancer 블록 연결)
