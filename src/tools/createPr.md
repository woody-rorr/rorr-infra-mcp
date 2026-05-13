# Tool: create_pr

## 목적
전달받은 파일 내용으로 terraform 레포에 새 브랜치 push + GitHub PR을 생성합니다.
**서버가 fresh clone부터 push/PR까지 모두 처리**하므로 호출자는 로컬 clone이 필요 없습니다.

## 입력
| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `files` | object | ✅ | 레포 루트 기준 상대경로 → 파일 내용 매핑 |
| `branch` | string | ✅ | 새 브랜치명 (예: `agent/infra/add-s3`) |
| `title` | string | ✅ | PR 제목 |
| `body` | string | ❌ | PR 본문 |

### files 예시
```json
{
  "environments/dev/s3.tf": "resource \"aws_s3_bucket\" \"x\" {\n  bucket = \"rorr-dev-build-artifacts\"\n}\n",
  "environments/dev/variables.tf": "..."
}
```

## 동작
1. 서버가 `/tmp`에 base 브랜치를 fresh clone
2. 새 브랜치 체크아웃
3. `files` 매핑대로 파일 작성 (디렉토리 자동 생성)
4. commit + push
5. GitHub API로 PR 생성 → URL 반환
6. 임시 디렉토리 정리

## 호출 전 권장 절차
1. SUMMARY.md → 자연어 → 의도 매핑으로 의도 식별
2. 해당 `prompts/generate_*.md` 가이드 따라 .tf **내용 생성**
3. 관련 `resources/*.md`로 네이밍/보안/비용 규칙 채우기
4. 생성된 내용을 `files` 객체로 묶어 `create_pr` 호출

## 본문 권장 포맷
```md
## 변경 요약
- dev에 S3 버킷 추가

## 적용 후 영향
- 신규 리소스만 추가 (destroy 없음)

## 체크리스트
- [ ] 네이밍 규칙 (rorr-{env}-{purpose})
- [ ] 보안그룹 0.0.0.0/0 없음
- [ ] 비용 추정
```

## 보안
- 경로 정규화: `..` 또는 절대경로는 거부
- 커밋 author는 `rorr-mcp-bot` (추후 인증된 사용자 정보로 교체 예정)

## 실패 케이스
- `files` 비어 있음 → 즉시 에러
- 잘못된 경로 (`..`, 절대경로) → `Invalid path` 에러
- 토큰 만료 → 401 (`runbooks/token-expired.md`)
- PR이 이미 있음 → API 422
- 브랜치 이미 존재 → push rejected (브랜치명에 timestamp 권장)
