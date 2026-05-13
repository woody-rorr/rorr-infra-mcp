# AWS 네이밍 규칙

## 리소스 네이밍
- EC2: `{env}-{service}-{role}`     예) `dev-api-web`
- S3:  `{company}-{env}-{purpose}`  예) `rorr-dev-logs`
- RDS: `{env}-{service}-db`         예) `dev-api-db`
- VPC: `{env}-vpc`                  예) `dev-vpc`
- SG:  `{env}-{role}-sg`            예) `dev-alb-sg`

## 필수 태그
모든 리소스에 아래 태그 반드시 포함:
- `Environment`: dev / staging / prod
- `Team`: 팀명
- `ManagedBy`: terraform
- `Project`: rorr

## 리전
- 기본: `us-east-1`
