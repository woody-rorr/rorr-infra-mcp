import { z } from "zod";
import { withTerraformRepo, runTerraform } from "../lib.js";
import path from "path";
import fs from "fs/promises";

export function registerPlan(server) {
  server.tool(
    "run_plan",
    "terraform plan 실행. local_path가 주어지면 로컬 폴더에서, 없으면 GITHUB_REPO_URL을 main에서 fresh clone.",
    {
      environment: z.enum(["dev", "staging", "prod"]).default("dev"),
      local_path: z.string().optional().describe("로컬 terraform 레포 경로. Claude가 .tf를 수정한 폴더. 없으면 원격 fresh clone."),
    },
    async ({ environment, local_path }) => {
      let out;
      if (local_path) {
        // 로컬 폴더의 변경사항 반영해서 plan
        const envDir = path.join(local_path, "environments", environment);
        try { await fs.access(envDir); } catch {
          return { content: [{ type: "text", text: `Error: ${envDir} 없음` }] };
        }
        await runTerraform("init -input=false -no-color", envDir);
        out = await runTerraform("plan -no-color -input=false", envDir);
      } else {
        // 원격 main 브랜치 fresh clone
        out = await withTerraformRepo(async ({ tmpDir }) => {
          const envDir = path.join(tmpDir, "environments", environment);
          await runTerraform("init -input=false -no-color", envDir);
          return await runTerraform("plan -no-color -input=false", envDir);
        });
      }
      return { content: [{ type: "text", text: out.slice(0, 60000) }] };
    }
  );
}
