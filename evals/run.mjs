/*
 * evals/run.mjs — Design System 回帰スイート ランナー
 *
 *   固定のお題（cases.mjs）をAIエージェントに解かせ、生成物を採点する。
 *   relay-design-systemのevals/run.mjsを、このDSの規模（MCP最小構成・
 *   トークン/コンポーネントのみ）に合わせて簡略化したもの。
 *
 *   採点は2層:
 *     機械チェック（無料・決定的）: hardcode / classes / patterns
 *       - hardcode: .claude/hooks/ds-hardcode-gate.mjs と同一判定
 *       - classes : 必須クラスの使用 / 捏造variantの検知
 *       - patterns: 必須マークアップ（aria属性等）+ 全お題共通のa11yチェック
 *     LLM審査員（コスト発生）: rubric — コンポーネント選定の妥当性等、
 *       機械で測れない判断
 *
 *   実行:
 *     npm run eval                    # 全お題
 *     npm run eval -- --case invite-form
 *     npm run eval -- --skip-generate # 既存の生成物を再採点（LLM審査のみ消費）
 *     npm run eval -- --skip-judge    # 機械チェックのみ（LLM不使用・無料）
 *     npm run eval -- --votes 3       # 審査3回の多数決（審査側のブレ対策）
 *
 *   CLAUDE_BIN / EVAL_MODEL / EVAL_JUDGE_MODEL 環境変数で調整可能（relayと同様）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";
import { CASES, COMMON_PATTERNS } from "./cases.mjs";
import { classifyResult, isError, STATUS_SYMBOL } from "./status.mjs";
import { summarizeTranscript } from "./transcript.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(__dirname, "output");
const resultsDir = path.join(__dirname, "results");
const hookPath = path.join(projectRoot, ".claude/hooks/ds-hardcode-gate.mjs");

const args = process.argv.slice(2);
const onlyCase = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;
const skipGenerate = args.includes("--skip-generate");
const skipJudge = args.includes("--skip-judge");
const votes = args.includes("--votes") ? Math.max(1, Number(args[args.indexOf("--votes") + 1]) || 1) : 1;

/* ------------------------------------------------------------- claude CLI */

function resolveClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  try {
    return execSync("command -v claude", { encoding: "utf8", shell: "/bin/zsh" }).trim();
  } catch {
    console.error("claude CLI が見つかりません。PATH に追加するか CLAUDE_BIN で指定してください。");
    process.exit(1);
  }
}

/* ------------------------------------------------------------- 生成 */

const MCP_CONFIG = JSON.stringify({
  mcpServers: { "ds-mcp": { command: "node", args: ["src/mcp/server.mjs"] } },
});

function generationPrompt(c) {
  return [
    "あなたはこのDesign Systemを使ってUIを実装するエージェントです。",
    "",
    `以下の要件を満たす完全な単一HTMLページを作成し、Writeツールで evals/output/${c.id}.html に保存してください。`,
    "",
    `要件: ${c.prompt}`,
    "",
    "制約:",
    "- このDSの仕様はMCPツール（ds-mcp）で必ず確認しながら実装すること（get_component / get_tokens / get_design_principles）。",
    "- CSSは同じディレクトリに ds.css として配置済み。<head> で <link rel=\"stylesheet\" href=\"./ds.css\"> を読み込むこと。",
    "- 完成したら保存したファイルパスを1行報告して終了。",
  ].join("\n");
}

