/*
 * evals/report-html.mjs — eval 結果 + 行動ログの HTML レポート生成（LLM 不使用・無料）
 *
 *   relay-design-system の evals/report-html.mjs を、このDSの規模
 *   （MCP最小構成 get_component/get_tokens/get_design_principles・
 *   trials/compare/regression-capability区分なし）に合わせて簡略化したもの。
 *
 *   evals/results/*.json と行動ログ（outputs/<stamp>/*.transcript.jsonl）から、
 *   人が読める1枚のHTMLレポートを決定的に生成する。内容:
 *     1. 対象実行の合格率サマリー
 *     2. 履歴推移マトリクス
 *     3. お題別カード — 判定・fail理由・計測タイル・タイムライン・
 *        ツール呼び出しシーケンス・「引いた仕様は使われたか」の突合・
 *        自動検出シグナル（巨大応答 / 未使用 / 前回からの変化）
 *
 *   シグナルは機械的な「候補の検出」まで。改善と呼ぶかの切り分けは人の所見で行う。
 *
 *   実行:
 *     npm run eval:report:html                    # 最新実行 → evals/results/report.html
 *     npm run eval:report:html -- --stamp <接頭辞> # 過去の実行を指定
 *     npm run eval:report:html -- --case <id>     # お題で絞り込み
 *     npm run eval:report:html -- --all           # 履歴マトリクスを全件表示（既定20件）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES } from "./cases.mjs";
import { STATUS_SYMBOL, classifyResult, isError } from "./status.mjs";
import { parseToolSequence } from "./transcript.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "results");

const args = process.argv.slice(2);
const showAll = args.includes("--all");
const stampArg = args.includes("--stamp") ? args[args.indexOf("--stamp") + 1] : null;
const caseArg = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;
const noScreens = args.includes("--no-screens"); // 生成画面iframeを省く（相対参照が効かない場所への公開用）

/* ------------------------------------------------------------- data */

const runs = fs.existsSync(resultsDir)
  ? fs.readdirSync(resultsDir).filter((f) => f.endsWith(".json")).sort().map((f) => {
      try {
        return { file: f, stamp: f.replace(/\.json$/, ""), ...JSON.parse(fs.readFileSync(path.join(resultsDir, f), "utf8")) };
      } catch {
        return null;
      }
    }).filter(Boolean)
  : [];

if (!runs.length) {
  console.error("履歴がありません。まず npm run eval を実行してください。");
  process.exit(1);
}

const target = stampArg ? runs.find((r) => r.stamp.startsWith(stampArg)) : runs.at(-1);
if (!target) {
  console.error(`--stamp "${stampArg}" に一致する実行がありません。候補: ${runs.slice(-5).map((r) => r.stamp).join(", ")}`);
  process.exit(1);
}
const prev = runs.filter((r) => r.stamp < target.stamp).at(-1) ?? null;

