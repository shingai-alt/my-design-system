/**
 * リモートMCP（Cloudflare Workers）用に、MCPが読むファイルを1つのJSONに固める。
 *   output: dist/mcp-files.json（{ "相対パス": "中身" }）
 * Workers はディスクを読めないので、worker.mjs がこのJSONをバンドルに埋め込んで使う。
 * 正本は元のファイルのまま。wrangler.toml の [build] がデプロイ前に毎回実行する。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { SOURCE_FILES } from "../src/mcp/handlers.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const files = Object.fromEntries(SOURCE_FILES.map((rel) => [rel, readFileSync(resolve(ROOT, rel), "utf8")]));

mkdirSync(resolve(ROOT, "dist"), { recursive: true });
writeFileSync(resolve(ROOT, "dist/mcp-files.json"), JSON.stringify(files));
console.log(`✓ dist/mcp-files.json（${SOURCE_FILES.length} files）`);
