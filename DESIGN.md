# Design System — Design Constitution

> AI エージェントがUIを生成するとき、最初に読むファイル。
> 非交渉原則とクイックリファレンスをこの1枚に集約する。

**"トークン経由でしか描かない"** — コードが正本。手作業の値は混ぜない。
参考: Linear / Notion / Vercel — 控えめで機能的、情報密度を優先する。アンチ: 生hex直書き、意味のない色数の増加。

---

## デザイン原則

迷ったら、この3つに照らして選ぶ。

1. **ゆったりとした余白**（2026-09改訂: 当初「情報密度優先」だったが、relayに近い柔らかい余白・角丸に変更） — 角丸・パディングはrelay寄りの大きめの値を使う。本文サイズ(14pxベース)は維持
2. **色は状態を伝える手段に限定する** — primary（緑）+ ニュートラル + ステータス色（success/warning/negative/info）のみ。装飾のために色を増やさない
3. **非デザイナーが迷わない命名にする** — コンポーネント名・クラス名は機能から一目でわかる語を使う。PM/エンジニアが使う前提

---

## Non-Negotiable Principles

1. **ハードコーディング禁止** — pixel / hex / 生数値で直書きしない。必ずトークン経由
2. **Semantic Color** — 色は primitive → key → semantic の3層（`tokens/colors.css`）。コンポーネントは semantic（`--color-bg-*` / `--color-fg-*` / `--color-stroke-*`）だけを使う（`npm run check:consistency` で検査）。key（`primary-*` 等）・primitive（`brand-green-*` / `slate-*` 等）の直参照は禁止
3. **Blessed Spacing** — `p-{0,1,2,3,4,6,8,12,16}` のみ使う
4. **Typography セマンティック層** — コンポーネントCSSは `font: var(--typo-*)` の1行で指定する（`npm run check:consistency` で検査）。HTML では `.typo-{xsmall..3xlarge}` を使う。`font-size: 14px` や生の `text-sm` 等は禁止
5. **ARIA属性で状態を表現** — `[aria-pressed="true"]` 等をCSSセレクタに使う。独自の `is-*` クラスは作らない
6. **フォーカスリングはinfo（青）固定** — `--shadow-focus-ring` のみ。色を変えない、見切れさせない
7. **保護ブランチへの直push禁止** — feature branch + PR

---

## Quick Reference

### Color Tokens

```
① primitive（直参照禁止）: brand-green / slate / red / amber / green / blue の 50〜950
② key（ブランド差し替え口）: primary(=brand-green) / neutral(=slate) / success(=green) / warning(=amber) / negative(=red) / info(=blue)
③ semantic（コンポーネントはここ。値はライト）:
  面          : bg-sunken (neutral-50) / bg-page (white) / bg-raised (white) / bg-overlay (white) / scrim
  neutral の塗り: bg-neutral-low (50, 面の上の hover) / bg-neutral-middle (100, ghost の hover・soft バッジ) / bg-neutral-high (200)
  その他の塗り: bg-disabled (入力欄の disabled) / bg-control-off(-hover) (switch の OFF) / bg-inverse(-hover) (tooltip・neutral の solid)
  色付きの塗り: bg-{primary,negative,success,warning,info} / -hover / -disabled / -muted (100) / -subtle (50)
  文字        : fg-high (neutral-900) / fg-middle (neutral-700) / fg-low (neutral-500) / fg-placeholder / fg-disabled / fg-inverse(-middle)
  塗りの上    : fg-on-{primary,negative,success,info} (white) / fg-on-warning (neutral-900 ← 黄色系だけ暗い文字)
  色付き文字  : fg-primary(-hover|-disabled) / fg-negative (白の上) / fg-negative-strong (negative-subtle・-muted の上) / fg-{success,warning,info}
  枠線        : stroke-{high,middle,low} / stroke-control(-hover|-error) / stroke-{primary,negative}(-disabled) / stroke-{status}-subtle / stroke-focus (info-600 固定)
```

### テーマ（ライト / ダーク）

```html
<html data-color-mode="dark">  <!-- 常にダーク -->
<html data-color-mode="auto">  <!-- OS の設定に追従 -->
<html>                         <!-- 属性なし = ライト（既定） -->
```

