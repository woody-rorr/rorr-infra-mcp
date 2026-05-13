# EC2 생성 가이드

## 참고 파일
- `resources/aws-conventions.md`
- `resources/network-topology.md`
- `resources/security-policy.md`

## 생성 시 체크리스트
- [ ] 네이밍 규칙 준수 (`{env}-{service}-{role}`)
- [ ] private subnet 배치
- [ ] 필수 태그 포함 (Environment, Team, ManagedBy, Project)
- [ ] 보안그룹 inbound 0.0.0.0/0 없음
- [ ] dev는 t3 계열 인스턴스만
- [ ] EBS 암호화 (`encrypted = true`)
- [ ] IMDSv2 강제 (`http_tokens = "required"`)

## variables.tf 권장
```hcl
variable "instance_type"   # dev: t3.micro / staging: t3.small / prod: t3.medium+
variable "subnet_id"       # private only
variable "vpc_id"
variable "environment"
variable "service"
variable "role"
```
