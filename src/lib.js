import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export function parseRepoUrl(url) {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!m) throw new Error(`Cannot parse GitHub repo URL: ${url}`);
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

export async function withTerraformRepo(fn) {
  const repoUrl = process.env.TERRAFORM_GITHUB_REPO_URL;
  const token = process.env.GITHUB_TOKEN;
  const baseBranch = process.env.BASE_BRANCH || "main";
  if (!repoUrl) throw new Error("GITHUB_REPO_URL 미설정");
  if (!token) throw new Error("GITHUB_TOKEN 미설정");
  const { owner, repo } = parseRepoUrl(repoUrl);
  const authedUrl = `https://${token}@github.com/${owner}/${repo}.git`;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tf-"));
  try {
    await execAsync(`git clone --depth=1 --branch ${baseBranch} ${authedUrl} .`, { cwd: tmpDir });
    return await fn({ tmpDir, owner, repo, token, baseBranch });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export async function runTerraform(args, cwd) {
  const { stdout, stderr } = await execAsync(`terraform ${args}`, {
    cwd,
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout + (stderr ? `\n[stderr]\n${stderr}` : "");
}
