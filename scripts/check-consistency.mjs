/*
 * check-consistency.mjs — 正本と派生ドキュメントの整合性チェック
 *
 *   コードが正本、ドキュメントは派生。人力更新に頼っていた数の表記や登録漏れを
 *   機械照合し、ズレた瞬間にCI（check-consistency.yml）でPR/pushを落とす。
 *   relay-design-systemの同名スクリプトを、このDSの規模・構成
 *   （build-pages.mjs無し・tokensがルート直下・selector登録漏れの実例）に
 *   合わせて調整したもの。
 *
 * チェック内容:
 *   1. アイコン数       — 正本: scripts/build-icons.mjs のICONS配列
 *                          照合先: README / DESIGN.md / preview/index.html
 *   2. MCPコンポーネント一覧 — 正本: src/components/*.css の実ファイル一覧
 *                          照合先: src/mcp/handlers.mjs のCOMPONENT_NAMES（過不足なく一致すること。
 *                          get_component("selector")が登録漏れでスキーマから弾かれていた実例の再発防止）
 *   3. コンポーネント数   — 正本: COMPONENT_NAMES からicon（Foundations扱い）を除いた数
 *                          照合先: READMEの見出しと表の行数
 *   4. ヘッダ規約         — src/components/*.css 先頭コメントに 機能:/使用法:/アクセシビリティ: が
 *                          あること（MCP get_component の正本のため必須）
 *   5. index.css          — tokens/ と src/components/ の全ファイルがimportされ、
 *                          tokens → components の順序が守られていること
 *   6. 色トークンの定義   — src/components/・tokens/・preview/ が参照する var(--color-*) が
 *                          tokens/colors.css に定義されていること（未定義の negative-200 を
 *                          5箇所で参照していた実例の再発防止）
 *   7. semantic のみ      — src/components/*.css が参照する色は semantic 層（bg-* / fg-* / stroke-* /
 *                          scrim）だけであること。key（primary-600 等）や primitive（slate-400 等）を
 *                          直接使うとダークモード・ブランド差し替えに追従しないため
 *   8. ダーク定義の一致   — tokens/colors.css の [data-color-mode="dark"] と
 *                          @media (prefers-color-scheme: dark) 内の [data-color-mode="auto"] が同じ内容であること
 *   9. コントラスト       — 「文字 × 背景」「UI部品 × 背景」のペアをライト・ダーク両方で計算し、
 *                          文字 4.5:1 / UI部品・フォーカスリング 3:1 を下回ったらエラー（disabled は対象外）
 *
 * 実行: npm run check:consistency（依存パッケージ不要・ネットワーク不要）
 *
 * 表記のパターンが見つからない場合もエラーにする（文言を変えたら本スクリプトの
 * 照合先も更新すること。見つからないまま素通りさせると検査が形骸化するため）。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const read = (rel) => fs.readFileSync(path.join(projectRoot, rel), "utf8");

/** @type {{check: string, message: string}[]} */
const violations = [];
const fail = (check, message) => violations.push({ check, message });

// ---------------------------------------------------------------------------
// 1. アイコン数 — ICONS配列（正本）と各ドキュメントの数表記を照合
// ---------------------------------------------------------------------------

function countIcons() {
  const src = read("scripts/build-icons.mjs");
  const m = src.match(/export const ICONS = \[([\s\S]*?)\];/);
  if (!m) throw new Error("scripts/build-icons.mjs からICONS配列を見つけられません");
  const body = m[1].replace(/\/\/[^\n]*/g, "");
  return (body.match(/"[a-z0-9-]+"/g) ?? []).length;
}

const ICON_CLAIMS = [
  { file: "README.md", pattern: /Lucide SVG sprite（`dist\/icons\.svg`、(\d+)種）/ },
  { file: "DESIGN.md", pattern: /Lucide SVG sprite, (\d+) icons/ },
  { file: "preview/index.html", pattern: /Lucide SVG sprite（icons\.svg）・(\d+)種/ },
];

