// GitHub MCP에 outbound 연결 — Claude 호출 시 도구로 함께 노출하기 위함.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const GITHUB_MCP_URL = process.env.GITHUB_MCP_URL || "https://api.githubcopilot.com/mcp/";

let _state = null; // { client, tools }

export async function getGithubMcp() {
  if (_state) return _state;
  const token = process.env.GITHUB_MCP_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn("[github-mcp] no token (GITHUB_MCP_TOKEN/GITHUB_TOKEN) — skipping connect");
    _state = { client: null, tools: [] };
    return _state;
  }
  try {
    const client = new Client({ name: "rorr-infra-mcp-as-github-client", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(GITHUB_MCP_URL), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    await client.connect(transport);
    const { tools } = await client.listTools();
    console.log(`[github-mcp] connected (${tools.length} tools)`);
    _state = { client, tools };
    return _state;
  } catch (e) {
    console.error("[github-mcp] connect failed:", e.message);
    _state = { client: null, tools: [] };
    return _state;
  }
}

export async function callGithubTool(name, args) {
  const { client } = await getGithubMcp();
  if (!client) throw new Error("github-mcp not connected");
  return await client.callTool({ name, arguments: args });
}