function generate(claudeBin, c) {
  const cliArgs = [
    "-p", generationPrompt(c),
    "--mcp-config", MCP_CONFIG,
    "--strict-mcp-config",
    "--allowedTools", "Write,mcp__ds-mcp",
    "--max-turns", "50",
    "--output-format", "stream-json",
    "--verbose",
  ];
  if (process.env.EVAL_MODEL) cliArgs.push("--model", process.env.EVAL_MODEL);
  const res = spawnSync(claudeBin, cliArgs, {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 15 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const transcript = res.stdout ?? "";
  if (res.error) return { ok: false, detail: String(res.error), transcript };
  if (res.status !== 0) return { ok: false, detail: (res.stderr || res.stdout || "").slice(-500), transcript };
  return { ok: true, transcript };
}

/* ------------------------------------------------------------- 機械チェック */

function checkHardcode(filePath) {
  const res = spawnSync("node", [hookPath], {
    input: JSON.stringify({ tool_input: { file_path: filePath } }),
    encoding: "utf8",
  });
  if (res.status === 0) return { pass: true, detail: [] };
  return { pass: false, detail: res.stderr.trim().split("\n").slice(1) };
}

function extractClassTokens(html) {
  const tokens = new Set();
  for (const m of html.matchAll(/class\s*=\s*["']([^"']*)["']/g)) {
    for (const t of m[1].split(/\s+/)) if (t) tokens.add(t);
  }
  return [...tokens];
}

/** 既知クラスの正本は src/components/*.css そのもの（別途index生成が不要な分、簡略）。
 *  セレクタとして書かれている `.foo-bar` の名前をそのまま集める。 */
function loadKnownClasses() {
  const dir = path.join(projectRoot, "src/components");
  const known = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".css")) continue;
    const css = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) known.add(m[1]);
  }
  return known;
}

function checkClasses(html, mustClasses, known) {
  const tokens = extractClassTokens(html);
  const tokenSet = new Set(tokens);
  const missing = mustClasses.filter((c) => !tokenSet.has(c));
  const invented = tokens.filter(
    (t) => !known.has(t) && [...known].some((b) => t.startsWith(`${b}-`)),
  );
  return { pass: missing.length === 0 && invented.length === 0, missing, invented: [...new Set(invented)] };
}

function checkPatterns(html, mustPatterns) {
  const failed = [...COMMON_PATTERNS, ...mustPatterns].filter((p) => {
    const hit = new RegExp(p.pattern).test(html);
    return p.forbid ? hit : !hit;
  });
  return { pass: failed.length === 0, failed: failed.map((p) => p.label) };
}

/* ------------------------------------------------------------- LLM審査員 */

