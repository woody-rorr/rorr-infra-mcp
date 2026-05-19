# rorr-infra-mcp

회사 인프라(Terraform/AWS) 전담 MCP 서버. ECS Fargate에 배포되어 외부 ALB로 노출됩니다.

## 역할
- 자연어 인프라 요청을 받아 회사 규칙(.md)에 맞는 Terraform 코드 생성
- GitHub MCP를 통해 `rorr-infra-terraform` 레포에 PR 자동 생성
- AWS 리소스 read-only 조회 도구 제공

## 노출 도구

| Tool | 용도 |
|---|---|
| `handle_infra_request` | 자연어 → .tf 생성 + PR (메인 진입점) |
| `aws_describe_*` (10개) | SG/ECS/ALB/VPC/Subnet/Listener/TargetHealth/Logs 등 read-only |

## 외부 의존

### Inbound (이 MCP에 접속하는 쪽)
- 오케스트레이터 (`rorr-orchestrator`) — `.env`의 `MCP_INFRA_URL`로 등록
- Claude Code 사용자 — `claude mcp add rorr-infra http://<host>:5010/mcp`

### Outbound (이 MCP가 호출하는 쪽)
`.mcp.json`에 선언 (Claude Desktop과 동일 컨벤션):
```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
    }
  }
}
```

## 인증

### LLM (Claude Code CLI, OAuth)
- SSM `/rorr-mcp-infra/claude-credentials` (SecureString) → `entrypoint.sh`가 `~/.claude/.credentials.json`에 주입
- 코드는 `claude -p ...` 자식 프로세스 호출 (Bedrock/Anthropic API 미사용)
- 토큰 만료 시: 로컬에서 `claude` 한 번 실행 → macOS Keychain → SSM put-parameter → ECS force-new-deployment

### GitHub (사용자별 OAuth)
- 오케스트레이터의 GitHub OAuth 로그인으로 발급된 사용자 토큰을 `Authorization: Bearer <token>` 헤더로 받음
- `requestContext.js`의 AsyncLocalStorage가 tool 핸들러까지 전파
- github MCP 호출 시 사용자 토큰 그대로 사용 → **PR 작성자가 실제 로그인 사용자로 찍힘** (봇 PAT 미사용)

## PR 생성 경로

`handle_infra_request`는 두 경로 지원:

1. **GitHub MCP 경유** (기본): `.mcp.json`의 github 서버를 통해 `create_branch` + `push_files` + `create_pull_request`
2. **로컬 git 폴백**: GitHub MCP 실패 시 자동으로 `git clone/push` + GitHub REST API

환경변수 `PR_VIA_GITHUB_MCP=false`로 폴백 강제 가능.

## 회사 규칙 (LLM이 자동으로 따름)

`resources/*.md` + `prompts/*.md`를 시스템 프롬프트로 자동 주입:
- `aws-conventions.md` — 네이밍/태그 규칙
- `network-topology.md` — VPC/Subnet/SG/ALB ID (data source 사용법)
- `security-policy.md` — 보안그룹, 암호화 정책
- `cost-policy.md` — 인스턴스 타입/lifecycle
- `state-management.md` — Terraform state 백엔드
- `recovery-policy.md` — 장애 대응
- `prompts/generate_<resource>.md` — 리소스별 체크리스트

규칙 변경 시 `.md`만 수정/푸시하면 자동 재배포 후 모든 미래 PR에 반영.

## 핵심 운영 정보

| 항목 | 값 |
|---|---|
| AWS Profile | `rorr-dev` (Account 239460481239) |
| ECR | `rorr-mcp-infra` |
| ECS Cluster | `mcp-agents-staging-cluster` (공유) |
| ECS Service | `rorr-mcp-infra-service` |
| Task Role | `rorr-mcp-infra-task` (SSM GetParameter — Claude OAuth credentials) |
| ALB 포트 | `5010` |
| 외부 URL | `http://mcp-agents-staging-alb-249976027.us-east-1.elb.amazonaws.com:5010/mcp` |

## 테스트

```bash
# 헬스체크
curl http://<host>:5010/health

# 오케스트레이터 경유 (가장 일반적)
curl -X POST http://orchestrator-host:4000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"dev에 S3 만들어줘"}]}'
```

## 배포

`main`에 푸시하면 GitHub Actions가 ECR 빌드/푸시 → ECS force-new-deployment.

## 향후 로드맵

1. ✅ LLM: Claude Code CLI + SSM OAuth 토큰 (완료)
2. ✅ 사용자 인증: GitHub OAuth SSO + 토큰 전파 (완료, 봇 PAT 제거)
3. 다른 도메인 MCP (frontend/backend)에 같은 패턴 복제 (`handle_*_request` + `clients/githubMcp.js`로 자기 repo PR)
4. HTTPS + 도메인 (`chat.rorr.club`) → claude.ai Connectors 호환
5. PR 결과 스트리밍 (단계별 진행 표시)
