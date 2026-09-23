/**
 * カタログの Typography ページを tokens/typography.css から生成する。
 *
 *   input:  tokens/typography.css（正本）
 *   output: preview/foundations/typography.html（生成物。gitignore 済み）
 *
 *   見本は実際のトークン（font: var(--typo-*)）で描くので、値を変えれば見本も変わる。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, blockBody, declarations, foundationPage } from "./catalog-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outFile = path.join(projectRoot, "preview/foundations/typography.html");
const FILE = "tokens/typography.css";

const css = (await readFile(path.join(projectRoot, FILE), "utf8"));
const theme = declarations(blockBody(css, "@theme static", FILE));
const semantic = declarations(blockBody(css, ":root", FILE), "--typo-");
const vars = Object.fromEntries(theme.map((d) => [d.name, d.value]));

const SAMPLE = "情報密度を上げる Design System 1,234";

/** --typo-* の値（太さ サイズ/行間 書体）を読める形に */
function spec(value) {
  const m = value.match(/^var\((--font-weight-[\w-]+)\)\s+var\((--text-[\w-]+)\)\/var\((--leading-[\w-]+)\)/);
  if (!m) return { text: value };
  const size = m[2].replace("--text-", "");
  return { size, text: `${size}px（${vars[m[2]]}） / ${vars[m[3]]} / ${vars[m[1]]}` };
}

const ROLE_ORDER = [
  ["body", "文章・入力欄・表のセル"],
  ["label", "UI 部品の文字（同じサイズの body より太い）"],
  ["caption", "補足・バッジ（12px 以下。単一行に限る）"],
  ["heading", "見出し。見た目と見出しレベル（h1〜h6）を一致させる"],
];

function semanticTables() {
  return ROLE_ORDER.map(([role, note]) => {
    const rows = semantic.filter((d) => d.name.startsWith(`--typo-${role}`)).map((d) => {
      const s = spec(d.value);
      return `<tr>
  <th scope="row"><span class="fp-mono">${d.name.slice(2)}</span><span class="fp-sub">${esc(s.text)}</span></th>
  <td><span style="font: var(${d.name}); color: var(--color-fg-high)">${SAMPLE}</span><span class="fp-sub">${esc(d.note)}</span></td>
</tr>`;
    }).join("\n");
    return `    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">${role}</p><p class="catalog-card-note">${esc(note)}</p></div>
      <div class="fp-scroll"><table class="fp-table">
<thead><tr><th scope="col" style="width:40%">トークン（サイズ / 行間 / 太さ）</th><th scope="col">見本と用途</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
    </div>`;
  }).join("\n\n");
}

function primitiveTable(prefix, render) {
  return theme.filter((d) => d.name.startsWith(prefix)).map(render).join("\n");
}

const sizes = primitiveTable("--text-", (d) =>
  `<tr><th scope="row"><span class="fp-mono">${d.name.slice(2)}</span><span class="fp-sub">${d.value}${d.note ? ` · ${esc(d.note)}` : ""}</span></th><td><span style="font-size: var(${d.name}); line-height: 1.5">あア亜 Aa 123</span></td></tr>`);
const leadings = primitiveTable("--leading-", (d) =>
  `<tr><th scope="row"><span class="fp-mono">${d.name.slice(2)}</span></th><td>${d.value}${d.note ? `<span class="fp-sub">${esc(d.note)}</span>` : ""}</td></tr>`);
const weights = primitiveTable("--font-weight-", (d) =>
  `<tr><th scope="row"><span class="fp-mono">${d.name.slice(2)}</span></th><td><span style="font: var(--typo-body); font-weight: var(${d.name})">${d.value} ― 情報密度を上げる</span></td></tr>`);
const families = primitiveTable("--font-", (d) =>
  d.name.startsWith("--font-weight-") ? "" :
  `<tr><th scope="row"><span class="fp-mono">${d.name.slice(2)}</span></th><td><span style="font-family: var(${d.name})">あア亜 Aa 0123 ¥1,000 “quote”</span><span class="fp-sub">${esc(d.value)}</span></td></tr>`);

