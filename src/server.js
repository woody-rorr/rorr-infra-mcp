import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { registerPlan } from "./tools/plan.js";
import { registerApply } from "./tools/apply.js";
import { registerCreatePr } from "./tools/createPr.js";

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
  registerPlan(server);
  registerApply(server);
  registerCreatePr(server);

  return server;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on("close", () => { server.close(); });
});

app.get("/mcp", (_, res) => res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method Not Allowed" }, id: null }));
app.delete("/mcp", (_, res) => res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method Not Allowed" }, id: null }));

app.get("/health", (_, res) => res.json({ status: "ok", server: "rorr-infra-mcp" }));

app.listen(PORT, () => process.stdout.write(`rorr-infra-mcp running on :${PORT}\n`));
