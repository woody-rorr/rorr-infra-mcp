# Tool: run_plan

## 목적
`terraform plan` 실행. **로컬 작업 폴더의 변경사항 검증** 또는 **원격 main 브랜치 현황 확인** 둘 다 지원.

## 입력
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `environment` | `dev` \| `staging` \| `prod` | ❌ (기본 dev) | 대상 환경 |
| `local_path` | string | ❌ | Claude가 .tf 수정한 로컬 폴더 절대 경로 |

## 두 가지 모드

### 1. 로컬 모드 (`local_path` 주어진 경우) ← **권장**
- 코드 생성 직후 검증할 때 사용
- 흐름:
  ```
  Claude가 local_path 폴더에 .tf 수정
     ↓
  run_plan({ environment, local_path }) 호출
     ↓
  MCP가 local_path/environments/<env>에서 init + plan
     ↓
  Claude의 수정사항이 반영된 결과 반환
  ```

### 2. 원격 모드 (`local_path` 없음)
- 현재 main 브랜치의 인프라 현황 조회 시
- 흐름:
  ```
  run_plan({ environment }) 호출
     ↓
  MCP가 GITHUB_REPO_URL을 main으로 임시 clone
     ↓
  init + plan
     ↓
  결과 반환, 임시 디렉토리 정리
  ```

## 안전
- 코드/state 수정 없음 (read-only)
- 동시 실행 시 DynamoDB lock에 의해 직렬화 가능

## 실패 케이스
- `local_path` 모드: `environments/<env>` 디렉토리 없으면 에러
- 원격 모드: `GITHUB_REPO_URL`/`GITHUB_TOKEN` 미설정 시 에러
- AWS 자격증명 미설정 → init 실패

## 사용 시점
- ✅ 코드 작성 후 (`local_path`로 검증)
- ✅ "지금 dev에 뭐 떠있어?" (원격 모드)
- ✅ create_pr 호출 전 dry-run (`local_path`로)
