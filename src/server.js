import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { registerCreatePr } from "./tools/createPr.js";
import { registerAwsDescribe } from "./tools/awsDescribe.js";
import { registerHandleInfraRequest } from "./tools/handleInfraRequest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.env.PORT || "5010", 10);

function listMd(dir) {
  try {
    return fs.readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ name: f, full: path.join(ROOT, dir, f), uri: `file:///${dir}/${f}` }));
  } catch { return []; }
}

function createServer() {
  const server = new McpServer({ name: "rorr-infra-mcp", version: "0.3.0" });

  // resources / prompts 디렉토리의 모든 .md를 MCP resources로 노출
  for (const dir of ["resources", "prompts"]) {
    for (const { name, full, uri } of listMd(dir)) {
      server.resource(
        `${dir}/${name}`,
        uri,
        { description: `${dir} document: ${name}`, mimeType: "text/markdown" },
        async () => ({ contents: [{ uri, mimeType: "text/markdown", text: fs.readFileSync(full, "utf8") }] })
      );
    }
  }

  // Tools
  registerCreatePr(server);
  registerAwsDescribe(server);
  registerHandleInfraRequest(server);

  return server;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

const transports = new Map();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sid) => { transports.set(sid, transport); },
    });
    transport.onclose = () => { if (transport.sessionId) transports.delete(transport.sessionId); };
    const server = createServer();
    await server.connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method Not Allowed" }, id: null });
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) return res.status(404).end();
  await transport.handleRequest(req, res);
});

app.get("/health", (_, res) => res.json({ status: "ok", server: "rorr-infra-mcp" }));

app.listen(PORT, () => process.stdout.write(`rorr-infra-mcp running on :${PORT}\n`));
