# 보안 정책

> SUMMARY.md의 "절대 규칙"과 "보안그룹 정책"이 우선합니다. 이 문서는 그 세부 사항입니다.

## 보안그룹 인바운드 규칙
환경별로 다릅니다:

| 환경 | 정책 |
|---|---|
| **dev** | `0.0.0.0/0` 허용 (개발 편의상) — 단, **필요한 포트만** 명시. 전체 포트 개방 금지 |
| **staging** | ALB SG는 80/443만, 그 외 포트는 SG 참조 |
| **prod** | ALB SG는 80/443만, 그 외 포트는 SG 참조 |

## 공통 SG 규칙
- 모든 룰에 `description` 필수
- 기존 SG 룰 무단 삭제 금지 (수정/추가 우선)
- DB SG: app SG에서만 inbound (인터넷 노출 절대 금지)

## SSH 정책
- SSH(22) 인바운드는 bastion SG에서만 허용
- bastion 본인은 사용자 IP(개인) 또는 회사 VPN CIDR로 제한

## 네트워크 배치
- 애플리케이션 리소스(EC2, RDS, ECS)는 **private subnet** 배치
- public subnet에는 ALB, NAT, bastion만
- 퍼블릭 IP 자동 할당(`assign_public_ip`) 금지 (bastion 제외)

## IAM
- `Action: "*"` + `Resource: "*"` 금지
- AccessKey 발급보다 IAM Role 우선 (ECS Task Role, GitHub OIDC)
- 가능한 AWS Managed Policy 사용, 커스텀은 최소 권한

## 암호화
- S3: SSE-S3 기본, 민감 데이터는 SSE-KMS
- RDS: `storage_encrypted = true`
- EBS: `encrypted = true`

## Secret 관리
- 토큰/패스워드: SSM SecureString 또는 Secrets Manager
- `.tf` / `.tfvars`에 plaintext 절대 금지
- 컨테이너 환경변수 plaintext도 금지 → `secrets` 블록으로 SSM 참조
