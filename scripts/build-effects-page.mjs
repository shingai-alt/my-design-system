/**
 * カタログの Radius & Shadow ページを tokens/radius.css・tokens/shadow.css と src/components/*.css から生成する。
 *
 *   output: preview/foundations/effects.html（生成物。gitignore 済み）
 *   角丸の「使っているコンポーネント」はコンポーネント CSS を走査して出すので、手で更新しなくてよい。
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, blockBody, declarations, foundationPage } from "./catalog-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outFile = path.join(projectRoot, "preview/foundations/effects.html");

const radiusCss = await readFile(path.join(projectRoot, "tokens/radius.css"), "utf8");
const shadowCss = await readFile(path.join(projectRoot, "tokens/shadow.css"), "utf8");
const radii = declarations(blockBody(radiusCss, "@theme", "tokens/radius.css"), "--radius-");
const shadows = declarations(blockBody(shadowCss, "@theme", "tokens/shadow.css"), "--shadow-");
const focus = declarations(blockBody(shadowCss, ":root", "tokens/shadow.css"), "--focus-");

// コンポーネントごとに、使っている角丸トークンを集める
const componentsDir = path.join(projectRoot, "src/components");
const usedBy = Object.fromEntries(radii.map((r) => [r.name, new Set()]));
for (const file of (await readdir(componentsDir)).filter((f) => f.endsWith(".css")).sort()) {
  const code = (await readFile(path.join(componentsDir, file), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, token] of code.matchAll(/border(?:-[a-z]+)*-radius\s*:[^;]*?var\((--radius-[a-z]+)\)/g)) {
    usedBy[token]?.add(file.replace(/\.css$/, ""));
  }
}

const ROLE = { "--radius-md": "外枠（面）", "--radius-sm": "部品", "--radius-xs": "部品の中の小さい要素", "--radius-full": "丸・ピル" };

const table = (head, rows) => `<div class="fp-scroll"><table class="fp-table">
<thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
<tbody>
${rows.join("\n")}
</tbody></table></div>`;

const radiusRows = radii.map((r) => {
  const users = [...usedBy[r.name]];
  return `<tr>
  <th scope="row"><span class="fp-mono">${r.name}</span><span class="fp-sub">${esc(r.value)}</span></th>
  <td><span class="ef-box" style="border-radius: var(${r.name})"></span></td>
  <td>${esc(ROLE[r.name] ?? "—")}<span class="fp-sub">${users.length ? esc(users.join(" / ")) : "コンポーネントでは未使用"}</span></td>
</tr>`;
});

const shadowRows = shadows.map((s) => `<tr>
  <th scope="row"><span class="fp-mono">${s.name}</span><span class="fp-sub">${esc(s.note)}</span></th>
  <td><div class="ef-stage"><span class="ef-card" style="box-shadow: var(${s.name})"></span></div></td>
  <td><div class="ef-stage" data-color-mode="dark"><span class="ef-card" style="box-shadow: var(${s.name})"></span></div></td>
</tr>`);

const focusRows = focus.map((f) => `<tr><th scope="row"><span class="fp-mono">${f.name}</span></th><td><span class="fp-mono">${esc(f.value)}</span></td></tr>`);

const html = foundationPage({
  title: "Radius &amp; Shadow",
  source: "scripts/build-effects-page.mjs が tokens/radius.css・tokens/shadow.css・src/components/*.css",
  desc: `角丸は役割で選びます（外枠は md、部品は sm、部品の中の小さい要素は xs、丸いものは full）。影は一時的に重なる層（tooltip・modal）だけに使い、カードなどの面には使いません。フォーカスリングは全コンポーネント共通の outline です。`,
  style: `
.ef-box { display: inline-block; width: 96px; height: 56px; background: var(--color-bg-primary-muted); border: 1px solid var(--color-stroke-primary); }
.ef-stage { display: flex; align-items: center; justify-content: center; height: 96px; border-radius: var(--radius-sm); background: var(--color-bg-page); }
.ef-card { display: inline-block; width: 120px; height: 56px; border-radius: var(--radius-sm); background: var(--color-bg-overlay); }
.ef-row { display: flex; align-items: center; gap: calc(var(--spacing) * 6); flex-wrap: wrap; }`,
  body: `
    <h2 class="catalog-section-title typo-2xlarge">角丸</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">--radius-*</p><p class="catalog-card-note">「使っているコンポーネント」は src/components/*.css から自動で集計</p></div>
      ${table(["トークン", "見本", "役割と使っているコンポーネント"], radiusRows)}
    </div>

    <h2 class="catalog-section-title typo-2xlarge">影</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">--shadow-*</p><p class="catalog-card-note">ダークでは濃くし、明るい 1px の輪郭を足す。見本の面は bg-overlay</p></div>
      ${table(["トークン", "ライト（ページのテーマ）", "ダーク"], shadowRows)}
    </div>

    <h2 class="catalog-section-title typo-2xlarge">フォーカスリング</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">outline: var(--focus-outline)</p><p class="catalog-card-note">強制カラーモードでは box-shadow が消えるため、outline で描く。色は info の青で固定</p></div>
      ${table(["トークン", "値"], focusRows)}
      <div class="fp-body" style="padding-top:calc(var(--spacing) * 6)">
        <div class="ef-row">
          <button class="btn btn-md btn-primary btn-solid" type="button" style="outline: var(--focus-outline); outline-offset: var(--focus-outline-offset)">フォーカス中</button>
          <input class="input input-md" style="width: 180px; outline: var(--focus-outline); outline-offset: var(--focus-outline-offset)" value="フォーカス中" aria-label="フォーカスの見本">
          <span class="typo-small" style="color: var(--color-fg-low)">見本は常に表示している（実際はキーボード操作時だけ表示）</span>
        </div>
      </div>
    </div>

    <h2 class="catalog-section-title typo-2xlarge">ルール</h2>
    <div class="catalog-card">
      <div class="fp-body" style="padding-top:calc(var(--spacing) * 6)">
<pre class="fp-code"><code>.my-control:focus-visible { outline: var(--focus-outline); outline-offset: var(--focus-outline-offset); }  /* OK */
.my-control:focus-visible { outline: none; box-shadow: 0 0 0 3px blue; }   /* NG（check:consistency でエラー） */
.menu-item:focus-visible  { outline: var(--focus-outline); outline-offset: -2px; }  /* 内側に描く場合は offset だけ変える */</code></pre>
        <ul class="typo-medium">
          <li>影は tooltip・popover に <code>--shadow-md</code>、modal に <code>--shadow-lg</code>。カード等の面は枠線と背景色で区切る</li>
          <li><code>border-radius</code>・<code>box-shadow</code>・フォーカスの <code>outline</code> の直書きは <code>npm run check:consistency</code> で検知する</li>
          <li>z-index のトークンは作らない。重なる層は <code>&lt;dialog&gt;</code> や <code>popover</code> 属性で最前面に出す</li>
        </ul>
      </div>
    </div>
`,
});

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, html);
console.log(`✓ ${path.relative(projectRoot, outFile)}（角丸 ${radii.length} / 影 ${shadows.length}）`);
