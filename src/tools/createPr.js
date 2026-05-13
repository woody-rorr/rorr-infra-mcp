import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { parseRepoUrl } from "../lib.js";

const execAsync = promisify(exec);

export function registerCreatePr(server) {
  server.tool(
    "create_pr",
    "현재 변경된 로컬 terraform 디렉토리를 새 브랜치로 push하고 GitHub PR을 생성합니다.",
    {
      local_path: z.string().describe("로컬 terraform 레포 경로 (이미 변경 적용된 상태)"),
      branch: z.string().describe("브랜치명 (예: agent/infra/add-s3)"),
      title: z.string().describe("PR 제목"),
      body: z.string().default("").describe("PR 본문 (plan 결과 등 포함 권장)"),
    },
    async ({ local_path, branch, title, body }) => {
      const token = process.env.GITHUB_TOKEN;
      const repoUrl = process.env.GITHUB_REPO_URL;
      const baseBranch = process.env.BASE_BRANCH || "main";
      if (!token || !repoUrl) {
        return { content: [{ type: "text", text: "Error: GITHUB_TOKEN / GITHUB_REPO_URL 미설정" }] };
      }
      const { owner, repo } = parseRepoUrl(repoUrl);

      await execAsync(`git checkout -b ${branch}`, { cwd: local_path }).catch(() => {});
      await execAsync("git add -A", { cwd: local_path });
      await execAsync(`git commit -m "${title.replace(/"/g, "'")}"`, { cwd: local_path });
      await execAsync(`git push -u origin ${branch}`, { cwd: local_path });

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
      return { content: [{ type: "text", text: `✅ PR: ${pr.html_url}` }] };
    }
  );
}
