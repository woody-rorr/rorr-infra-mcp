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
| `create_pr` | 파일 내용 직접 받아 PR 생성 (raw, 폴백) |
| `aws_describe_*` (10개) | SG/ECS/ALB/VPC/Subnet/Listener/TargetHealth/Logs 등 read-only |
| `gh_*` (50+) | GitHub MCP의 모든 tool을 재노출 (PR 머지/조회/Actions 로그 등) |

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
      "tokenEnv": "GITHUB_MCP_TOKEN",
      "proxyPrefix": "gh_"
    }
  }
}
```

## 인증

### LLM (현재: Bedrock)
- ECS Task Role 자동 (IAM 정책에 Bedrock InvokeModel 권한)
- 코드 1줄: `new BedrockRuntimeClient({ region })`
- 향후 전환 예정: **Claude Code + SSM OAuth 토큰** (메모리 기록됨)

### GitHub (현재: 봇 PAT)
- SSM `/rorr-mcp-infra/github-token` → entrypoint.sh가 `GITHUB_TOKEN` / `GITHUB_MCP_TOKEN`으로 export
- 향후: **사용자별 GitHub OAuth 토큰**을 오케스트레이터에서 `user_token` 인자로 전달
- 그러면 PR 작성자가 실제 사람 이름으로 찍힘

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
| Task Role | `rorr-mcp-infra-task` (Bedrock+SSM 권한) |
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

## 향후 로드맵 (저장된 결정사항)

1. LLM을 Bedrock → **Claude Code + SSM OAuth 토큰**으로 전환 (시기 미정)
2. 사용자 인증: **GitHub OAuth SSO** 도입 → `user_token`을 오케스트레이터에서 전파
3. 다른 도메인 MCP (frontend/backend)에 같은 패턴 복제 (`handle_*_request` + `.mcp.json` outbound)
4. HTTPS + 도메인 (`chat.rorr.club`) → claude.ai Connectors 호환
