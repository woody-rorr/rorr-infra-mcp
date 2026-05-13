# S3 생성 가이드

## 참고 파일
- `resources/aws-conventions.md`
- `resources/security-policy.md`
- `resources/cost-policy.md`

## 생성 시 체크리스트
- [ ] 네이밍 규칙 준수 (`rorr-{env}-{purpose}`)
- [ ] 필수 태그 포함
- [ ] `aws_s3_bucket_public_access_block` 4개 옵션 모두 true
- [ ] 암호화 활성화 (SSE-S3 기본, 민감 데이터는 SSE-KMS)
- [ ] prod: `force_destroy = false`
- [ ] versioning 활성화 (prod 필수)
- [ ] lifecycle: dev/staging 30일 후 STANDARD_IA

## variables.tf 권장
```hcl
variable "bucket_name"
variable "environment"
variable "purpose"
variable "force_destroy"   # default false
variable "kms_key_arn"     # optional
variable "lifecycle_rules" # optional
```
