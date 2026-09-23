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

const CHECKS = [
  ["icon-count", checkIconCount],
  ["mcp-components", checkMcpComponentList],
  ["component-count", checkComponentCount],
  ["component-header", checkComponentHeaders],
  ["index-css", checkIndexCss],
  ["color-tokens", checkColorTokensDefined],
  ["semantic-colors", checkComponentsUseSemanticColors],
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