function checkIconCount() {
  const actual = countIcons();
  for (const { file, pattern } of ICON_CLAIMS) {
    const m = read(file).match(pattern);
    if (!m) {
      fail("icon-count", `${file}: アイコン数の表記が見つかりません（期待パターン: ${pattern}）。文言を変えた場合はscripts/check-consistency.mjsのICON_CLAIMSを更新してください`);
      continue;
    }
    if (Number(m[1]) !== actual) {
      fail("icon-count", `${file}: アイコン数の表記が ${m[1]} ですが、正本（scripts/build-icons.mjsのICONS）は ${actual} です`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. MCPコンポーネント一覧 — src/components/*.css（正本）とCOMPONENT_NAMESの過不足を照合
//    2026-09: selector.cssを追加した際にCOMPONENT_NAMESへの登録を忘れ、
//    get_component("selector")がスキーマ検証で弾かれる実害が出た。再発防止のチェック。
// ---------------------------------------------------------------------------

function checkMcpComponentList() {
  const onDisk = fs
    .readdirSync(path.join(projectRoot, "src/components"))
    .filter((f) => f.endsWith(".css"))
    .map((f) => f.replace(/\.css$/, ""))
    .sort();

  const handlers = read("src/mcp/handlers.mjs");
  const m = handlers.match(/const COMPONENT_NAMES = \[([\s\S]*?)\];/);
  if (!m) {
    fail("mcp-components", "src/mcp/handlers.mjs からCOMPONENT_NAMES配列を見つけられません");
    return;
  }
  const registered = (m[1].match(/"[a-z0-9-]+"/g) ?? []).map((s) => s.slice(1, -1)).sort();

  for (const name of onDisk) {
    if (!registered.includes(name)) {
      fail("mcp-components", `src/mcp/handlers.mjs: src/components/${name}.cssがCOMPONENT_NAMESに登録されておらず、get_component("${name}")がスキーマ検証で弾かれます`);
    }
  }
  for (const name of registered) {
    if (!onDisk.includes(name)) {
      fail("mcp-components", `src/mcp/handlers.mjs: 存在しないsrc/components/${name}.cssがCOMPONENT_NAMESに登録されています`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. コンポーネント数 — COMPONENT_NAMESからicon（Foundations扱い）を除いた数（正本）と
//    READMEの見出し・表の行数を照合
// ---------------------------------------------------------------------------

function catalogComponentCount() {
  const handlers = read("src/mcp/handlers.mjs");
  const m = handlers.match(/const COMPONENT_NAMES = \[([\s\S]*?)\];/);
  if (!m) throw new Error("src/mcp/handlers.mjs からCOMPONENT_NAMES配列を見つけられません");
  const names = (m[1].match(/"[a-z0-9-]+"/g) ?? []).map((s) => s.slice(1, -1));
  return names.filter((n) => n !== "icon").length; // iconはFoundations扱いでカタログ非掲載
}

function checkComponentCount() {
  const catalogCount = catalogComponentCount();
  const readme = read("README.md");

  const heading = readme.match(/## コンポーネント一覧（(\d+)個）/);
  if (!heading) {
    fail("component-count", "README.md: 「## コンポーネント一覧（N個）」の見出しが見つかりません");
  } else if (Number(heading[1]) !== catalogCount) {
    fail("component-count", `README.md: 見出しは「${heading[1]}個」ですが、正本（COMPONENT_NAMESからicon除く）は ${catalogCount} です`);
  }

  const section = readme.split(/## コンポーネント一覧/)[1]?.split(/\n## /)[0] ?? "";
  const rows = (section.match(/^\| \d+ \|/gm) ?? []).length;
  if (rows !== catalogCount) {
    fail("component-count", `README.md: コンポーネント一覧の表が ${rows} 行ですが、正本は ${catalogCount} です。表への追記漏れを確認してください`);
  }
}

// ---------------------------------------------------------------------------
// 4. ヘッダ規約 — 先頭コメントに 機能:/使用法:/アクセシビリティ:（MCP get_component の正本）
// ---------------------------------------------------------------------------

function checkComponentHeaders() {
  const dir = path.join(projectRoot, "src/components");
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".css")).sort()) {
    const src = fs.readFileSync(path.join(dir, name), "utf8");
    const rel = `src/components/${name}`;
    if (!src.startsWith("/*")) {
      fail("component-header", `${rel}: 先頭がヘッダコメントで始まっていません`);
      continue;
    }
    const header = src.slice(0, src.indexOf("*/"));
    for (const sectionName of ["機能:", "使用法:", "アクセシビリティ:"]) {
      if (!header.includes(sectionName)) {
        fail("component-header", `${rel}: ヘッダコメントに「${sectionName}」セクションがありません（MCP get_component の正本のため必須）`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. index.css — importの完全性とtokens → componentsの順序
//    my-design-systemはtokens/がルート直下（relayはsrc/tokens/）なので相対パスが異なる。
// ---------------------------------------------------------------------------

function checkIndexCss() {
  const lines = read("src/index.css").split("\n");
  const imports = []; // { kind, name, line }
  lines.forEach((text, i) => {
    const tokenMatch = text.match(/^@import "\.\.\/tokens\/([a-z0-9-]+)\.css";/);
    const componentMatch = text.match(/^@import "\.\/components\/([a-z0-9-]+)\.css";/);
    if (tokenMatch) imports.push({ kind: "tokens", name: tokenMatch[1], line: i + 1 });
    if (componentMatch) imports.push({ kind: "components", name: componentMatch[1], line: i + 1 });
  });

  const dirs = { tokens: "tokens", components: "src/components" };
  for (const kind of ["tokens", "components"]) {
    const onDisk = fs
      .readdirSync(path.join(projectRoot, dirs[kind]))
      .filter((f) => f.endsWith(".css"))
      .map((f) => f.replace(/\.css$/, ""));
    const imported = new Set(imports.filter((im) => im.kind === kind).map((im) => im.name));
    for (const name of onDisk) {
      if (!imported.has(name)) {
        fail("index-css", `src/index.css: ${dirs[kind]}/${name}.css が @import されていません（配布CSSに含まれず、利用者側でクラスが効きません）`);
      }
    }
    for (const name of imported) {
      if (!onDisk.includes(name)) {
        fail("index-css", `src/index.css: 存在しない ${dirs[kind]}/${name}.css を @import しています`);
      }
    }
  }

  const lastToken = imports.filter((im) => im.kind === "tokens").at(-1);
  const firstComponent = imports.find((im) => im.kind === "components");
  if (lastToken && firstComponent && lastToken.line > firstComponent.line) {
    fail("index-css", `src/index.css: @import の順序が崩れています（${lastToken.line}行目のtokensが${firstComponent.line}行目のcomponentsより後）。tokens → componentsの順序を守ってください`);
  }
}

// ---------------------------------------------------------------------------
// 6. 色トークンの定義 — 参照している var(--color-*) が tokens/colors.css に存在すること
//    未定義の変数は CSS 上エラーにならず、黙って色が抜けるため機械で検出する。
// ---------------------------------------------------------------------------

function checkColorTokensDefined() {
  const defined = new Set(read("tokens/colors.css").match(/--color-[a-z0-9-]+(?=\s*:)/g) ?? []);
  const targets = [
    ...["tokens", "src/components", "preview", "preview/components"].flatMap((dir) =>
      fs
        .readdirSync(path.join(projectRoot, dir))
        .filter((f) => /\.(css|html)$/.test(f))
        .map((f) => `${dir}/${f}`),
    ),
  ];
  for (const rel of targets) {
    for (const [, name] of read(rel).matchAll(/var\((--color-[a-z0-9-]+)/g)) {
      if (!defined.has(name)) {
        fail("color-tokens", `${rel}: 未定義の ${name} を参照しています（tokens/colors.css に定義がなく、色が適用されません）`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 7. semantic のみ — コンポーネントは semantic 層の色だけを参照する（コメント内の記述は対象外）
// ---------------------------------------------------------------------------

function checkComponentsUseSemanticColors() {
  const dir = path.join(projectRoot, "src/components");
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".css")).sort()) {
    const code = fs.readFileSync(path.join(dir, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, token] of code.matchAll(/var\(--color-([a-z0-9-]+)/g)) {
      if (!/^(bg|fg|stroke)-|^scrim$/.test(token)) {
        fail("semantic-colors", `src/components/${name}: --color-${token} は semantic 層ではありません。bg-* / fg-* / stroke-* を使ってください（tokens/colors.css ③）`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 8〜9. ダーク定義 — tokens/colors.css を読み、ライト/ダークそれぞれの値を解決する
// ---------------------------------------------------------------------------

const colorsCss = () => read("tokens/colors.css").replace(/\/\*[\s\S]*?\*\//g, "");

/** `marker` の直後の { … } の中身を返す（入れ子対応） */
function blockBody(css, marker) {
  const start = css.indexOf(marker);
  if (start < 0) return null;
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return null;
}

const declarations = (body) =>
  Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

function checkDarkBlocksMatch() {
  const css = colorsCss();
  const dark = blockBody(css, '[data-color-mode="dark"]');
  const auto = blockBody(css, '[data-color-mode="auto"]');
  if (!dark || !auto) {
    fail("dark-blocks", 'tokens/colors.css: [data-color-mode="dark"] または [data-color-mode="auto"] のブロックが見つかりません');
    return;
  }
  const normalize = (b) => b.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  if (normalize(dark) !== normalize(auto)) {
    fail("dark-blocks", 'tokens/colors.css: [data-color-mode="dark"] と auto（prefers-color-scheme: dark）の中身が一致していません。片方だけ変更していないか確認してください');
  }
}

// 文字は 4.5:1、UI部品（枠線・トラック・フォーカスリング・塗り）は 3:1（WCAG 1.4.3 / 1.4.11）
const TEXT = 4.5;
const UI = 3;
const CONTRAST_PAIRS = [
  ...["bg-page", "bg-raised", "bg-sunken", "bg-overlay", "bg-neutral-low"].flatMap((bg) =>
    ["fg-high", "fg-middle", "fg-low", "fg-primary", "fg-negative"].map((fg) => [fg, bg, TEXT]),
  ),
  ["fg-high", "bg-disabled", TEXT], ["fg-low", "bg-disabled", TEXT],
  ["fg-middle", "bg-neutral-middle", TEXT], ["fg-middle", "bg-neutral-high", UI],
  ["fg-primary-hover", "bg-raised", TEXT],
  ["fg-primary", "bg-primary-subtle", TEXT], ["fg-primary", "bg-primary-muted", TEXT],
  ["fg-on-primary", "bg-primary", TEXT], ["fg-on-primary", "bg-primary-hover", TEXT],
  ["fg-on-negative", "bg-negative", TEXT], ["fg-on-negative", "bg-negative-hover", TEXT],
  ["fg-on-success", "bg-success", TEXT], ["fg-on-info", "bg-info", TEXT], ["fg-on-warning", "bg-warning", TEXT],
  ["fg-inverse", "bg-inverse", TEXT], ["fg-inverse", "bg-inverse-hover", TEXT], ["fg-inverse-middle", "bg-inverse", TEXT],
  ["fg-negative", "bg-negative-subtle", TEXT],
  ["fg-negative-strong", "bg-negative-subtle", TEXT], ["fg-negative-strong", "bg-negative-muted", TEXT],
  ...["success", "warning", "info"].flatMap((r) => [[`fg-${r}`, `bg-${r}-subtle`, TEXT], [`fg-${r}`, `bg-${r}-muted`, TEXT]]),
  ["stroke-control", "bg-raised", UI], ["stroke-control-error", "bg-raised", UI], ["stroke-control-error", "bg-negative-subtle", UI],
  ["stroke-primary", "bg-raised", UI], ["stroke-focus", "bg-page", UI], ["stroke-focus", "bg-raised", UI],
  ["bg-primary", "bg-page", UI], ["bg-primary", "bg-raised", UI], ["bg-control-off", "bg-raised", UI],
];

// 既知の未達（ライト）。ダーク対応以前からの値で、変えると見た目が変わるためユーザー判断待ち。
// 直したらここから消す（消し忘れは「未達でなくなった」エラーで検出する）
const KNOWN_CONTRAST_GAPS = new Set([
  "light:fg-negative/bg-negative-subtle", // negative の outline ボタン文字 4.41:1
  "light:stroke-control/bg-raised",       // 入力欄の枠 2.56:1
  "light:bg-control-off/bg-raised",       // switch の OFF トラック 2.56:1
]);

function luminance(hex) {
  const m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function checkContrast() {
  const css = colorsCss();
  const light = declarations(blockBody(css, "@theme static") ?? "");
  const themes = { light, dark: { ...light, ...declarations(blockBody(css, '[data-color-mode="dark"]') ?? "") } };
  for (const [theme, vars] of Object.entries(themes)) {
    const resolve = (name, depth = 0) => {
      const v = vars[name];
      const ref = v?.match(/^var\((--[\w-]+)\)$/);
      return ref && depth < 20 ? resolve(ref[1], depth + 1) : v;
    };
    for (const [fg, bg, min] of CONTRAST_PAIRS) {
      const [a, b] = [resolve(`--color-${fg}`), resolve(`--color-${bg}`)].map((v) => (v ? luminance(v) : null));
      if (a == null || b == null) {
        fail("contrast", `tokens/colors.css (${theme}): ${fg} / ${bg} を hex に解決できません`);
        continue;
      }
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const key = `${theme}:${fg}/${bg}`;
      if (ratio < min && !KNOWN_CONTRAST_GAPS.has(key)) {
        fail("contrast", `tokens/colors.css (${theme}): ${fg} on ${bg} が ${ratio.toFixed(2)}:1 で基準 ${min}:1 未満です`);
      }
      if (ratio >= min && KNOWN_CONTRAST_GAPS.has(key)) {
        fail("contrast", `scripts/check-consistency.mjs: ${key} は基準を満たすようになりました。KNOWN_CONTRAST_GAPS から消してください`);
      }
    }
  }
}

// ---------------------------------------------------------------------------

const CHECKS = [
  ["icon-count", checkIconCount],
  ["mcp-components", checkMcpComponentList],
  ["component-count", checkComponentCount],
  ["component-header", checkComponentHeaders],
  ["index-css", checkIndexCss],
  ["color-tokens", checkColorTokensDefined],
  ["semantic-colors", checkComponentsUseSemanticColors],
  ["dark-blocks", checkDarkBlocksMatch],
  ["contrast", checkContrast],
];

for (const [name, run] of CHECKS) {
  const before = violations.length;
  run();
  const count = violations.length - before;
  console.log(count === 0 ? `✓ ${name}` : `✗ ${name} (${count}件)`);
}

if (violations.length > 0) {
  console.error(`\n${violations.length}件の不整合が見つかりました:\n`);
  for (const v of violations) console.error(`  [${v.check}] ${v.message}`);
  console.error("\n正本（コード側）が正しい場合はドキュメントの表記を、意図的に表記を変えた場合はscripts/check-consistency.mjsを更新してください。");
  process.exit(1);
}

console.log("\nすべての整合性チェックを通過しました。");
