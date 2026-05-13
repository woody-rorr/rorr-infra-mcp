# 환경별 정보

> SUMMARY.md "환경 설정"과 "절대 규칙"이 우선합니다. 현재 정책: **dev only**.

## AWS 프로파일 (고정)
**모든 작업은 `rorr-dev` 프로파일 + `us-east-1` 리전만 사용합니다.**

```bash
export AWS_PROFILE=rorr-dev
export AWS_REGION=us-east-1
```

- 다른 프로파일/리전 사용 금지
- 향후 prod 계정 분리 시 별도 프로파일 추가 예정

---

## 현재 활성 환경: dev only
| 항목 | 값 |
|---|---|
| 계정 | `239460481239` (rorr-dev) |
| VPC CIDR | `10.0.0.0/16` |
| 기본 EC2 인스턴스 | `t3.medium` (미지정 시 기본값) |
| dev apply | ✅ 허용 (사용자 승인 후) |
| 인바운드 0.0.0.0/0 | ✅ 허용 (필요 포트만, 전체 개방 금지) |

---

## 정의만 두고 비활성 — staging
| 항목 | 값 |
|---|---|
| 계정 | `239460481239` (rorr-dev 공유) |
| VPC CIDR | `10.1.0.0/16` |
| EC2 | `t3.small` |
| apply | ❌ MCP 자동 금지 |

---

## 정의만 두고 비활성 — prod
| 항목 | 값 |
|---|---|
| 계정 | TBD |
| VPC CIDR | `10.10.0.0/16` |
| EC2 | `t3.medium` 이상 |
| apply | ❌ MCP에서 차단 (GitHub Actions에서만) |

---

## State 백엔드
- 환경마다 별도 state, key는 `<env>/terraform.tfstate`
- 자세한 내용은 `state-management.md`
