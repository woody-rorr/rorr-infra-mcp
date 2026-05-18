// GitHub MCP에 outbound 연결.
// - 기본은 봇 토큰(GITHUB_MCP_TOKEN, SSM에서 entrypoint로 주입)으로 영구 연결 유지.
// - 사용자 토큰(향후 GitHub OAuth) 전달 시 일회성 클라이언트 생성.
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

let _botState = null; // { client, tools }

async function buildClient(token) {
  const client = new Client({ name: "rorr-infra-mcp-as-github-client", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(GITHUB_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  const { tools } = await client.listTools();
  return { client, tools };
}

// 봇 토큰 기반 영구 연결 (서버 부팅 시 1회)
export async function getGithubMcp({ userToken } = {}) {
  if (userToken) {
    try {
      return await buildClient(userToken);  // 사용자별 토큰: 일회성 (캐시 X)
    } catch (e) {
      console.error("[github-mcp] user-token connect failed:", e.message);
      return { client: null, tools: [] };
    }
  }
  if (_botState) return _botState;
  const token = process.env.GITHUB_MCP_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn("[github-mcp] no bot token (GITHUB_MCP_TOKEN/GITHUB_TOKEN) — skipping");
    _botState = { client: null, tools: [] };
    return _botState;
  }
  try {
    _botState = await buildClient(token);
    console.log(`[github-mcp] bot connected (${_botState.tools.length} tools)`);
    return _botState;
  } catch (e) {
    console.error("[github-mcp] bot connect failed:", e.message);
    _botState = { client: null, tools: [] };
    return _botState;
  }
}

export async function callGithubTool(name, args, { userToken } = {}) {
  const { client } = await getGithubMcp({ userToken });
  if (!client) throw new Error("github-mcp not connected");
  return await client.callTool({ name, arguments: args });
}
