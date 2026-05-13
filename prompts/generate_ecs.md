# ECS Fargate 생성 가이드

## 참고 파일
- `resources/aws-conventions.md`
- `resources/network-topology.md`
- `resources/security-policy.md`
- `resources/cost-policy.md`
- `resources/environments.md`

## 생성 시 체크리스트
- [ ] 네이밍 규칙 준수 (`{env}-{service}-service`, `{env}-{service}-task`)
- [ ] 필수 태그 포함 (Environment, Team, ManagedBy, Project)
- [ ] **launch_type = "FARGATE"** (EC2 launch type 금지)
- [ ] private subnet 배치 (`assign_public_ip = false`)
- [ ] 외부 접근은 반드시 ALB 경유
- [ ] task role / execution role 분리
- [ ] 컨테이너 포트와 SG 인바운드 일치
- [ ] CloudWatch Logs 설정 (`/ecs/{env}-{service}`)
- [ ] 이미지 URI는 ECR (`{account_id}.dkr.ecr.{region}.amazonaws.com/...`)

## 필수 리소스
1. **ECR 레포지토리** (`aws_ecr_repository`)
2. **CloudWatch Log Group** (`aws_cloudwatch_log_group`)
3. **Task Execution Role** (`AmazonECSTaskExecutionRolePolicy` 부착)
4. **Task Role** (앱이 필요한 최소 권한)
5. **Task Definition** (Fargate, network_mode="awsvpc")
6. **Service** (private subnet + ALB target group 연결)
7. **Target Group** + **ALB Listener Rule**

## variables.tf 권장
```hcl
variable "service_name"
variable "environment"
variable "cluster_id"            # 기존 ECS cluster ARN
variable "image"                 # ECR image URI (with tag)
variable "container_port"
variable "cpu"                   # 256/512/1024/2048/4096
variable "memory"                # cpu 별 valid 조합 준수
variable "desired_count"         # dev:1, staging:2, prod:2+
variable "subnet_ids"            # private
variable "vpc_id"
variable "alb_target_group_arn"
variable "task_sg_id"            # ALB SG에서만 inbound 허용
variable "environment_variables" # map(string), optional
variable "secrets"               # SSM/Secrets Manager ARN map, optional
```

## CPU/메모리 valid 조합 (Fargate)
| CPU | Memory |
|---|---|
| 256 | 512 / 1024 / 2048 |
| 512 | 1024 ~ 4096 |
| 1024 | 2048 ~ 8192 |
| 2048 | 4096 ~ 16384 |

## 보안
- ECS Task SG inbound: **ALB SG에서만** 컨테이너 포트 허용
- Task role에 `Action: "*"` 금지
- Secrets는 환경변수 plaintext 대신 `secrets` 블록 + SSM/Secrets Manager 참조

## 비용 가드
- dev: 256 CPU / 512 MB, desired 1
- staging: 512 / 1024, desired 1~2
- prod: 1024+ / 2048+, desired 2+ (Multi-AZ 자동)
- FARGATE_SPOT은 stateless 워크로드만

## 자동 배포 패턴
- `aws ecs update-service --force-new-deployment`로 롤링
- task definition은 lifecycle `ignore_changes = [container_definitions]`로 GitHub Actions가 갱신
