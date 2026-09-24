#!/usr/bin/env node
/**
 * Design System — MCP server (stdio)
 *
 *   AIコーディングツール（Claude Code等）にデザインシステムを読ませるための
 *   最小構成MCPサーバー。ツール/リソースのロジックは handlers.mjs にあり、
 *   このファイルはstdio transportへの配線のみを行う。
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHandlers } from "./handlers.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const read = (rel) => {
  const path = resolve(ROOT, rel);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};
const { SERVER_INFO, INSTRUCTIONS, TOOLS, callTool } = createHandlers(read);

const server = new Server(SERVER_INFO, {
  capabilities: { tools: {} },
  instructions: INSTRUCTIONS,
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const r = callTool(name, args);
  const content = [{ type: "text", text: r.text }];
  return r.isError ? { content, isError: true } : { content };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[ds-mcp] v${SERVER_INFO.version} ready — ${TOOLS.length} tools`);
}

main().catch((err) => {
  console.error("[ds-mcp] fatal:", err);
  process.exit(1);
});
