# Tool: run_apply

## 목적
`rorr-infra-terraform` 레포의 특정 환경에 `terraform apply -auto-approve`를 실행합니다.

## 입력
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `environment` | `dev` \| `staging` \| `prod` | ❌ (기본 dev) | 대상 환경 |
| `confirm` | boolean | ✅ | 반드시 `true` |

## 동작
1. `confirm=true` 검증, 아니면 즉시 종료
2. `environment === "prod"`면 거부 (안전장치)
3. 레포 clone → `environments/<env>` 에서 init + apply
4. 결과 반환 (최대 60KB)

## 안전장치 (절대 변경 금지)
- **prod 차단** — MCP 자동 apply는 dev/staging만
- **confirm 필수** — 실수 호출 방지
- prod 변경은 PR 머지 후 GitHub Actions에서만

## 권장 사용 패턴
1. 먼저 `run_plan`으로 변경 사항 확인
2. 사람이 검토 후 명시적 승인
3. `run_apply confirm=true environment=dev`

## 실패 시
- 일부 리소스만 생성됐을 수 있음 → `runbooks/partial-apply.md` 참고
- state lock 충돌 → `runbooks/state-locked.md` 참고
