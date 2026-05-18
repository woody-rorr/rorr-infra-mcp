import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { withTerraformRepo } from "../lib.js";
import { getGithubMcp, callGithubTool } from "../clients/githubMcp.js";
import { runClaude } from "../clients/claudeCli.js";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const DEFAULT_USE_GITHUB_MCP = process.env.PR_VIA_GITHUB_MCP !== "false";

let _systemPromptCache = null;
async function buildSystemPrompt() {
  if (_systemPromptCache) return _systemPromptCache;
  const sections = [
    "# Role",
    "당신은 rorr의 AWS 인프라 전문 에이전트입니다. 사용자의 자연어 인프라 요청을 받아 회사 규칙에 맞는 Terraform 코드를 생성합니다.",
    "",
    "## 출력 형식 (반드시 JSON만, 다른 설명 금지)",
    "```json",
    "{",
    '  "files": { "environments/dev/<name>.tf": "<.tf 전체 내용>", ... },',
    '  "branch": "agent/infra/<short-slug-with-timestamp>",',
    '  "title": "<PR 제목>",',
    '  "body": "<PR 본문, 변경 요약/체크리스트 포함>"',
    "}",
    "```",
    "",
    "## 규칙",
    "- 모든 ID/ARN은 하드코딩 금지, data source 사용 (network-topology.md 패턴 참조)",
    "- dev 환경만 (prod 절대 금지)",
    "- 브랜치명에 timestamp 또는 짧은 해시 포함 (동시 호출 시 충돌 방지)",
    "- destroy 가능성 있으면 본문에 명시",
    "- 답변은 위 JSON 한 덩어리. 백틱/마크다운 펜스 없이 raw JSON.",
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

async function createPrViaLocalGit(plan) {
  return await withTerraformRepo(async ({ tmpDir, owner, repo, token, baseBranch }) => {
    await execAsync(`git checkout -b ${plan.branch}`, { cwd: tmpDir });
    for (const [rel, content] of Object.entries(plan.files)) {
      const safe = path.normalize(rel);
      if (safe.startsWith("..") || path.isAbsolute(safe)) throw new Error(`Invalid path: ${rel}`);
      const full = path.join(tmpDir, safe);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, "utf8");
    }
    await execAsync(`git config user.email "infra-agent@rorr.club"`, { cwd: tmpDir });
    await execAsync(`git config user.name "rorr-infra-agent"`, { cwd: tmpDir });
    await execAsync("git add -A", { cwd: tmpDir });
    await execAsync(`git commit -m "${plan.title.replace(/"/g, "'")}"`, { cwd: tmpDir });
    await execAsync(`git push -u origin ${plan.branch}`, { cwd: tmpDir });

    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
      body: JSON.stringify({ title: plan.title, body: plan.body ?? "", head: plan.branch, base: baseBranch }),
    });
    const pr = await r.json();
    if (!r.ok) throw new Error(`GitHub API: ${JSON.stringify(pr)}`);
    return pr.html_url;
  });
}

export function registerHandleInfraRequest(server) {
  server.tool(
    "handle_infra_request",
    "자연어 인프라 요청을 받아 회사 규칙에 맞는 Terraform 코드 생성 + GitHub PR까지 자체 처리. LLM은 Claude OAuth(CLI), PR은 GitHub MCP 우선.",
    {
      user_message: z.string().describe("자연어 인프라 요청. 예: 'dev에 S3 버킷 만들어줘'"),
      user_token: z.string().optional().describe("사용자별 GitHub OAuth 토큰. 없으면 봇 토큰 사용."),
    },
    async ({ user_message, user_token }) => {
      try {
        const system = await buildSystemPrompt();
        const plan = await callLLM(system, user_message);

        if (!plan.files || typeof plan.files !== "object" || !Object.keys(plan.files).length) {
          return { content: [{ type: "text", text: "Error: LLM이 files 비어 있음" }] };
        }
        if (!plan.branch || !plan.title) {
          return { content: [{ type: "text", text: "Error: LLM이 branch/title 누락" }] };
        }

        let url = null, via = null, errors = [];

        if (DEFAULT_USE_GITHUB_MCP) {
          try {
            url = await createPrViaGithubMcp(plan, user_token);
            via = user_token ? "github-mcp (user token)" : "github-mcp (bot token)";
          } catch (e) {
            errors.push(`github-mcp: ${e.message}`);
          }
        }

        if (!url) {
          url = await createPrViaLocalGit(plan);
          via = "local-git (fallback)";
        }

        const errorsLine = errors.length ? `\n\n⚠️ 시도 중 발생:\n${errors.map(e => "- " + e).join("\n")}` : "";

        return {
          content: [{
            type: "text",
            text: `✅ PR 생성됨 (${via}): ${url}\n\n## 변경 파일\n${Object.keys(plan.files).map(f => "- " + f).join("\n")}\n\n## 본문\n${plan.body ?? "(없음)"}${errorsLine}`,
          }],
        };
      } catch (e) {
        return { content: [{ type: "text", text: `Error in handle_infra_request: ${e.message}` }] };
      }
    }
  );
}
