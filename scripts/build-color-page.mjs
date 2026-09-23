/**
 * カタログの Colors ページを tokens/colors.css から生成する。
 *
 *   input:  tokens/colors.css（正本）
 *   output: preview/foundations/colors.html（生成物。gitignore 済み）
 *
 *   手書きするとトークンを変えたときにページだけ古くなるため、ビルドのたびに作り直す。
 *   ライト/ダークの値はここで hex に解決して埋め込む（ページ自体のテーマに関係なく両方を並べるため）。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, blockBody as block, declarations as decls, foundationPage } from "./catalog-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outFile = path.join(projectRoot, "preview/foundations/colors.html");

const css = await readFile(path.join(projectRoot, "tokens/colors.css"), "utf8");

const blockBody = (marker) => block(css, marker, "tokens/colors.css");
const declarations = (body) => decls(body, "--color-");

const lightDecls = declarations(blockBody("@theme static"));
const darkDecls = declarations(blockBody('[data-color-mode="dark"]'));
const light = Object.fromEntries(lightDecls.map((d) => [d.name, d.value]));
const dark = { ...light, ...Object.fromEntries(darkDecls.map((d) => [d.name, d.value])) };

const resolve = (vars, name, depth = 0) => {
  const v = vars[name];
  const ref = v?.match(/^var\((--[\w-]+)\)$/);
  return ref && depth < 20 ? resolve(vars, ref[1], depth + 1) : v;
};
/** 参照先を1段だけ（例: var(--color-neutral-50) → neutral-50） */
const ref = (value) => value.match(/^var\(--color-([\w-]+)\)$/)?.[1] ?? value;

const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const PRIMITIVES = [
  ["brand-green", "primary 用のブランド緑（このDS固有）"],
  ["slate", "neutral（グレー）"],
  ["red", "negative"],
  ["amber", "warning"],
  ["green", "success（brand-green とは別の緑）"],
  ["blue", "info・フォーカスリング"],
];
const KEYS = ["primary", "neutral", "success", "warning", "negative", "info"];

// ---------------------------------------------------------------- sections

function primitiveGrid() {
  const head = `<tr><th scope="col">系統</th>${STEPS.map((s) => `<th scope="col">${s}</th>`).join("")}</tr>`;
  const rows = PRIMITIVES.map(([ramp, desc]) => {
    const cells = STEPS.map((s) => {
      const hex = light[`--color-${ramp}-${s}`];
      return `<td><span class="cp-dot" style="background:${hex}" title="${ramp}-${s} · ${hex}" role="img" aria-label="${ramp}-${s} ${hex}"></span></td>`;
    }).join("");
    return `<tr><th scope="row"><span class="cp-mono">${ramp}</span><span class="cp-sub">${esc(desc)}</span></th>${cells}</tr>`;
  }).join("\n");
  return `<div class="cp-scroll"><table class="cp-grid">\n<thead>${head}</thead>\n<tbody>\n${rows}\n</tbody></table></div>`;
}

function keyTable() {
  const rows = KEYS.map((k) => {
    const target = ref(light[`--color-${k}-500`]).replace(/-500$/, "");
    const dots = STEPS.map((s) => {
      const hex = resolve(light, `--color-${k}-${s}`);
      return `<span class="cp-dot cp-dot-sm" style="background:${hex}" title="${k}-${s} · ${hex}" role="img" aria-label="${k}-${s} ${hex}"></span>`;
    }).join("");
    return `<tr><th scope="row"><span class="cp-mono">${k}-*</span></th><td><span class="cp-mono">→ ${target}-*</span></td><td class="cp-dots">${dots}</td></tr>`;
  }).join("\n");
  return `<table class="cp-table">\n<thead><tr><th scope="col">key</th><th scope="col">参照先</th><th scope="col">50 → 950</th></tr></thead>\n<tbody>\n${rows}\n</tbody></table>`;
}

/** semantic 1行: ライト/ダークそれぞれのページ背景の上に、種類に応じた見本を描く */
function sample(kind, color, pageBg) {
  if (kind === "fg") return `<span class="cp-sample" style="background:${pageBg}"><span style="color:${color};font-weight:600">Aa あ</span></span>`;
  if (kind === "stroke") return `<span class="cp-sample" style="background:${pageBg}"><span class="cp-box" style="border:2px solid ${color}"></span></span>`;
  return `<span class="cp-sample" style="background:${pageBg}"><span class="cp-box" style="background:${color}"></span></span>`;
}

