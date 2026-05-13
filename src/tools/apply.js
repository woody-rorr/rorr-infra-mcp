import { z } from "zod";
import { withTerraformRepo, runTerraform } from "../lib.js";
import path from "path";

export function registerApply(server) {
  server.tool(
    "run_apply",
    "⚠️ terraform apply 실행 (dev/staging만). prod는 MCP에서 차단됨.",
    {
      environment: z.enum(["dev", "staging", "prod"]).default("dev"),
      confirm: z.boolean().describe("반드시 true. 실수 방지용"),
    },
    async ({ environment, confirm }) => {
      if (!confirm) return { content: [{ type: "text", text: "Error: confirm=true 필요" }] };
      if (environment === "prod") {
        return { content: [{ type: "text", text: "Error: prod apply는 MCP에서 차단됨. GitHub Actions로만." }] };
      }
      const out = await withTerraformRepo(async ({ tmpDir }) => {
        const envDir = path.join(tmpDir, "environments", environment);
        await runTerraform("init -input=false -no-color", envDir);
        return await runTerraform("apply -auto-approve -no-color -input=false", envDir);
      });
      return { content: [{ type: "text", text: out.slice(0, 60000) }] };
    }
  );
}
