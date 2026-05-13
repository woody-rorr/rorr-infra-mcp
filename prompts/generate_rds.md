# RDS 생성 가이드

## 참고 파일
- `resources/aws-conventions.md`
- `resources/network-topology.md`
- `resources/security-policy.md`
- `resources/cost-policy.md`

---

## 필수 체크리스트
- [ ] 네이밍: `{env}-{service}-db`
- [ ] 필수 태그 4종 (Environment, Team, ManagedBy, Project)
- [ ] **private subnet** 배치
- [ ] `publicly_accessible = false`
- [ ] `deletion_protection = true`
- [ ] `storage_encrypted = true`
- [ ] `skip_final_snapshot = false` (prod), dev/staging은 허용
- [ ] `password`는 SSM/Secrets Manager 참조 (plaintext 금지)
- [ ] DB SG: 앱 SG에서만 DB 포트 inbound

---

## 금지 사항
- ❌ public subnet 배치
- ❌ `publicly_accessible = true`
- ❌ `master_password`를 `variables.tf` default에 plaintext 작성
- ❌ `master_password`를 `.tfvars`에 plaintext 작성
- ❌ `storage_encrypted = false`
- ❌ `deletion_protection = false` (prod)
- ❌ `skip_final_snapshot = true` (prod) — 데이터 영구 손실
- ❌ DB SG inbound `0.0.0.0/0`

---

## 환경별 기본값

| 변수 | dev | staging | prod |
|---|---|---|---|
| `instance_class` | `db.t3.micro` | `db.t3.small` | `db.t3.medium` 이상 |
| `multi_az` | `false` | `false` | `true` |
| `backup_retention_period` | `1` | `3` | `7` 이상 |
| `deletion_protection` | `false` | `true` | `true` |
| `skip_final_snapshot` | `true` | `false` | `false` |
| `allocated_storage` | `20` | `50` | `100`+ |

---

## variables.tf 권장

```hcl
variable "engine" {
  type        = string
  description = "RDS engine (postgres / mysql)"
}

variable "engine_version" {
  type        = string
  description = "Engine version (예: 16.4)"
}

variable "instance_class" {
  type        = string
  description = "DB instance class"
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  type        = number
  default     = 20
}

variable "db_name" {
  type        = string
}

variable "username" {
  type        = string
}

variable "password" {
  type        = string
  description = "DB password — SSM/Secrets Manager에서 주입, plaintext 금지"
  sensitive   = true
}

variable "subnet_ids" {
  type        = list(string)
  description = "private subnet IDs"
}

variable "vpc_security_group_ids" {
  type        = list(string)
}

variable "environment" {
  type        = string
}

variable "service" {
  type        = string
}
```

---

## password 주입 패턴 (필수)

```hcl
data "aws_ssm_parameter" "db_password" {
  name            = "/rorr/${var.environment}/${var.service}/db-password"
  with_decryption = true
}

resource "aws_db_instance" "main" {
  # ...
  password = data.aws_ssm_parameter.db_password.value
}
```

→ password가 .tf, .tfvars, state plaintext 어디에도 노출되지 않음.

---

## 자주 하는 실수
- public subnet에 배치 → **private subnet 강제**
- `master_password`를 variable default로 박음 → SSM 참조로 교체
- `skip_final_snapshot = true` 머지 → prod는 절대 금지
- `backup_retention_period = 0` → 최소 1일 (dev), prod 7일
- Aurora 만들면서 `engine = "aurora-mysql"` 안 쓰고 일반 RDS engine 사용
- Multi-AZ 끄고 prod 배포 → 가용성 위반

---

## Aurora 변형 (참고)
Aurora는 일반 `aws_db_instance` 대신 `aws_rds_cluster` + `aws_rds_cluster_instance` 사용:

```hcl
resource "aws_rds_cluster" "main" {
  engine             = "aurora-mysql"
  engine_version     = "8.0.mysql_aurora.3.05.2"
  master_username    = var.username
  master_password    = data.aws_ssm_parameter.db_password.value
  storage_encrypted  = true
  backup_retention_period = var.backup_retention_period
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot
}
```
