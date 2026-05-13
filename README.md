# rorr-infra-mcp

rorr 회사 Terraform 인프라를 자동으로 PR 올려주는 **MCP 서버**.

- 사용자가 자연어로 "dev에 S3 버킷 추가해줘" 요청
- MCP 서버가 `rorr-infra-terraform` 레포 clone → Claude CLI로 .tf 작성 → `terraform plan` 실행 → GitHub PR 생성
- 실제 `terraform apply`는 PR 머지 후 GitHub Actions에서

## 구조 (.md 중심)

| 폴더 | 역할 |
|---|---|
| `tools/` | 이 MCP가 제공하는 도구 스펙 |
| `prompts/` | 리소스 타입별 코드 생성 템플릿 |
| `resources/` | 회사 규칙 (네이밍, 표준, 환경 정보, 보안, 비용) |
| `workflows/` | 작업 유형별 절차 |
| `checks/` | PR 본문에 자동 첨부될 체크리스트 |
| `src/` | MCP 서버 (얇은 wrapper) — JS 2개 파일 |
| `deploy/` | 컨테이너/배포 스크립트 |

`src/agent.js`가 `resources/`, `workflows/`, `prompts/`, `checks/`의 모든 `.md`를 자동 로드해 Claude의 system prompt로 주입합니다.

## 사용

```bash
# 로컬 (개발)
npm install
node src/index.js

# 컨테이너 (배포)
deploy/deploy.sh
```

자세한 배포/운영은 `CLAUDE.md` 참고.
