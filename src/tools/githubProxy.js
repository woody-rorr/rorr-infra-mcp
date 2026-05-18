// GitHub MCP의 모든 tool을 infra MCP의 tool로 재노출 (proxy).
// 호출 시 GitHub MCP에 그대로 위임. 사용자 토큰은 ALS로 자동 전파.
import { getGithubMcp, callGithubTool } from "../clients/githubMcp.js";
import { getUserToken } from "../requestContext.js";

export async function registerGithubProxy(server) {
  const { client, tools } = await getGithubMcp();
  if (!client || !tools.length) {
    console.warn("[github-proxy] github MCP unavailable — skip proxy registration");
    return;
  }

  for (const t of tools) {
    server.tool(
      `gh_${t.name}`,
      `[github] ${t.description ?? ""}`,
      // inputSchema는 그대로 위임 (Zod 변환 없이 사용 가능한 형태이면)
      t.inputSchema?.properties ?? {},
      async (args) => {
        try {
          const userToken = getUserToken();
          const res = await callGithubTool(t.name, args, { userToken });
          return res;
        } catch (e) {
          return { content: [{ type: "text", text: `Error gh_${t.name}: ${e.message}` }] };
        }
      }
    );
  }
  console.log(`[github-proxy] registered ${tools.length} gh_* tools`);
}