const SEMANTIC_GROUPS = [
  ["面", (n) => /^--color-(bg-(sunken|page|raised|overlay)|scrim)$/.test(n), "bg", "ダークでは sunken → page = raised → overlay の順に明るくする"],
  ["neutral の塗り・反転", (n) => /^--color-bg-(neutral|disabled|control|inverse)/.test(n), "bg", "hover・soft バッジ・switch のトラック・tooltip など"],
  ["色付きの塗り", (n) => /^--color-bg-(primary|negative|success|warning|info)/.test(n), "bg", "塗り / -hover / -disabled / -muted（100）/ -subtle（50）"],
  ["文字", (n) => n.startsWith("--color-fg-"), "fg", "fg-on-* は同じ役割の bg-* の塗りと必ずペアで使う"],
  ["枠線", (n) => n.startsWith("--color-stroke-"), "stroke", "入力欄の枠・フォーカスリングは 3:1 以上"],
  ["その他", (n) => n === "--color-shadow", "bg", "shadow-* の色"],
];

function semanticTables() {
  const semantic = lightDecls.filter((d) => /^--color-(bg|fg|stroke)-|^--color-(scrim|shadow)$/.test(d.name));
  const pageLight = resolve(light, "--color-bg-page");
  const pageDark = resolve(dark, "--color-bg-page");
  return SEMANTIC_GROUPS.map(([title, match, kind, note]) => {
    const rows = semantic.filter((d) => match(d.name)).map((d) => {
      const l = resolve(light, d.name);
      const dk = resolve(dark, d.name);
      const darkRef = ref(dark[d.name]);
      return `<tr>
  <th scope="row"><span class="cp-mono">${d.name.slice(8)}</span>${d.note ? `<span class="cp-sub">${esc(d.note)}</span>` : ""}</th>
  <td><div class="cp-val">${sample(kind, l, pageLight)}<span><span class="cp-mono">${esc(ref(d.value))}</span><span class="cp-sub">${esc(l)}</span></span></div></td>
  <td><div class="cp-val">${sample(kind, dk, pageDark)}<span><span class="cp-mono">${esc(darkRef)}</span><span class="cp-sub">${esc(dk)}</span></span></div></td>
</tr>`;
    }).join("\n");
    return `<div class="catalog-card">
  <div class="catalog-card-header"><p class="catalog-card-title">${title}</p><p class="catalog-card-note">${esc(note)}</p></div>
  <div class="cp-scroll"><table class="cp-table">
<thead><tr><th scope="col">トークン</th><th scope="col">ライト</th><th scope="col">ダーク</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
</div>`;
  }).join("\n\n");
}

// ---------------------------------------------------------------- page

const semanticCount = lightDecls.filter((d) => /^--color-(bg|fg|stroke)-|^--color-(scrim|shadow)$/.test(d.name)).length;

