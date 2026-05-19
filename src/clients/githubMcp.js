// GitHub MCP에 outbound 연결. 매 호출마다 사용자 OAuth 토큰으로 일회성 클라이언트 생성.
// 봇 토큰 미사용: 모든 PR이 로그인한 사용자 명의로 찍히도록 강제.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_CONFIG_PATH = path.resolve(__dirname, "../../.mcp.json");

function readMcpUrl(name = "github") {
  try {
    const cfg = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, "utf8"));
    return cfg.mcpServers?.[name]?.url ?? null;
  } catch {
    return null;
  }
}

const GITHUB_MCP_URL = process.env.GITHUB_MCP_URL || readMcpUrl("github") || "https://api.githubcopilot.com/mcp/";

async function buildClient(token) {
  const client = new Client({ name: "rorr-infra-mcp-as-github-client", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(GITHUB_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  const { tools } = await client.listTools();
  return { client, tools };
}

export async function getGithubMcp({ userToken } = {}) {
  if (!userToken) throw new Error("github-mcp: userToken required (no bot fallback)");
  return await buildClient(userToken);
}

export async function callGithubTool(name, args, { userToken } = {}) {
  const { client } = await getGithubMcp({ userToken });
  return await client.callTool({ name, arguments: args });
}
