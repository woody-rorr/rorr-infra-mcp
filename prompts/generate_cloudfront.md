# CloudFront 생성 가이드

## 참고 파일
- `resources/aws-conventions.md`
- `resources/security-policy.md`
- `resources/cost-policy.md`

## 생성 시 체크리스트
- [ ] 네이밍: `{env}-{service}-cdn`
- [ ] 필수 태그
- [ ] HTTPS만 허용 (`viewer_protocol_policy = "redirect-to-https"`)
- [ ] TLS 최소 버전 `TLSv1.2_2021` 이상
- [ ] ACM 인증서 (us-east-1 리전 필수)
- [ ] Origin Access Control (S3 origin은 OAC 사용, OAI 사용 금지)
- [ ] WAF 연결 (prod 필수)
- [ ] 로깅 활성화 (S3 logs 버킷)
- [ ] custom error response 설정 (SPA는 404→200으로 index.html)

## variables.tf 권장
```hcl
variable "distribution_name"
variable "environment"
variable "origin_domain_name"        # S3 또는 ALB DNS
variable "origin_type"               # "s3" / "custom"
variable "default_root_object"       # "index.html"
variable "acm_certificate_arn"       # us-east-1
variable "aliases"                   # ["app.example.com"]
variable "price_class"               # PriceClass_100 / 200 / All
variable "waf_acl_arn"               # optional
variable "log_bucket"                # optional
variable "default_ttl"
variable "max_ttl"
```

## S3 정적 사이트 origin 패턴
1. S3 버킷 (private, public_access_block all true)
2. CloudFront OAC 생성
3. S3 버킷 정책에 OAC만 허용
4. CloudFront origin에 OAC 연결

## 비용 가드
- dev: PriceClass_100 (북미/유럽만)
- prod: PriceClass_200 또는 PriceClass_All
- 로깅 S3 lifecycle: 30일 후 STANDARD_IA, 90일 후 삭제

## 캐시
- 정적 자산: TTL 86400 이상
- 동적 API: TTL 0 또는 캐시 안 함 (`cache_policy_id`로 분리)
