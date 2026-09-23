/**
 * カタログの Spacing ページを tokens/spacing.css と scripts/spacing-exceptions.mjs から生成する。
 *
 *   output: preview/foundations/spacing.html（生成物。gitignore 済み）
 *   見本は実際のトークン・コンポーネントで描く。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, blockBody, declarations, foundationPage } from "./catalog-page.mjs";
import { SPACING_SCALE, SPACING_EXCEPTIONS } from "./spacing-exceptions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outFile = path.join(projectRoot, "preview/foundations/spacing.html");
const FILE = "tokens/spacing.css";

const css = await readFile(path.join(projectRoot, FILE), "utf8");
const base = declarations(blockBody(css, "@theme", FILE), "--").find((d) => d.name === "--spacing");
const controls = declarations(blockBody(css, ":root", FILE), "--control-");

const table = (head, rows) => `<div class="fp-scroll"><table class="fp-table">
<thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
<tbody>
${rows.join("\n")}
</tbody></table></div>`;

const scaleRows = SPACING_SCALE.map((n) => `<tr>
  <th scope="row"><span class="fp-mono">calc(var(--spacing) * ${n})</span><span class="fp-sub">p-${n} / gap-${n} / m-${n}</span></th>
  <td>${n * 4}px</td>
  <td><span class="sp-bar" style="width: calc(var(--spacing) * ${n})"></span></td>
</tr>`);

const SIZE = { sm: "sm", md: "md", lg: "lg" };
const controlRows = controls.map((d) => {
  const size = SIZE[d.name.split("-").pop()];
  return `<tr>
  <th scope="row"><span class="fp-mono">${d.name}</span><span class="fp-sub">${esc(d.value)}${d.note ? ` · ${esc(d.note)}` : ""}</span></th>
  <td><div class="sp-row">
    <button class="btn btn-${size} btn-primary btn-solid" type="button">ボタン</button>
    <input class="input input-${size}" style="width: 160px" placeholder="入力欄" aria-label="見本の入力欄 ${size}">
    <button class="icon-btn icon-btn-${size} icon-btn-neutral icon-btn-outline" type="button" aria-label="見本のアイコンボタン ${size}"><svg class="icon icon-sm" aria-hidden="true"><use href="../icons.svg#lucide-search"></use></svg></button>
  </div></td>
</tr>`;
});

const exceptionRows = SPACING_EXCEPTIONS.map((e) => `<tr>
  <th scope="row"><span class="fp-mono">${esc(e.file)}</span><span class="fp-sub">${esc(e.selector)} / ${esc(e.prop)}</span></th>
  <td>${esc(e.value)}</td>
  <td>${esc(e.reason)}</td>
</tr>`);

const html = foundationPage({
  title: "Spacing",
  source: "scripts/build-spacing-page.mjs が tokens/spacing.css と scripts/spacing-exceptions.mjs",
  desc: `余白は <code>--spacing</code>（${esc(base.value)} = 4px）の倍数で指定し、使ってよいのは下の9段だけです。部品の高さは余白とは別の3段（<code>--control-height-*</code>）で揃えます。9段と例外は <code>npm run check:consistency</code> が検査します。`,
  style: `
.sp-bar { display: inline-block; height: 12px; min-width: 1px; background: var(--color-bg-primary); border-radius: 2px; vertical-align: middle; }
.sp-row { display: flex; align-items: center; gap: calc(var(--spacing) * 3); flex-wrap: wrap; }`,
  body: `
    <h2 class="catalog-section-title typo-2xlarge">余白の9段</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">calc(var(--spacing) * N)</p><p class="catalog-card-note">コンポーネントCSSはこの書き方（ビルドしなくても読める plain CSS）。HTML では Tailwind の p-N / gap-N / m-N</p></div>
      ${table(["書き方", "値", "見本"], scaleRows)}
    </div>

    <h2 class="catalog-section-title typo-2xlarge">部品の高さ</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">--control-height-{sm, md, lg}</p><p class="catalog-card-note">button / icon-button / input / select / search-input / selector / pagination。文字を含む部品は min-height、正方形の部品は width / height に使う</p></div>
      ${table(["トークン", "見本"], controlRows)}
    </div>

    <h2 class="catalog-section-title typo-2xlarge">例外</h2>
    <div class="catalog-card">
      <div class="catalog-card-header"><p class="catalog-card-title">9段に乗らない余白</p><p class="catalog-card-note">scripts/spacing-exceptions.mjs に理由付きで登録したものだけ許可する</p></div>
      ${table(["場所", "値", "理由"], exceptionRows)}
    </div>

    <h2 class="catalog-section-title typo-2xlarge">ルール</h2>
    <div class="catalog-card">
      <div class="fp-body" style="padding-top:calc(var(--spacing) * 6)">
        <ul class="typo-medium">
          <li>9段外の値は近い段に丸める。丸められない位置合わせだけ、理由を付けて例外に登録する</li>
          <li>意味ごとの余白トークン（stack-gap・card-padding 等）は作らない。2箇所以上で実際に使う場面が出たときだけ追加する</li>
          <li>アイコン・バッジ・checkbox 等の小さい部品のサイズは px のまま（部品ごとに固有で共有されないため）</li>
          <li>ターゲットサイズは 24px 以上（WCAG 2.5.8）。sm の 32px でも満たす</li>
        </ul>
      </div>
    </div>
`,
});

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, html);
console.log(`✓ ${path.relative(projectRoot, outFile)}（9段 / 部品の高さ ${controls.length} / 例外 ${SPACING_EXCEPTIONS.length}）`);
