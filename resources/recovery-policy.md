# 충돌/장애 처리 정책

> SUMMARY.md "절대 규칙"이 우선합니다.
> 모든 복구 작업은 **자동 실행 금지**, 반드시 사용자 승인 후 실행하세요.
> 장애 발생 시 **어디서/어떤 단계에서 발생했는지** 사용자에게 먼저 보고합니다.

---

## State Lock 충돌
- 증상: `Error acquiring the state lock`
- 원인: 이전 작업 비정상 종료 / 동시 실행
- 처리:
  - `force-unlock`은 반드시 사용자 확인 후 실행
  - LOCK_ID 확인 후 사용자에게 명시적으로 전달
  - 절대 자동으로 `force-unlock` 실행 금지

## Apply 중 실패
- 실패 시 절대 재시도 자동 실행 금지
- 실패 리소스, 에러 메시지 원문 그대로 사용자에게 전달
- `-target`은 임시방편임을 사용자에게 고지
- 근본 원인 파악 후 전체 apply 권장
- plan 재실행 후 상태 확인 먼저

## State 불일치 (Drift)
- `plan -refresh-only` 먼저 실행해서 차이 보고
- 콘솔 직접 수정 감지 시 사용자에게 경고
- `import` / `state rm` 등 state 조작은 반드시 사용자 승인 필수
- 절대 자동으로 state 조작 금지

## PR 머지 충돌
- agent 브랜치가 main 위로 rebase 필요
- 충돌 파일 사용자에게 알리고 수동 해결 요청
- `terraform plan` 다시 실행 후 차이 재확인

## 인증 만료
- 증상:
  - GitHub `401 Unauthorized` → 사용자가 오케스트레이터에 재로그인 (개인 OAuth 토큰 만료/회수)
  - AWS `ExpiredToken` → IAM Role/credentials 확인
  - Claude CLI `401` → SSM `/rorr-mcp-infra/claude-credentials` 갱신 (로컬 `claude` 실행 → Keychain → SSM put-parameter → ECS 재배포)
- 자동 갱신 X, 사용자에게 통보

## 예방 원칙
- destroy 포함된 plan → 자동 실행 금지
- 동시 apply 방지 → GitHub Actions concurrency 설정 확인 권고
- 콘솔 직접 리소스 수정 자체를 팀 규칙으로 금지 권고
