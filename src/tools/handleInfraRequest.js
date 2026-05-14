import { z } from "zod";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { withTerraformRepo } from "../lib.js";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
const MODEL = process.env.INFRA_LLM_MODEL || process.env.LLM_MODEL || "us.anthropic.claude-opus-4-5-20251101-v1:0";

let _systemPromptCache = null;
async function buildSystemPrompt() {
  if (_systemPromptCache) return _systemPromptCache;
  const sections = [
    "# Role",
    "당신은 rorr의 AWS 인프라 전문 에이전트입니다. 사용자의 자연어 인프라 요청을 받아 회사 규칙에 맞는 Terraform 코드를 생성합니다.",
    "",
    "## 출력 형식 (반드시 JSON만, 다른 설명 금지)",
    "```json",
    '{',
    '  "files": { "environments/dev/<name>.tf": "<.tf 전체 내용>", ... },',
    '  "branch": "agent/infra/<short-slug-with-timestamp>",',
    '  "title": "<PR 제목>",',
    '  "body": "<PR 본문, 변경 요약/체크리스트 포함>"',
    '}',
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
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userMessage }],
  };
  const res = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(body),
  }));
  const json = JSON.parse(new TextDecoder().decode(res.body));
  const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
  if (!text) throw new Error("Empty LLM response");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in response: " + text.slice(0, 300));
  return JSON.parse(text.slice(start, end + 1));
}

export function registerHandleInfraRequest(server) {
  server.tool(
    "handle_infra_request",
    "자연어 인프라 요청을 받아 회사 규칙에 맞는 Terraform 코드 생성 + GitHub PR까지 자체 처리.",
    {
      user_message: z.string().describe("자연어 인프라 요청. 예: 'dev에 S3 버킷 만들어줘'"),
    },
    async ({ user_message }) => {
      try {
        const system = await buildSystemPrompt();
        const plan = await callLLM(system, user_message);

        if (!plan.files || typeof plan.files !== "object" || !Object.keys(plan.files).length) {
          return { content: [{ type: "text", text: "Error: LLM이 files 비어 있음" }] };
        }
        if (!plan.branch || !plan.title) {
          return { content: [{ type: "text", text: "Error: LLM이 branch/title 누락" }] };
        }

        const url = await withTerraformRepo(async ({ tmpDir, owner, repo, token, baseBranch }) => {
          await execAsync(`git checkout -b ${plan.branch}`, { cwd: tmpDir });

          for (const [rel, content] of Object.entries(plan.files)) {
            const safe = path.normalize(rel);
            if (safe.startsWith("..") || path.isAbsolute(safe)) {
              throw new Error(`Invalid path: ${rel}`);
            }
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
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.github.v3+json",
            },
            body: JSON.stringify({ title: plan.title, body: plan.body ?? "", head: plan.branch, base: baseBranch }),
          });
          const pr = await r.json();
          if (!r.ok) throw new Error(`GitHub API: ${JSON.stringify(pr)}`);
          return pr.html_url;
        });

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
