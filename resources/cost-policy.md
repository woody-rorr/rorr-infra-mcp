# 비용 가드레일

## EC2
- dev: t3.micro 기본, 최대 t3.small까지 자동 허용. 그 이상은 PR 본문에 사유 명시.
- prod: t3.medium 이상. 단 prod도 인스턴스 ≥ 4xlarge는 사람 승인 필수.

## ASG
- dev: `max_size ≤ 3`
- staging: `max_size ≤ 5`
- prod: `max_size ≤ 20` (그 이상은 사유)

## RDS
- dev: db.t3.micro
- staging: db.t3.small
- prod: db.t3.medium 이상, Multi-AZ 권장

## NAT Gateway
- dev/staging은 NAT 1개 공유. prod만 AZ별 NAT.

## S3
- dev/staging은 lifecycle 30일 후 STANDARD_IA.
- prod는 별도 정책.

## 일반
- 새 리소스가 월 $50 이상 예상되면 PR 본문에 비용 추정 명시.
- 사용하지 않을 환경은 `count = 0`로 비활성화.
