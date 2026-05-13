# Tool: create_pr

## 목적
호출자가 이미 .tf 파일을 수정해둔 로컬 디렉토리를 새 브랜치로 push하고 GitHub PR을 생성합니다.

## 입력
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `local_path` | string | ✅ | 변경 적용된 terraform 레포 경로 |
| `branch` | string | ✅ | 새 브랜치명 (예: `agent/infra/add-s3`) |
| `title` | string | ✅ | PR 제목 |
| `body` | string | ❌ | PR 본문 (plan 결과 등) |

## 동작
1. `local_path`에서 `git checkout -b <branch>`
2. `git add -A` + `git commit -m "<title>"`
3. `git push -u origin <branch>`
4. GitHub API로 PR 생성 → URL 반환

## 호출 전 권장 절차
1. terraform 레포 로컬 clone
2. .tf 파일 수정 (`prompts/generate_*.md` 가이드 따라)
3. `run_plan`으로 변경 미리보기
4. plan 결과를 `body`에 포함해 `create_pr` 호출

## 본문 권장 포맷
```md
## 변경 요약
- dev에 S3 버킷 추가

## terraform plan
\`\`\`
{plan 결과}
\`\`\`

## 체크리스트
- [ ] 네이밍 규칙 (rorr-{env}-{purpose})
- [ ] 보안그룹 0.0.0.0/0 없음
- [ ] 비용 추정
```

## 실패 케이스
- 브랜치 중복 → `git checkout -b` 실패 (catch 처리됨)
- 커밋할 변경 없음 → `git commit` 에러
- 토큰 만료 → 401 (`runbooks/token-expired.md`)
- PR이 이미 있음 → API 422
