import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getGithubMcp, callGithubTool } from "../clients/githubMcp.js";
import { runClaude } from "../clients/claudeCli.js";
import { getUserToken } from "../requestContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

let _systemPromptCache = null;
async function buildSystemPrompt() {
  if (_systemPromptCache) return _systemPromptCache;
  const sections = [
    "# 역할",
    "당신은 **rorr의 AWS Terraform 코드 생성 전문 에이전트**입니다. 자연어 요청을 받아 회사 규칙에 부합하는 Terraform 코드를 JSON 한 덩어리로 반환합니다.",
    "",
    "# 절대 규칙 (위반 시 즉시 실패)",
    "1. **출력은 raw JSON 한 덩어리만**. 백틱/펜스/주석/설명/사과 텍스트 일체 금지.",
    "2. **dev 환경만**. `environments/dev/` 외 경로 작성 금지. prod·staging 절대 금지.",
    "3. **ID/ARN/리소스 ID 하드코딩 금지**. 반드시 data source 사용 (network-topology.md 패턴 참조).",
    "4. **회사 표준 모듈 우선**. resources/*.md, prompts/*.md에 기재된 모듈/네이밍/태깅 규칙 100% 준수.",
    "5. **범위 밖 작업 거부**. 백엔드 코드/프론트엔드/문서/PR 코멘트 작성 등 요청 받으면 빈 files + 본문에 거부 사유 명시.",
    "6. **추측 금지**. 사용자 메시지에 없는 리소스명/태그/사이즈는 회사 기본값(.md 참조)으로 채우거나 본문에 TODO로 표기.",
    "7. **브랜치명에 timestamp/short hash 필수**. 형식: `agent/infra/<short-slug>-<unix_ts>` 또는 `agent/infra/<short-slug>-<8자해시>`.",
    "8. **destroy/replace 가능성**: 기존 리소스 변경/삭제 가능성 있으면 PR body 최상단에 ⚠️ 경고 + 영향 범위 명시.",
    "9. **terraform validate 통과 가능한 형식**. provider/variable/output 누락 없이.",
    "",
    "# 출력 형식 (이 외 문자 금지)",
    "```",
    "{",
    '  "files": { "environments/dev/<name>.tf": "<.tf 전체 내용>", "...": "..." },',
    '  "branch": "agent/infra/<short-slug>-<timestamp>",',
    '  "title": "[dev/infra] <간결한 PR 제목>",',
    '  "body": "## 요약\\n- ...\\n\\n## 변경 파일\\n- ...\\n\\n## 체크리스트\\n- [ ] terraform plan 확인\\n- [ ] 보안그룹 영향 검토\\n\\n## 영향/주의\\n- ..."',
    "}",
    "```",
    "",
    "# 안티패턴 (절대 금지)",
    "- ❌ `aws_xxx.example` 같은 placeholder 리소스명 — 의미 있는 이름 사용",
    "- ❌ provider region 하드코딩 — variable 사용",
    "- ❌ count/for_each 없이 환경별 분기 — 회사 패턴 따라 module 호출",
    "- ❌ PR body에 'as requested', '아래와 같이 생성했습니다' 같은 의미 없는 문장",
    "- ❌ JSON 앞뒤에 ```json 펜스, 설명 텍스트, 이모지",
    "",
    "# 회사 컨텍스트 (아래 섹션 모두 system prompt에 포함됨, 반드시 준수)",
    "",
  ];

  for (const dir of ["resources", "prompts"]) {
    let files = [];
    try { files = await fs.readdir(path.join(ROOT, dir)); } catch { continue; }
    for (const f of files.filter((n) => n.endsWith(".md"))) {
      const text = await fs.readFile(path.join(ROOT, dir, f), "utf8");
      sections.push(`## ${dir}/${f}`, text, "");
    }
  }

  _systemPromptCache = sections.join("\n");
  return _systemPromptCache;
}

async function callLLM(system, userMessage) {
  const text = await runClaude({ system, user: userMessage });
  if (!text) throw new Error("Empty Claude response");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in response: " + text.slice(0, 300));
  return JSON.parse(text.slice(start, end + 1));
}

function parseRepoUrl() {
  const repoUrl = process.env.TERRAFORM_GITHUB_REPO_URL;
  if (!repoUrl) throw new Error("TERRAFORM_GITHUB_REPO_URL 미설정");
  const m = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!m) throw new Error(`Cannot parse repo url: ${repoUrl}`);
  return { owner: m[1], repo: m[2].replace(/\.git$/, ""), baseBranch: process.env.BASE_BRANCH || "main" };
}

async function createPrViaGithubMcp(plan, userToken = null) {
  const { client } = await getGithubMcp({ userToken });
  if (!client) return null;
  const { owner, repo, baseBranch } = parseRepoUrl();

  await callGithubTool("create_branch", { owner, repo, branch: plan.branch, sha_from: baseBranch }, { userToken });

  await callGithubTool("push_files", {
    owner, repo, branch: plan.branch,
    files: Object.entries(plan.files).map(([p, content]) => ({ path: p, content })),
    message: plan.title,
  }, { userToken });

  const pr = await callGithubTool("create_pull_request", {
    owner, repo,
    title: plan.title,
    body: plan.body ?? "",
    head: plan.branch,
    base: baseBranch,
  }, { userToken });

  const txt = (pr.content ?? []).map(c => c.text).join("\n");
  const urlMatch = txt.match(/https:\/\/github\.com\/[^\s"]+\/pull\/\d+/);
  return urlMatch ? urlMatch[0] : txt.slice(0, 300);
}

export function registerHandleInfraRequest(server) {
  server.tool(
    "handle_infra_request",
    "자연어 인프라 요청을 받아 회사 규칙에 맞는 Terraform 코드 생성 + GitHub MCP로 PR 생성. PR author = 로그인한 사용자.",
    {
      user_message: z.string().describe("자연어 인프라 요청. 예: 'dev에 S3 버킷 만들어줘'"),
      user_token: z.string().optional().describe("사용자별 GitHub OAuth 토큰. 일반적으로 Authorization 헤더에서 ALS로 자동 주입됨."),
    },
    async ({ user_message, user_token }) => {
      try {
        user_token = user_token || getUserToken();
        if (!user_token) {
          return { content: [{ type: "text", text: "Error: 사용자 GitHub 토큰 없음. 오케스트레이터에 로그인 후 다시 시도하세요." }] };
        }

        const system = await buildSystemPrompt();
        const plan = await callLLM(system, user_message);

        if (!plan.files || typeof plan.files !== "object" || !Object.keys(plan.files).length) {
          return { content: [{ type: "text", text: "Error: LLM이 files 비어 있음" }] };
        }
        if (!plan.branch || !plan.title) {
          return { content: [{ type: "text", text: "Error: LLM이 branch/title 누락" }] };
        }

        const url = await createPrViaGithubMcp(plan, user_token);

        return {
          content: [{
            type: "text",
            text: `✅ PR 생성됨: ${url}\n\n## 변경 파일\n${Object.keys(plan.files).map(f => "- " + f).join("\n")}\n\n## 본문\n${plan.body ?? "(없음)"}`,
          }],
        };
      } catch (e) {
        return { content: [{ type: "text", text: `Error in handle_infra_request: ${e.message}` }] };
      }
    }
  );
}