- 切り替わるのは semantic 層だけ（`tokens/colors.css` 末尾）。コンポーネント側に `dark:` やテーマ分岐は書かない
- ダークでは sunken → page = raised → overlay の順に明るくする。primary / status の塗りはライトと同じ段のまま、文字・枠線を明るい段に選び直す
- コントラスト（文字 4.5:1、UI部品 3:1）は `npm run check:consistency` が両テーマで検査する

> primaryとsuccessは別の緑にしている。brand色（主操作）と成功状態を混同させないため。

### Spacing Scale（祝福される9段階）

```
0=0  1=4px  2=8px  3=12px  4=16px  6=24px  8=32px  12=48px  16=64px
```
→ `p-{0,1,2,3,4,6,8,12,16}` / `gap-{...}` / `m-{...}`。コンポーネントCSSは `calc(var(--spacing) * N)`（`--spacing(N)` は使わない。ビルドしなくても読める plain CSS にするため）。祝福外は近傍値に丸める。

```
部品の高さ（余白とは別の段）: --control-height-sm = 32px / -md = 40px / -lg = 48px
  button / icon-button / input / select / search-input / selector / pagination で使う
  文字を含む部品は min-height（文字サイズ・行間を上書きされても内容がはみ出さない）、正方形の部品は width / height
```

- 9段と部品の高さは `npm run check:consistency`（spacing-scale）が検査する。例外は `scripts/spacing-exceptions.mjs` に理由付きで登録する
- 意味ごとの余白トークン（stack-gap・card-padding 等）は作らない。2箇所以上で実際に使う場面が出たときだけ追加する
- アイコン・バッジ・checkbox 等の小さい部品のサイズは px のまま

### Container

```
--container-page    : 76.25rem (1220px) → 一覧・帯
--container-content : 56.25rem (900px)  → フォーム・設定・詳細
--container-article  : 42rem (672px)     → 長文本文
```

### Typography（本文14pxベース — Linear/Notion系の情報密度を優先）

```
① primitive（直参照禁止）: --text-{11,12,13,14,16,18,20,24}（rem）/ --leading-{100,133,140,150,170} / --font-weight-{normal,semibold,bold} / --font-sans / --font-mono
② semantic（font ショートハンド。コンポーネントはここ）: サイズ / 行間 / 太さ
  body          : 14 / 1.5 / 400  ← 本文 default（.typo-medium）
  body-small    : 13 / 1.5 / 400  （.typo-small）
  body-large    : 16 / 1.5 / 400
  label         : 14 / 1.5 / 600  ← ボタン・タブなど UI 部品の文字
  label-strong  : 14 / 1.5 / 700  ← 入力欄のラベル・アコーディオン
  label-small / label-large : 13・16 / 1.5 / 600
  caption       : 12 / 1.5 / 400  ← 補足・エラー文（12px 以下は単一行に限る）
  caption-strong: 12 / 1.33 / 600 ← バッジ
  caption-small : 11 / 1.5 / 400  （.typo-xsmall）
  heading-sm    : 16 / 1.5  / 700 （.typo-large）
  heading-md    : 18 / 1.5  / 700 （.typo-xlarge）
  heading-lg    : 20 / 1.4  / 700 （.typo-2xlarge）← セクション見出し
  heading-xl    : 24 / 1.33 / 700 （.typo-3xlarge）← ページタイトル
.typo-numeric : 桁をそろえる数字（tabular-nums）
```

- 状態で太さだけ変える場合（選択中のメニュー等）は `font-weight: var(--font-weight-bold)` を使ってよい
- `font` ショートハンドは `font-variant-numeric` 等もリセットするので、それらは `font` より後に書く
- 字間・palt は使わない。全トークンの見本はカタログの Typography ページ

### Radius / Shadow

```
rounded-{none,xs,sm,md,lg,full} = 0 / 4 / 8 / 16 / 24 / 9999 px
shadow-{sm,md,lg}          : 一時レイヤー(modal/tooltip)専用
shadow-focus-ring          : 0 0 0 3px stroke-focus（info-600固定。ダークは info-400）
shadow-destructive         : 0 0 0 3px stroke-control-error（negative-500）
```

