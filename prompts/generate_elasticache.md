# ElastiCache (Redis) 생성 가이드

## 참고 파일
- `resources/aws-conventions.md`
- `resources/network-topology.md`
- `resources/security-policy.md`
- `resources/cost-policy.md`

## 생성 시 체크리스트
- [ ] 네이밍: `{env}-{service}-redis`
- [ ] 필수 태그
- [ ] private subnet 배치 (`subnet_group_name`)
- [ ] 보안그룹: 앱 SG에서만 6379 inbound, 인터넷 노출 절대 금지
- [ ] `at_rest_encryption_enabled = true`
- [ ] `transit_encryption_enabled = true`
- [ ] AUTH 토큰 사용 (`auth_token`, SSM에서 주입)
- [ ] 백업 (`snapshot_retention_limit ≥ 1`)
- [ ] prod는 Multi-AZ + Automatic Failover

## variables.tf 권장
```hcl
variable "cluster_id"
variable "environment"
variable "engine_version"        # "7.1" 등
variable "node_type"             # dev: cache.t3.micro / prod: cache.m6g.large+
variable "num_cache_nodes"       # cluster mode disabled
variable "subnet_ids"            # private
variable "vpc_security_group_ids"
variable "auth_token"            # SSM 참조
variable "parameter_group_name"
```

## 모드 선택
- **Cluster Mode Disabled** (단일 노드 + replica) — 단순, 대부분의 경우
- **Cluster Mode Enabled** (sharding) — 대용량/고처리량 필요 시

## 비용 가드
- dev: `cache.t3.micro`, 단일 노드
- staging: `cache.t3.small`
- prod: `cache.m6g.large` 이상, Multi-AZ
