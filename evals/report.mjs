/*
 * evals/report.mjs — eval実行履歴の推移表（無料・LLM不使用）
 *
 *   evals/results/*.json を時系列に並べ、お題ごとのPASS/FAIL推移を表示する。
 *   relay-design-systemのevals/report.mjsを簡略化したもの。
 *
 *   実行: npm run eval:report
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyResult, STATUS_SYMBOL } from "./status.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "results");

if (!fs.existsSync(resultsDir)) {
  console.log("実行履歴がありません。npm run eval を先に実行してください。");
  process.exit(0);
}

const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith(".json")).sort();
if (!files.length) {
  console.log("実行履歴がありません。npm run eval を先に実行してください。");
  process.exit(0);
}

const runs = files.map((f) => ({
  stamp: f.replace(".json", ""),
  ...JSON.parse(fs.readFileSync(path.join(resultsDir, f), "utf8")),
}));

const allIds = [...new Set(runs.flatMap((r) => r.results.map((x) => x.id)))].sort();

console.log(`実行回数: ${runs.length}\n`);
console.log(["お題", ...runs.map((r) => r.stamp.slice(0, 10))].join("\t"));
for (const id of allIds) {
  const row = runs.map((r) => {
    const found = r.results.find((x) => x.id === id);
    if (!found) return "-";
    return STATUS_SYMBOL[classifyResult(found)] ?? "?";
  });
  console.log([id, ...row].join("\t"));
}

const last = runs.at(-1);
console.log(`\n最新実行（${last.stamp}）: ${last.passed}/${last.total} PASS${last.errors ? `（測定不能 ${last.errors}）` : ""}`);