const classes = [...css.matchAll(/\.(typo-[\w-]+)\s*\{\s*([^}]*)\}/g)].map(([, cls, body]) =>
  `<tr><th scope="row"><span class="fp-mono">.${cls}</span></th><td><span class="fp-mono">${esc(body.trim())}</span></td></tr>`).join("\n");

const table = (head, rows) => `<div class="fp-scroll"><table class="fp-table">
<thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
<tbody>
${rows}
</tbody></table></div>`;

const html = foundationPage({
  title: "Typography",
  source: "scripts/build-typography-page.mjs が tokens/typography.css",
  desc: `文字は「段（primitive）→ 役割ごとのテキストスタイル（semantic）」の2層で定義しています。コンポーネントは <code>font: var(--typo-*)</code> の1行で指定し、サイズ・行間・太さを直書きしません。本文は 14px、行間は 1.5 が基準です。`,
  body: `
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">2層の構成</p><p class="catalog-card-note">正本は <code>tokens/typography.css</code></p></div>
      <div class="fp-body">
        <ul class="typo-medium">
          <li><strong>① primitive</strong> — サイズ（rem）・行間（単位なし）・太さ・書体の段。コンポーネントからは使わない（例外: 状態で太さだけ変える <code>--font-weight-*</code>）</li>
          <li><strong>② semantic</strong> — 役割ごとのテキストスタイル ${semantic.length}個。<code>font</code> ショートハンド（太さ サイズ/行間 書体）なので、<code>font: var(--typo-body)</code> の1行で指定できる</li>
        </ul>
      </div>
    </div>

    <h2 class="catalog-section-title typo-2xlarge">② semantic</h2>
${semanticTables()}

    <h2 class="catalog-section-title typo-2xlarge">① primitive</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">サイズ</p><p class="catalog-card-note">名前は px 相当。値は rem なので、ブラウザの文字サイズ設定に追従する</p></div>
      ${table(["トークン", "見本"], sizes)}
    </div>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">行間</p><p class="catalog-card-note">単位なし。日本語の文章は 1.5 以上</p></div>
      ${table(["トークン", "値"], leadings)}
    </div>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">太さ</p><p class="catalog-card-note">3段（500 は使わない）</p></div>
      ${table(["トークン", "見本"], weights)}
    </div>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">書体</p><p class="catalog-card-note">Webフォントは読み込まず、OS のフォントを使う</p></div>
      ${table(["トークン", "見本と指定"], families)}
    </div>

    <h2 class="catalog-section-title typo-2xlarge">クラス（.typo-*）</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">HTML に直接当てるクラス</p><p class="catalog-card-note">中身は semantic を参照する。text-sm / text-base 等の直書きは禁止</p></div>
      ${table(["クラス", "中身"], classes)}
    </div>

    <h2 class="catalog-section-title typo-2xlarge">ルール</h2>
    <div class="catalog-card">
      <div class="fp-body" style="padding-top:calc(var(--spacing) * 6)">
<pre class="fp-code"><code>.my-label { font: var(--typo-label-strong); }       /* OK */
.my-label { font-size: 14px; font-weight: 700; }     /* NG（check:consistency でエラー） */
.menu-item[aria-current="page"] { font-weight: var(--font-weight-bold); }  /* OK: 状態で太さだけ変える */</code></pre>
        <ul class="typo-medium">
          <li><code>font</code> ショートハンドは <code>font-variant-numeric</code> などもリセットするので、それらは <code>font</code> より後に書く</li>
          <li>12px 以下は補足・単一行に限る。本文を 12px 以下で組まない</li>
          <li>字間・palt は使わない</li>
          <li>桁をそろえたい数字（金額・件数）は <code>.typo-numeric</code></li>
        </ul>
      </div>
    </div>
`,
});

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, html);
console.log(`✓ ${path.relative(projectRoot, outFile)}（semantic ${semantic.length}個）`);