**elevationの表現にシャドウを使わない。** 恒常的なsurface（カード等）はborder + 背景色で区切る。

---

## 禁止パターン要約

| 禁止 | 代替 |
|---|---|
| `padding: 16px` `color: #334155` 等の生値直書き | トークン経由（`p-4` / `text-fg-middle`） |
| 祝福外spacing（`p-5`, `p-7`等） | 近傍の祝福値 |
| 部品の高さ `height: 40px` 等の直書き | `min-height: var(--control-height-md)` |
| `text-sm` / `text-base` 直書き | `.typo-small` / `.typo-medium` |
| コンポーネントCSSで `font-size: 14px` / `font-weight: 700` 等を直書き | `font: var(--typo-*)`（太さだけ変える場合は `var(--font-weight-*)`） |
| `is-selected` 等の状態クラス | `aria-selected="true"` 等 |
| フォーカスリングの色変更 | info青のまま固定 |
| コンポーネントCSSで key / primitive（`--color-primary-600` `--color-slate-400` 等）を直接参照 | semantic（`--color-bg-primary` `--color-stroke-control` 等）。ダーク・ブランド差し替えに追従しないため |
| `dark:` やテーマごとの分岐をコンポーネントに書く | semantic トークンだけで切り替わる |
| 恒常的なsurfaceのelevationをシャドウで表現 | border + 背景色 |
| main（保護ブランチ）へ直push | feature branch + PR |

### ハードコードを許容する例外

| 状況 | 理由 |
|---|---|
| 1箇所限定のbespoke装飾色（パレットに無い） | トークン化するほどではない。コメントで由来を明記 |
| 比率・100%・auto | スケール非依存値 |
| 強制カラーモードのシステムカラー（`ButtonText`等） | OSの設定に追従する系統色のため |
| `background-image` の SVG data URI 内の色 | `var()`/`currentColor` が解決できないため直書き。コンポーネントには書かず、`tokens/colors.css` の変数（例: `--select-arrow`）にライト・ダーク両方の値を置く。変更時はコメントの色名と実値を両方直す |
| Figma仕様やアイコンとの位置合わせでoff-scaleな`calc(var(--spacing) * N)`や、枠線の太さを補正する px が必要 | 祝福値に丸めるとズレる少数のケース限定。`scripts/spacing-exceptions.mjs` に理由付きで登録する（登録しないと check:consistency が落ちる。例: `accordion.css` の panel padding-left、`tab.css` の下線補正） |

---

## グローバル設定

| 設定 | 値 |
|---|---|
| カラーモード | ライト（既定）/ ダーク（`data-color-mode="dark"` / `"auto"`） |
| Primary | `#2f9e6f`（500）/ 主に使うのは600 `#25835c` |
| Font | OS のフォント（`system-ui` / ヒラギノ / 游ゴシック UI / メイリオ）。Webフォントは読み込まない |
| ベーススペーシング | 4px |
| 参考プロダクト | Linear / Notion / Vercel |

---

### Icons (Lucide SVG sprite, 21 icons)

```
<svg class="icon icon-md" aria-hidden="true"><use href="dist/icons.svg#lucide-search" /></svg>
```

装飾アイコンは `aria-hidden="true"`。単独で意味を持つアイコンは `aria-hidden` を外し `aria-label` か `<title>` を付ける。

```
icon-xs=12px  icon-sm=16px  icon-md=20px(既定)  icon-lg=24px  icon-xl=32px
currentColorを継承するのでtext-primary-600等で着色可能
```

---

## より深く知りたいとき

- **コンポーネント一覧・クラス名**: [README.md](README.md#コンポーネント一覧26個)
- **コンポーネントの完全仕様（使用法OK/NG・アクセシビリティ）**: 各 [src/components/*.css](src/components/) の先頭コメント（正本）。MCPの `get_component` でも同じ内容を取得可能
- **実例を見る**: [preview/index.html](preview/index.html)
- **トークン値の正本**: [tokens/](tokens/)
- **方向性の背景**: [PHASE0-DIRECTION.md](PHASE0-DIRECTION.md)
- **ビルド**: `npm run build` → `dist/ds.css`
