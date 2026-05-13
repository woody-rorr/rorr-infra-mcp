import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { withTerraformRepo } from "../lib.js";

const execAsync = promisify(exec);

export function registerCreatePr(server) {
  server.tool(
    "create_pr",
    "전달받은 파일 내용으로 terraform 레포에 새 브랜치 push + PR 생성. 서버가 fresh clone부터 끝까지 처리.",
    {
      files: z.record(z.string(), z.string()).describe("레포 루트 기준 상대경로 → 파일 내용 (예: { 'environments/dev/s3.tf': '...' })"),
      branch: z.string().describe("브랜치명 (예: agent/infra/add-s3)"),
      title: z.string().describe("PR 제목"),
      body: z.string().default("").describe("PR 본문"),
    },
    async ({ files, branch, title, body }) => {
      if (!files || Object.keys(files).length === 0) {
        return { content: [{ type: "text", text: "Error: files 비어 있음" }] };
      }
      try {
        const result = await withTerraformRepo(async ({ tmpDir, owner, repo, token, baseBranch }) => {
          await execAsync(`git checkout -b ${branch}`, { cwd: tmpDir });

          for (const [relPath, content] of Object.entries(files)) {
            const safe = path.normalize(relPath);
            if (safe.startsWith("..") || path.isAbsolute(safe)) {
              throw new Error(`Invalid path: ${relPath}`);
            }
            const full = path.join(tmpDir, safe);
            await fs.mkdir(path.dirname(full), { recursive: true });
            await fs.writeFile(full, content, "utf8");
          }

          await execAsync(`git config user.email "mcp-bot@rorr.club"`, { cwd: tmpDir });
          await execAsync(`git config user.name "rorr-mcp-bot"`, { cwd: tmpDir });
          await execAsync("git add -A", { cwd: tmpDir });
          await execAsync(`git commit -m "${title.replace(/"/g, "'")}"`, { cwd: tmpDir });
          await execAsync(`git push -u origin ${branch}`, { cwd: tmpDir });

          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.github.v3+json",
            },
            body: JSON.stringify({ title, body, head: branch, base: baseBranch }),
          });
          const pr = await res.json();
          if (!res.ok) throw new Error(`GitHub API: ${JSON.stringify(pr)}`);
          return pr.html_url;
        });
        return { content: [{ type: "text", text: `✅ PR: ${result}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }] };
      }
    }
  );
}