const html = foundationPage({
  title: "Colors",
  source: "scripts/build-color-page.mjs が tokens/colors.css",
  desc: `色は「原料（primitive）→ 役割ごとの色番号表（key）→ 用途（semantic）」の3層で定義しています。コンポーネントが使うのは semantic だけなので、ダークモードやブランド色の差し替えはトークン側を変えるだけで全体に反映されます。`,
  style: `.cp-scroll { overflow-x: auto; }
.cp-table, .cp-grid { width: 100%; border-collapse: collapse; font-size: 13px; }
.cp-table th, .cp-table td, .cp-grid th, .cp-grid td { padding: calc(var(--spacing) * 3) calc(var(--spacing) * 4); border-top: 1px solid var(--color-stroke-middle); text-align: left; vertical-align: middle; }
.cp-table thead th, .cp-grid thead th { color: var(--color-fg-low); font-weight: 600; border-top: none; }
.cp-grid td, .cp-grid thead th:not(:first-child) { text-align: center; padding-left: calc(var(--spacing) * 1); padding-right: calc(var(--spacing) * 1); }
.cp-mono { font-family: var(--font-mono); font-size: 12px; color: var(--color-fg-high); display: block; }
.cp-sub { display: block; font-size: 12px; font-weight: 400; color: var(--color-fg-low); margin-top: 2px; }
.cp-dot { display: inline-block; width: 28px; height: 28px; border-radius: var(--radius-xs); border: 1px solid var(--color-stroke-middle); vertical-align: middle; }
.cp-dot-sm { width: 18px; height: 18px; margin-right: 2px; }
.cp-dots { white-space: nowrap; }
.cp-val { display: flex; align-items: center; gap: calc(var(--spacing) * 3); }
.cp-sample { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 72px; height: 40px; border-radius: var(--radius-xs); border: 1px solid var(--color-stroke-middle); }
.cp-box { display: inline-block; width: 40px; height: 22px; border-radius: var(--radius-xs); }
.cp-layers { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: calc(var(--spacing) * 4); padding: 0 calc(var(--spacing) * 6) calc(var(--spacing) * 6); }
.cp-layer { border: 1px solid var(--color-stroke-middle); border-radius: var(--radius-sm); padding: calc(var(--spacing) * 4); }
.cp-layer p { margin: 0 0 calc(var(--spacing) * 2); }
.cp-body { padding: 0 calc(var(--spacing) * 6) calc(var(--spacing) * 6); }
.cp-code { background: var(--color-bg-sunken); border: 1px solid var(--color-stroke-middle); border-radius: var(--radius-sm); padding: calc(var(--spacing) * 4); font-size: 12px; overflow-x: auto; }
`,
  body: `
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">3層の構成</p><p class="catalog-card-note">正本は <code>tokens/colors.css</code></p></div>
      <div class="cp-layers">
        <div class="cp-layer"><p class="typo-large">① primitive</p><p class="typo-small">色そのものの名前（<code>slate-400</code> など）。全テーマ共通で変えない。<strong>コンポーネントからは使わない。</strong></p></div>
        <div class="cp-layer"><p class="typo-large">② key</p><p class="typo-small">役割ごとの色番号表（<code>primary-600</code> など）。<strong>ブランド色の差し替えはここ</strong>の参照先を変える。</p></div>
        <div class="cp-layer"><p class="typo-large">③ semantic</p><p class="typo-small">用途（<code>bg-raised</code> / <code>fg-low</code> / <code>stroke-control</code> など、${semanticCount}個）。<strong>コンポーネントはここだけを使う。</strong>ライト/ダークはこの層の値が切り替わる。</p></div>
      </div>
    </div>

    <h2 class="catalog-section-title typo-2xlarge">① primitive</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">6系統 × 11段階</p><p class="catalog-card-note">brand-green はこのDS固有。それ以外は Tailwind 標準と同じ値。ほかに white（${light["--color-white"]}）と black（${light["--color-black"]}）。色にカーソルを合わせると値が出ます。</p></div>
      ${primitiveGrid()}
    </div>

    <h2 class="catalog-section-title typo-2xlarge">② key</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">役割 → primitive の対応</p><p class="catalog-card-note">status 色（success / warning / negative / info）はブランド差し替えの対象外。</p></div>
      <div class="cp-scroll">${keyTable()}</div>
    </div>

    <h2 class="catalog-section-title typo-2xlarge">③ semantic</h2>
    <p class="typo-medium" style="color:var(--color-fg-middle)">命名は <code>{bg|fg|stroke}-{役割}-{強さ}-{状態}</code>。強さは neutral 系が low / middle / high、色付き系が 塗り / <code>-muted</code> / <code>-subtle</code>。見本はそれぞれのテーマのページ背景（<code>bg-page</code>）の上に描いています。</p>

${semanticTables()}

    <h2 class="catalog-section-title typo-2xlarge">テーマの使い方</h2>
    <div class="catalog-card">
      <div class="cp-body" style="padding-top:calc(var(--spacing) * 6)">
<pre class="cp-code"><code>&lt;html data-color-mode="dark"&gt;  &lt;!-- 常にダーク --&gt;
&lt;html data-color-mode="auto"&gt;  &lt;!-- OS の設定に追従 --&gt;
&lt;html&gt;                         &lt;!-- 属性なし = ライト（既定） --&gt;</code></pre>
        <ul class="typo-medium">
          <li>コンポーネントに <code>dark:</code> やテーマごとの分岐は書かない。semantic トークンだけで切り替わる</li>
          <li>コントラストは文字 4.5:1、UI部品（枠線・トラック・フォーカスリング）3:1 以上。<code>npm run check:consistency</code> が両テーマで検査する（disabled は対象外）</li>
          <li>黄色系（warning）の塗りの上だけは暗い文字（<code>fg-on-warning</code>）を使う</li>
          <li>フォーカスリングは info の青（<code>stroke-focus</code>）で固定</li>
        </ul>
      </div>
    </div>
`,
});

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, html);
console.log(`✓ ${path.relative(projectRoot, outFile)}（semantic ${semanticCount}個）`);