function judgePrompt(c, html) {
  return [
    "あなたはこのDesign Systemの品質審査員です。デザインシステムのルールに生成UIが従っているかを厳格に判定します。",
    "",
    `お題（このHTMLが満たすべき要件）: ${c.prompt}`,
    "",
    "審査項目:",
    ...c.rubric.map((r, i) => `${i + 1}. ${r}`),
    "",
    "対象HTML:",
    "```html",
    html,
    "```",
    "",
    "指示:",
    "- ツールは使わず、このメッセージ内の情報だけで判定すること。",
    "- 項目ごとに pass を true / false で判定し、reason に根拠を40字以内で書くこと。",
    "- 判定に迷う場合・HTMLから確認できない場合は pass: false に倒すこと（甘い審査をしない）。",
    "- 出力は次のJSONのみ。説明文・コードフェンスを付けないこと:",
    `{"verdicts":[{"item":1,"pass":true,"reason":"…"}, …（全${c.rubric.length}項目）]}`,
  ].join("\n");
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

function judgeOnce(claudeBin, c, html) {
  const cliArgs = [
    "-p", judgePrompt(c, html),
    "--strict-mcp-config",
    "--mcp-config", '{"mcpServers":{}}',
    "--max-turns", "4",
  ];
  if (process.env.EVAL_JUDGE_MODEL) cliArgs.push("--model", process.env.EVAL_JUDGE_MODEL);
  const res = spawnSync(claudeBin, cliArgs, {
    cwd: projectRoot, encoding: "utf8", timeout: 5 * 60 * 1000, stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.error || res.status !== 0) return null;
  const parsed = extractJson(res.stdout ?? "");
  return Array.isArray(parsed?.verdicts) ? parsed.verdicts : null;
}

function judgeRubric(claudeBin, c, html) {
  const passVotes = c.rubric.map(() => 0);
  const reasons = c.rubric.map(() => "");
  let validVotes = 0;
  for (let v = 0; v < votes; v++) {
    const verdicts = judgeOnce(claudeBin, c, html) ?? judgeOnce(claudeBin, c, html);
    if (!verdicts) continue;
    validVotes++;
    for (const vd of verdicts) {
      const i = Number(vd.item) - 1;
      if (i < 0 || i >= c.rubric.length) continue;
      if (vd.pass === true) passVotes[i]++;
      else if (!reasons[i]) reasons[i] = String(vd.reason ?? "");
    }
  }
  if (validVotes === 0) return { pass: false, error: "審査員の応答を解析できませんでした（全votes失敗）", items: [] };
  const items = c.rubric.map((text, i) => {
    const pass = passVotes[i] > validVotes / 2;
    return { text, pass, ...(pass ? {} : { reason: reasons[i] }) };
  });
  return { pass: items.every((it) => it.pass), items, validVotes };
}

/* ------------------------------------------------------------- 定点観測 */

function loadPreviousSummary() {
  if (!fs.existsSync(resultsDir)) return null;
  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) return null;
  try {
    return { file: files.at(-1), ...JSON.parse(fs.readFileSync(path.join(resultsDir, files.at(-1)), "utf8")) };
  } catch { return null; }
}

function printComparison(prev, results) {
  if (!prev) return;
  const prevById = new Map((prev.results ?? []).map((r) => [r.id, r]));
  const changed = results.filter((r) => {
    const p = prevById.get(r.id);
    return p && p.pass !== r.pass;
  });
  if (!changed.length) return;
  console.log(`\n前回比（${prev.file}）:`);
  for (const r of changed) {
    const p = prevById.get(r.id);
    console.log(`  ${p.pass ? "✓" : "✗"} → ${r.pass ? "✓" : "✗"}  ${r.id}`);
  }
}

/* ------------------------------------------------------------- 実行 */

const cases = onlyCase ? CASES.filter((c) => c.id === onlyCase) : CASES;
if (!cases.length) {
  console.error(`お題 "${onlyCase}" がありません。利用可能: ${CASES.map((c) => c.id).join(", ")}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });

const known = loadKnownClasses();

// お題の期待値そのもののドリフトを検知する（存在しないクラスを「必須」にするとevalが永久にFAILする）
const badExpectations = CASES.flatMap((c) =>
  c.mustClasses.filter((m) => !known.has(m)).map((m) => `${c.id}: "${m}"`),
);
if (badExpectations.length) {
  console.error("✗ cases.mjs の mustClasses に存在しないクラスがあります（正本: src/components/*.css）:");
  for (const b of badExpectations) console.error(`  - ${b}`);
  process.exit(1);
}

const builtCss = path.join(projectRoot, "dist/ds.css");
if (fs.existsSync(builtCss)) fs.copyFileSync(builtCss, path.join(outputDir, "ds.css"));
else console.warn("⚠ dist/ds.css がありません（npm run build で生成）。採点は可能ですが目視確認はできません。");

const claudeBin = skipGenerate && skipJudge ? null : resolveClaudeBin();
const previous = loadPreviousSummary();
const results = [];
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const archiveDir = path.join(resultsDir, "outputs", stamp);

function runTrial(c) {
  const outPath = path.join(outputDir, `${c.id}.html`);

  // 生成時の行動ログ。error:generation でも保存する（ハーネス故障の診断に使うため）
  let transcriptRef = null;
  let agentMetrics = null;
  if (!skipGenerate) {
    process.stdout.write("  生成中…（数分かかることがあります）\n");
    fs.rmSync(outPath, { force: true });
    for (const f of fs.readdirSync(outputDir)) {
      if (f.endsWith(".html")) fs.rmSync(path.join(outputDir, f), { force: true });
    }
    const gen = generate(claudeBin, c);
    if (gen.transcript) {
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.writeFileSync(path.join(archiveDir, `${c.id}.transcript.jsonl`), gen.transcript);
      transcriptRef = `outputs/${stamp}/${c.id}.transcript.jsonl`;
      agentMetrics = summarizeTranscript(gen.transcript);
      const calls = Object.entries(agentMetrics.toolCalls)
        .map(([name, n]) => (n > 1 ? `${name}×${n}` : name))
        .join(", ");
      console.log(`  ⚙ ${calls || "ツール呼び出しなし"}${agentMetrics.numTurns != null ? ` — ${agentMetrics.numTurns} turns` : ""}`);
    }
    if (!gen.ok) {
      console.error(`  G 生成失敗（ハーネス起因・品質シグナルではない）: ${gen.detail}`);
      return {
        generated: false,
        pass: false,
        status: "error:generation",
        ...(transcriptRef ? { transcript: transcriptRef, agentMetrics } : {}),
      };
    }
  }
  if (!fs.existsSync(outPath)) {
    console.error(`  G 生成物がありません（ハーネス起因・品質シグナルではない）: evals/output/${c.id}.html`);
    return {
      generated: false,
      pass: false,
      status: "error:generation",
      ...(transcriptRef ? { transcript: transcriptRef, agentMetrics } : {}),
    };
  }

  const html = fs.readFileSync(outPath, "utf8");
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.copyFileSync(outPath, path.join(archiveDir, `${c.id}.html`));
  const hardcode = checkHardcode(outPath);
  const classes = checkClasses(html, c.mustClasses, known);
  const patterns = checkPatterns(html, c.mustPatterns);

  console.log(`  ${hardcode.pass ? "✓" : "✗"} hardcode${hardcode.pass ? "" : ` — ${hardcode.detail.length} 件`}`);
  for (const d of hardcode.detail.slice(0, 5)) console.log(`      ${d.trim()}`);
  console.log(`  ${classes.pass ? "✓" : "✗"} classes${classes.missing.length ? ` — 必須クラス不足: ${classes.missing.join(", ")}` : ""}${classes.invented.length ? ` — 捏造variant: ${classes.invented.join(", ")}` : ""}`);
  console.log(`  ${patterns.pass ? "✓" : "✗"} patterns${patterns.failed.length ? ` — 未達: ${patterns.failed.join(" / ")}` : ""}`);

  let rubric = null;
  if (!skipJudge) {
    process.stdout.write(`  審査中…（LLM審査員 × ${votes}）\n`);
    rubric = judgeRubric(claudeBin, c, html);
    if (rubric.error) {
      console.log(`  J rubric判定不能（審査員の故障・品質シグナルではない）— ${rubric.error}`);
    } else {
      console.log(`  ${rubric.pass ? "✓" : "✗"} rubric（${rubric.items.filter((i) => i.pass).length}/${rubric.items.length}）`);
      for (const it of rubric.items.filter((i) => !i.pass)) {
        console.log(`      ✗ ${it.text}${it.reason ? ` — ${it.reason}` : ""}`);
      }
    }
  }

  const machinePass = hardcode.pass && classes.pass && patterns.pass;
  const pass = machinePass && (skipJudge || rubric.pass);
  const status = rubric?.error ? (machinePass ? "error:judge" : "fail") : pass ? "pass" : "fail";
  return {
    generated: true,
    status,
    pass,
    output: `outputs/${stamp}/${c.id}.html`, // 採点したHTMLのアーカイブ（resultsDir相対）
    ...(transcriptRef ? { transcript: transcriptRef, agentMetrics } : {}),
    hardcode,
    classes,
    patterns,
    ...(rubric ? { rubric } : {}),
  };
}

for (const c of cases) {
  process.stdout.write(`\n■ ${c.id}\n`);
  results.push({ id: c.id, ...runTrial(c) });
}

const errorCount = results.filter((r) => isError(classifyResult(r))).length;
const summary = {
  ranAt: new Date().toISOString(),
  model: process.env.EVAL_MODEL ?? "(cli default)",
  judgeModel: skipJudge ? null : process.env.EVAL_JUDGE_MODEL ?? "(cli default)",
  dsVersion: JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")).version,
  skipGenerate, skipJudge, votes,
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  errors: errorCount,
  results,
};
const resultPath = path.join(resultsDir, `${stamp}.json`);
fs.writeFileSync(resultPath, JSON.stringify(summary, null, 2));

if (errorCount) {
  console.log(`\n== PASS ${summary.passed} / FAIL ${summary.total - summary.passed - errorCount} / 測定不能 ${errorCount}（全 ${summary.total}）==`);
  console.log("   測定不能（G/J）はハーネス・審査員の故障で、品質シグナルではありません（詳細は結果JSONのstatus）");
} else {
  console.log(`\n== ${summary.passed}/${summary.total} PASS ==`);
}
printComparison(previous, results);
console.log(`\n結果: evals/results/${path.basename(resultPath)}（生成物: evals/output/*.html をブラウザで目視可）`);
console.log("履歴の一覧: npm run eval:report");
process.exit(results.every((r) => r.pass) && !errorCount ? 0 : 1);