const caseById = new Map(CASES.map((c) => [c.id, c]));
const targetResults = (target.results ?? []).filter((r) => !caseArg || r.id === caseArg);
if (!targetResults.length) {
  console.error(`対象実行に ${caseArg ? `お題 "${caseArg}" の` : ""}結果がありません。`);
  process.exit(1);
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* 生成された画面をiframe表示するため、対象実行のアーカイブへ ds.css を置く
 *（生成物は <link href="./ds.css"> を参照している。コピーは冪等） */
const builtCss = path.resolve(__dirname, "../dist/ds.css");
const cssReady = fs.existsSync(builtCss);
if (cssReady) {
  const dirs = new Set(targetResults.map((r) => r.output && path.dirname(path.join(resultsDir, r.output))).filter(Boolean));
  for (const d of dirs) if (fs.existsSync(d)) fs.copyFileSync(builtCss, path.join(d, "ds.css"));
} else {
  console.warn("⚠ dist/ds.css がありません（npm run build で生成）。画面プレビューはスタイルなしになります。");
}
const jst = (iso) => (iso ?? "").replace("T", " ").slice(0, 16);

/* ---- ツール分類（このDSのMCP = get_component / get_tokens / get_design_principles のみ） ---- */
const CAT_OF = (name) => {
  if (name === "get_component") return "comp";
  if (name === "Write" || name === "Edit") return "write";
  if (/^get_|^list_/.test(name)) return "found";
  return "harness";
};
const CAT_LABEL = { harness: "ハーネス", found: "基盤知識", comp: "コンポーネント仕様", write: "書き出し" };

/* ---- 集計 ---- */
function tally(run) {
  const st = (run.results ?? []).map(classifyResult);
  return { pass: st.filter((s) => s === "pass").length, total: st.length - st.filter(isError).length, err: st.filter(isError).length };
}

/* ---- 突合 ---- */
function matchFetchedToUsed(seq, htmlPath) {
  const fetched = [...new Set(seq.filter((c) => c.name === "get_component" && c.input?.name).map((c) => String(c.input.name)))];
  if (!fetched.length || !htmlPath || !fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, "utf8");
  const used = new Set();
  for (const m of html.matchAll(/class\s*=\s*["']([^"']*)["']/g)) for (const t of m[1].split(/\s+/)) if (t) used.add(t);
  const prefixesFor = (name) => [name, name.replace("-button", "-btn"), name.replace(/^button$/, "btn")];
  return fetched.map((name) => {
    const hit = [...used].find((cls) => prefixesFor(name).some((p) => cls === p || cls.startsWith(`${p}-`)));
    return { name, used: !!hit, sample: hit ?? null };
  });
}

/* ---- シグナル自動検出（候補の検出まで。切り分けは人の所見で） ---- */
function detectSignals(seq, match, r, prevResult) {
  const signals = [];
  const totalSize = seq.reduce((n, c) => n + (c.size ?? 0), 0);
  for (const c of seq) {
    if ((c.size ?? 0) > 8000 && totalSize && c.size / totalSize > 0.35) {
      signals.push(`巨大応答（${esc(c.name)} が ${c.size.toLocaleString()} 字 = 全応答の ${Math.round((c.size / totalSize) * 100)}%）— 一括返しすぎ。分割の余地`);
    }
  }
  for (const m of match ?? []) {
    if (!m.used) signals.push(`引いたのに未使用（${esc(m.name)}）— 知識と期待の衝突の可能性`);
  }
  if (prevResult) {
    const [ps, cs] = [classifyResult(prevResult), classifyResult(r)];
    if (ps !== cs) {
      signals.push(`前回から変化（${STATUS_SYMBOL[ps]}→${STATUS_SYMBOL[cs]}）— ${cs === "pass" ? "改善に見えても行動ログでメカニズムを確認する（見かけの改善の除外）" : "劣化と断定する前に再実行で確認する（生成ブレの可能性）"}`);
    }
  }
  return signals;
}

/** Bash コマンドが ds.css を grep したか（実CSSを覗いた手つきの検知） */
const isDsCssGrep = (cmd) => /\bgrep\b/.test(cmd ?? "") && /ds\.css/.test(cmd ?? "");

/* ---- お題1件の計測指標（前回比較用） ---- */
function caseMetrics(result) {
  if (!result) return null;
  const m = result.agentMetrics ?? {};
  const seqPath = result.transcript ? path.join(resultsDir, result.transcript) : null;
  const seq = seqPath && fs.existsSync(seqPath) ? parseToolSequence(fs.readFileSync(seqPath, "utf8")) : [];
  return {
    dur: m.durationMs ? Math.round(m.durationMs / 1000) : null,
    turns: m.numTurns ?? null,
    tools: seq.length || null,
    out: m.usage?.output_tokens ?? null,
    think: m.usage?.output_tokens_details?.thinking_tokens ?? null,
    grep: seq.filter((c) => c.name === "Bash" && isDsCssGrep(c.input?.command)).length,
  };
}
const fmtDur = (s) => (s == null ? "?" : `${Math.floor(s / 60)}分${String(s % 60).padStart(2, "0")}秒`);
/** 前→後のセル。lowerBetter=true は減少が改善（緑） */
function cmpCell(a, b, lowerBetter, fmt = (x) => (x == null ? "?" : x.toLocaleString())) {
  if (a == null && b == null) return "—";
  const cls = a === b || a == null || b == null ? "" : (lowerBetter ? b < a : b > a) ? "d-good" : "d-bad";
  return `<span class="${cls}">${fmt(a)} → ${fmt(b)}</span>`;
}
function cmpBlock(cur, base, baseLabel) {
  if (!base) return "";
  const rows = [
    ["所要", cmpCell(base.dur, cur.dur, true, fmtDur)],
    ["ターン", cmpCell(base.turns, cur.turns, true)],
    ["ツール呼び出し", cmpCell(base.tools, cur.tools, true)],
    ["出力トークン", cmpCell(base.out, cur.out, true)],
    ["うち思考", cmpCell(base.think, cur.think, true)],
    ["grep(ds.css)", cmpCell(base.grep, cur.grep, true)],
  ];
  return `<h4>前回比（${esc(baseLabel)} → 今回）</h4>
    <div class="log"><table class="cmp"><tbody>${rows.map(([k, v]) => `<tr><td class="ck">${k}</td><td>${v}</td></tr>`).join("")}</tbody></table></div>
    <p class="muted">grep(ds.css) 減・所要/ターン減が改善方向（緑）。実CSSを覗かずMCPで組めているほど良い。</p>`;
}

/* ---- お題1件の詳細 ---- */
function caseDetailHtml(r, prevResult, prevLabel) {
  const status = classifyResult(r);
  const seqPath = r.transcript ? path.join(resultsDir, r.transcript) : null;
  const seq = seqPath && fs.existsSync(seqPath) ? parseToolSequence(fs.readFileSync(seqPath, "utf8")) : [];
  const m = r.agentMetrics ?? {};
  const htmlPath = r.output ? path.join(resultsDir, r.output) : null;
  const match = seq.length ? matchFetchedToUsed(seq, htmlPath) : null;
  const signals = detectSignals(seq, match, r, prevResult);

  const failParts = [];
  if (r.hardcode && !r.hardcode.pass) failParts.push(`hardcode: ${esc((r.hardcode.detail ?? []).slice(0, 3).join(" / "))}`);
  if (r.classes && !r.classes.pass) failParts.push(`classes: ${esc([...(r.classes.missing ?? []).map((x) => `必須不足 ${x}`), ...(r.classes.invented ?? []).map((x) => `捏造 ${x}`)].join(", "))}`);
  if (r.patterns && !r.patterns.pass) failParts.push(`patterns: ${esc((r.patterns.failed ?? []).join(" / "))}`);
  for (const it of r.rubric?.items ?? []) if (!it.pass) failParts.push(`rubric: ${esc(it.text)}${it.reason ? ` — ${esc(it.reason)}` : ""}`);

  const dur = m.durationMs ? Math.round(m.durationMs / 1000) : null;
  const tiles = `
    <div class="tiles">
      <div class="tile"><div class="k">判定</div><div class="v sym s-${status.replace(":", "-")}">${STATUS_SYMBOL[status]} ${status}</div></div>
      <div class="tile"><div class="k">所要</div><div class="v">${dur != null ? `${Math.floor(dur / 60)}分${String(dur % 60).padStart(2, "0")}秒` : "?"}</div></div>
      <div class="tile"><div class="k">ターン</div><div class="v">${m.numTurns ?? "?"}</div></div>
      <div class="tile"><div class="k">ツール呼び出し</div><div class="v">${seq.length || "?"}<small>回</small></div></div>
      <div class="tile"><div class="k">出力トークン</div><div class="v">${m.usage?.output_tokens?.toLocaleString() ?? "?"}</div><div class="k">うち思考 ${m.usage?.output_tokens_details?.thinking_tokens?.toLocaleString() ?? "?"}</div></div>
    </div>`;

  const total = Math.max(dur ?? 0, seq.at(-1)?.at ?? 0) || null;
  let timeline = "";
  if (total && seq.length) {
    const pct = (s) => ((s / total) * 100).toFixed(2);
    const dots = seq.filter((c) => c.at != null).map((c) =>
      `<i class="dot c-${CAT_OF(c.name)}" style="left:${pct(c.at)}%" title="${esc(c.name)}${c.input?.name ? ` ${esc(c.input.name)}` : ""} — ${c.at}s / ${c.size?.toLocaleString() ?? "?"}字"></i>`).join("");
    const lastCall = seq.filter((c) => c.at != null && CAT_OF(c.name) !== "write").at(-1);
    const write = seq.find((c) => CAT_OF(c.name) === "write" && c.at != null);
    const tail = lastCall && write && write.at - lastCall.at > total * 0.25
      ? `<span class="tail" style="left:${pct(lastCall.at)}%;width:${pct(write.at - lastCall.at)}%" title="組み立て（呼び出しなし）${Math.round(write.at - lastCall.at)}s"></span>` : "";
    const ticks = [0, 30, 60, 120, 180, 240].filter((s) => s < total).map((s) => `<b style="left:${pct(s)}%">${s}s</b>`).join("");
    timeline = `<div class="strip-box"><div class="strip">${tail}<span class="track"></span>${dots}${ticks}</div>
      <div class="legend">${Object.entries(CAT_LABEL).map(([k, l]) => `<span><i class="dot c-${k}"></i>${l}</span>`).join("")}</div></div>`;
  }

  const maxSize = Math.max(1, ...seq.map((c) => c.size ?? 0));
  const gapMin = total ? Math.max(12, total * 0.12) : Infinity;
  let prevAt = null;
  const seqRows = seq.map((c) => {
    const input = c.name === "get_component" ? c.input?.name
      : c.input?.category ?? (Object.keys(c.input ?? {}).length ? JSON.stringify(c.input).slice(0, 48) : "—");
    let gapRow = "";
    if (prevAt != null && c.at != null && c.at - prevAt >= gapMin) {
      gapRow = `<tr class="gap"><td class="t mono">+${Math.round(c.at - prevAt)}s</td><td colspan="3"><span class="lead">⋯⋯</span>　思考・組み立て（呼び出しなし）</td></tr>`;
    }
    if (c.at != null) prevAt = c.at;
    const size = c.size ?? 0;
    const cat = CAT_OF(c.name);
    const isLocalFs = ["Bash", "Read", "Grep", "Glob"].includes(c.name);
    return `${gapRow}<tr${isLocalFs ? ' class="fs"' : ""}>
      <td class="t mono">${c.at != null ? `${c.at}s` : "?"}</td>
      <td class="tool mono"><i class="dot c-${cat}"></i>${esc(c.name)}</td>
      <td class="in">${esc(input)}</td>
      <td><div class="bar-row"><div class="bar" style="width:${Math.max(2, (size / maxSize) * 130)}px;background:var(--c-${cat})"></div><span class="bar-num mono">${size ? size.toLocaleString() : "?"} 字</span></div></td></tr>`;
  }).join("");

  const matchCards = match
    ? `<div class="match">${match.map((x) => `<div class="mcard ${x.used ? "ok" : "ng"}"><span class="name mono">${esc(x.name)}</span><span class="used">${x.used ? `✓ ${esc(x.sample)}` : "✗ 未使用"}</span></div>`).join("")}</div>` : "";

  return `
  <details class="trial" ${status !== "pass" || signals.length ? "open" : ""}>
    <summary><span class="sym s-${status.replace(":", "-")}">${STATUS_SYMBOL[status]}</span> 実行
      <span class="meta">${m.numTurns ?? "?"} turns / ${dur != null ? dur + "s" : "?"}</span></summary>
    ${failParts.length ? `<h4>不合格の内訳</h4><ul class="fails">${failParts.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
    <h4>計測サマリー</h4>${tiles}
    ${prevResult ? cmpBlock(caseMetrics(r), caseMetrics(prevResult), prevLabel) : ""}
    ${timeline ? `<h4>タイムライン</h4>${timeline}` : ""}
    ${seqRows ? `<h4>呼び出しシーケンス</h4><p class="muted">薄く敷いた行はローカルファイル参照（Bash / Read / Grep / Glob）＝ MCPの知識でなく実物を覗きにいった手つき。</p><div class="log"><table><thead><tr><th class="t">経過</th><th>ツール</th><th>入力</th><th>応答サイズ</th></tr></thead><tbody>${seqRows}</tbody></table></div>` : "<p class='muted'>行動ログなし（--skip-generate の再採点、または導入前の実行）</p>"}
    ${matchCards ? `<h4>引いた仕様は使われたか</h4>${matchCards}` : ""}
    ${htmlPath && fs.existsSync(htmlPath) && !noScreens ? `<h4>生成された画面</h4>
    <div class="frame-box"><iframe src="${esc(r.output)}" loading="lazy" title="生成物"></iframe></div>
    <p class="muted"><a href="${esc(r.output)}" target="_blank">別タブで開く</a> — 採点対象そのもの（アーカイブ）。スタイルはレポート生成時にコピーした ds.css</p>` : ""}
    ${signals.length ? `<h4>この記録から見えたシグナル（自動検出）</h4><ul class="signals">${signals.map((s) => `<li>${s}</li>`).join("")}</ul><p class="muted">※ 機械的な候補の検出まで。改善と呼ぶかは人の所見で判断する</p>` : ""}
  </details>`;
}

/* ------------------------------------------------------------- html組み立て */

const t = tally({ results: targetResults });
const headline = `${t.pass}/${t.total}${t.err ? `（!${t.err}）` : ""} PASS`;

/* 履歴マトリクス */
const shownRuns = showAll ? runs : runs.slice(-20);
const colIds = [];
for (const c of CASES) colIds.push(c.id);
for (const run of shownRuns) for (const r of run.results ?? []) {
  if (!colIds.includes(r.id)) colIds.push(r.id);
}

const headRow = `<tr><th class="sticky">実行</th>${colIds.map((i) => `<th class="rot"><span>${esc(i)}</span></th>`).join("")}<th>計</th></tr>`;
const matrixRows = shownRuns.slice().reverse().map((run) => {
  const byId = new Map((run.results ?? []).map((r) => [r.id, r]));
  const cells = colIds.map((i) => {
    const r = byId.get(i);
    if (!r) return `<td class="none">·</td>`;
    const s = classifyResult(r);
    return `<td class="s-${s.replace(":", "-")}">${STATUS_SYMBOL[s]}</td>`;
  }).join("");
  const rt = tally(run);
  const isTarget = run.stamp === target.stamp;
  return `<tr class="${isTarget ? "target" : ""}"><td class="sticky t">${jst(run.ranAt ?? run.stamp)}${run.skipJudge ? " *" : ""}${isTarget ? " ◀" : ""}</td>${cells}<td class="t">${rt.pass}/${rt.total}${rt.err ? `（!${rt.err}）` : ""}</td></tr>`;
}).join("");

/* お題別カード */
const prevById = new Map((prev?.results ?? []).map((r) => [r.id, r]));
const prevLabel = jst(prev?.ranAt ?? prev?.stamp ?? "");
const cards = targetResults.map((r, idx) => {
  const prevResult = prevById.get(r.id) ?? null;
  const def = caseById.get(r.id);
  const specBox = def ? `
    <h4>お題（意図レベルの日本語指示。コンポーネント名は与えない）</h4>
    <div class="case-box">
      <blockquote>${esc(def.prompt)}</blockquote>
      <div class="criteria">
        ${def.mustClasses?.length ? `<div class="row"><span class="k">必須クラス</span><span>${def.mustClasses.map((c) => `<code>${esc(c)}</code>`).join("")}<span class="muted">機械チェック</span></span></div>` : ""}
        ${def.mustPatterns?.length ? `<div class="row"><span class="k">必須パターン</span><span>${def.mustPatterns.map((p) => `<code>${esc(p.pattern)}</code> ${esc(p.label)}`).join("<br>")}<span class="muted"> — 機械チェック</span></span></div>` : ""}
        ${def.rubric?.length ? `<div class="row"><span class="k">審査観点</span><span><ul>${def.rubric.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><span class="muted">LLM審査員の採点項目（rubric）。加えて全お題共通のa11yチェックが走る</span></span></div>` : ""}
      </div>
    </div>` : "";
  return `
  <section class="case" id="panel-${esc(r.id)}" role="tabpanel" aria-labelledby="tab-${esc(r.id)}"${idx ? " hidden" : ""}>
    <h3><span class="mono">${esc(r.id)}</span>
      <span class="sym s-${classifyResult(r).replace(":", "-")}">${STATUS_SYMBOL[classifyResult(r)]}</span></h3>
    ${specBox}
    ${caseDetailHtml(r, prevResult, prevLabel)}
  </section>`;
}).join("");

/* お題タブ */
const tabbar = `<div class="tabs" role="tablist" aria-label="お題別の詳細">${targetResults.map((r, idx) => {
  const st = classifyResult(r);
  return `<button type="button" role="tab" id="tab-${esc(r.id)}" class="tab${idx ? "" : " active"}" aria-selected="${idx ? "false" : "true"}" aria-controls="panel-${esc(r.id)}" tabindex="${idx ? "-1" : "0"}"><span class="sym s-${st.replace(":", "-")}">${STATUS_SYMBOL[st]}</span> <span class="mono">${esc(r.id)}</span></button>`;
}).join("")}</div>`;

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>evals レポート ${esc(jst(target.ranAt ?? target.stamp))}</title>
<style>
:root{color-scheme:light;
--paper:#fafcfb;--panel:#fff;--ink:#1d2723;--mid:#3c4a44;--muted:#5f6b65;--hair:#e3eae6;--hair-strong:#cbd6d0;
--ok:#1b805e;--ok-bg:#eef9f4;--fail:#b91c1c;--fail-bg:#fef2f2;--err:#64748b;
--c-found:#2563eb;--c-comp:#1b805e;--c-harness:#6b7280;--c-write:#1d2723}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--mid);font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;font-size:14px;line-height:1.75;font-feature-settings:"palt"}
.mono{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.wrap{max-width:980px;margin:0 auto;padding:48px 24px 72px}
.eyebrow{font-size:11px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase}
h1{font-size:26px;font-weight:600;letter-spacing:.01em;color:var(--ink);margin:6px 0 4px;text-wrap:balance}
.sub{color:var(--muted);margin:0 0 20px}
h2{font-size:15px;font-weight:600;color:var(--ink);margin:44px 0 4px}
.h2-note{font-size:12.5px;color:var(--muted);margin:0 0 16px}
h4{font-size:11px;letter-spacing:.08em;color:var(--muted);font-weight:600;margin:20px 0 6px;text-transform:uppercase}
.muted{color:var(--muted);font-size:12px}.meta{color:var(--muted);font-size:11.5px;font-weight:400;margin-left:8px}
.sym{font-weight:700}.s-pass{color:var(--ok)}.s-fail{color:var(--fail)}.s-error-generation,.s-error-judge{color:var(--err)}
.headline{font-size:15px;padding:14px 18px;border:1px solid var(--hair);border-radius:10px;background:var(--panel);color:var(--ink)}
.cond{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.7}
/* 履歴マトリクス */
.matrix-wrap{overflow-x:auto;border:1px solid var(--hair);border-radius:10px;background:var(--panel)}
table{border-collapse:collapse;font-size:12.5px}
.matrix td,.matrix th{border-bottom:1px solid var(--hair);padding:5px 9px;text-align:center}
.matrix td.sticky,.matrix th.sticky{position:sticky;left:0;background:var(--panel);text-align:left;white-space:nowrap;z-index:1}
.matrix td.t{color:var(--muted);font-size:11.5px}
.rot span{writing-mode:vertical-rl;font-size:11px;color:var(--muted);font-weight:400}
.matrix tr.target td{background:var(--ok-bg)}
.none{color:var(--hair-strong)}
/* 比較テーブル */
.cmp td{text-align:left;padding:7px 12px;font-size:12.5px}
.cmp .d-good{color:var(--ok);font-weight:600}
.cmp .d-bad{color:var(--fail);font-weight:600}
.cmp .ck{color:var(--muted);width:140px;font-size:12px}
/* お題タブ */
.tabs{display:flex;flex-wrap:wrap;gap:2px;margin:4px 0 16px;border-bottom:1px solid var(--hair)}
.tab{font-family:inherit;font-size:12.5px;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;padding:8px 12px;margin-bottom:-1px;color:var(--muted);display:inline-flex;align-items:center;gap:6px}
.tab .mono{font-size:12px}
.tab .sym{font-weight:700}
.tab:hover{color:var(--ink)}
.tab.active{color:var(--ink);border-bottom-color:var(--c-comp);font-weight:600}
.tab:focus-visible{outline:2px solid var(--c-found);outline-offset:2px;border-radius:4px}
/* お題カード */
.case{border:1px solid var(--hair);border-radius:10px;padding:16px 18px;margin:14px 0;background:var(--panel)}
.case[hidden]{display:none}
.case h3{font-size:14px;color:var(--ink);margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:600}
.trial{margin:12px 0 2px;border-top:1px solid var(--hair);padding-top:10px}
.trial summary{cursor:pointer;font-size:13px;color:var(--ink)}
.fails{margin:6px 0;padding-left:20px;color:var(--fail);font-size:12.5px;line-height:1.7}
.signals{margin:6px 0;padding-left:20px;font-size:12.5px;color:var(--ink);line-height:1.7}
.signals li{margin:3px 0}
/* 計測タイル */
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.tile{background:var(--panel);border:1px solid var(--hair);border-radius:8px;padding:14px 16px 12px}
.tile .k{font-size:11.5px;color:var(--muted)}
.tile .v{font-size:24px;font-weight:600;line-height:1.3;color:var(--ink)}
.tile .v small{font-size:12px;font-weight:400;color:var(--muted);margin-left:2px}
.tile .v.sym{font-size:15px}
/* タイムライン */
.strip-box{background:var(--panel);border:1px solid var(--hair);border-radius:8px;padding:18px 20px 10px}
.strip{position:relative;height:52px}
.strip .track{position:absolute;left:0;right:0;top:22px;height:2px;background:var(--hair-strong)}
.strip .tail{position:absolute;top:16px;height:14px;border:1px dashed var(--hair-strong);border-radius:4px;background:color-mix(in srgb,var(--c-write) 8%,transparent)}
.strip .dot,.legend .dot{display:inline-block;width:9px;height:9px;border-radius:50%}
.strip .dot{position:absolute;top:18px;transform:translateX(-50%);border:2px solid var(--panel)}
.strip b{position:absolute;top:36px;transform:translateX(-50%);font-size:10.5px;color:var(--muted);font-weight:400}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:12px;color:var(--muted)}
.legend span{display:inline-flex;align-items:center;gap:6px}
.c-found{background:var(--c-found)}.c-comp{background:var(--c-comp)}.c-harness{background:var(--c-harness)}.c-write{background:var(--c-write)}
/* シーケンス */
.log{border:1px solid var(--hair);border-radius:8px;background:var(--panel);overflow-x:auto}
.log table{width:100%;min-width:560px}
.log th{text-align:left;font-size:11px;letter-spacing:.08em;color:var(--muted);font-weight:600;padding:10px 12px 8px;border-bottom:1px solid var(--hair)}
.log td{padding:7px 12px;border-bottom:1px solid var(--hair);font-size:13px;vertical-align:middle}
.log tr:last-child td{border-bottom:none}
.log .t{text-align:right;color:var(--muted);font-size:12px;white-space:nowrap;width:64px}
.log .tool{white-space:nowrap;font-size:12.5px}.log .tool .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}
.log .in{color:var(--muted);font-size:12px;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-row{display:flex;align-items:center;gap:8px}
.bar{height:8px;border-radius:0 4px 4px 0;min-width:2px}
.bar-num{font-size:11px;color:var(--muted);white-space:nowrap}
.gap td{padding:4px 12px;font-size:11.5px;color:var(--muted);background:color-mix(in srgb,var(--hair) 35%,transparent);border-top:1px dashed var(--hair-strong);border-bottom:1px dashed var(--hair-strong)}
.gap .lead{letter-spacing:.2em}
.log tr.fs td{background:color-mix(in srgb,var(--c-found) 9%,transparent)}
/* 突合 */
.match{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.mcard{border:1px solid var(--hair);border-radius:8px;background:var(--panel);padding:9px 12px 8px;min-width:0}
.mcard .name{font-size:12.5px;display:block}
.mcard .used{font-size:11px;font-weight:600;display:block;line-height:1.5}
.mcard.ok .used{color:var(--ok)}.mcard.ng{border-color:var(--fail)}.mcard.ng .used{color:var(--fail)}
/* お題・達成基準 */
.case-box{background:color-mix(in srgb,var(--hair) 30%,var(--panel));border:1px solid var(--hair);border-radius:8px;padding:16px 18px}
.case-box blockquote{margin:0 0 14px;padding:2px 0 2px 14px;border-left:3px solid var(--c-comp);font-size:14px;line-height:1.85;color:var(--ink);max-width:44em}
.criteria{display:grid;gap:6px;font-size:12.5px;color:var(--muted)}
.criteria .row{display:flex;gap:10px}
.criteria .k{flex:none;width:88px;font-size:11px;letter-spacing:.06em;padding-top:2px}
.criteria code{font-family:"SF Mono",ui-monospace,monospace;font-size:11.5px;background:var(--panel);border:1px solid var(--hair-strong);border-radius:4px;padding:0 5px;margin-right:4px}
.criteria ul{margin:0;padding-left:18px}.criteria li{margin:2px 0}
/* 生成画面 */
.frame-box{border:1px solid var(--hair-strong);border-radius:8px;overflow:hidden;background:#fff}
.frame-box iframe{display:block;width:100%;height:560px;border:none;background:#fff}
footer{margin-top:48px;border-top:1px solid var(--hair);padding-top:14px;font-size:11.5px;color:var(--muted);line-height:1.7}
footer code,.cond code{font-family:"SF Mono",ui-monospace,monospace;font-size:11px}
</style></head><body><div class="wrap">
<div class="eyebrow">Design System · agent eval レポート</div>
<h1>evals レポート</h1>
<p class="sub">自動生成（LLM不使用）: <span class="mono">npm run eval:report:html${stampArg ? ` -- --stamp ${esc(stampArg)}` : ""}${caseArg ? ` --case ${esc(caseArg)}` : ""}</span>　正本: evals/results/</p>
<div class="headline"><b>${headline}</b>
<div class="cond">${esc(jst(target.ranAt ?? target.stamp))} 実行${target.stamp === runs.at(-1).stamp ? "（最新）" : "（過去の実行を表示中）"} ・ model: ${esc(target.model ?? "?")} ・ judge: ${esc(target.judgeModel ?? "なし(--skip-judge)")} ・ votes ${target.votes ?? 1} ・ v${esc(target.dsVersion ?? "?")}</div></div>

<h2>履歴推移</h2>
<p class="h2-note">新しい順・${shownRuns.length}/${runs.length} 件${showAll ? "" : "（全件は --all）"}。</p>
<div class="matrix-wrap"><table class="matrix"><thead>${headRow}</thead><tbody>${matrixRows}</tbody></table></div>
<p class="muted">✓ PASS / ✗ FAIL（品質） / G 生成失敗 / J 審査不能（G/J は品質シグナルでない） / · その実行の対象外 / * 機械チェックのみ / ◀ このレポートの対象実行。</p>

<h2>対象実行の詳細</h2>
<p class="h2-note">お題別${caseArg ? ` — ${esc(caseArg)} で絞り込み` : ""}。タブで1件ずつ表示（← → で移動）。FAIL・シグナル検出は自動で展開。</p>
${tabbar}
${cards}

<footer>Design System evals ・ 読み方: evals/README.md ・
切り分けは「知識 / 基準 / お題」の3方向（分水嶺: 正しい知識を持つ理想のエージェントなら安定して合格できるか）</footer>
</div>
<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.tabs [role=tab]'));
  if(!tabs.length)return;
  function select(tab,focus){
    tabs.forEach(function(t){
      var on=t===tab;
      t.setAttribute('aria-selected',on?'true':'false');
      t.tabIndex=on?0:-1;
      t.classList.toggle('active',on);
      var p=document.getElementById(t.getAttribute('aria-controls'));
      if(p)p.hidden=!on;
    });
    if(focus)tab.focus();
    try{history.replaceState(null,'','#case-'+tab.id.slice(4));}catch(e){}
  }
  tabs.forEach(function(t,i){
    t.addEventListener('click',function(){select(t,false);});
    t.addEventListener('keydown',function(e){
      var j=null,k=e.key;
      if(k==='ArrowRight'||k==='ArrowDown')j=(i+1)%tabs.length;
      else if(k==='ArrowLeft'||k==='ArrowUp')j=(i-1+tabs.length)%tabs.length;
      else if(k==='Home')j=0;else if(k==='End')j=tabs.length-1;
      if(j!==null){e.preventDefault();select(tabs[j],true);}
    });
  });
  var m=(location.hash||'').match(/^#case-(.+)$/);
  if(m){var t=document.getElementById('tab-'+m[1]);if(t)select(t,false);}
})();
</script>
</body></html>`;

const outPath = path.join(resultsDir, "report.html");
fs.writeFileSync(outPath, html);
console.log(`evals/results/report.html を生成しました（${(html.length / 1024).toFixed(0)}KB・対象 ${targetResults.length} お題・${jst(target.ranAt ?? target.stamp)} 実行）`);
