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
4. **Typography セマンティック層** — `.typo-{xsmall..3xlarge}` を使う。生の `text-sm` 等は禁止
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
→ `p-{0,1,2,3,4,6,8,12,16}` / `gap-{...}` / `m-{...}`。祝福外は近傍値に丸める。

### Container

```
--container-page    : 76.25rem (1220px) → 一覧・帯
--container-content : 56.25rem (900px)  → フォーム・設定・詳細
--container-article  : 42rem (672px)     → 長文本文
```

### Typography（本文14pxベース — Linear/Notion系の情報密度を優先）

```
.typo-xsmall  : 11px / 16px
.typo-small   : 13px / 20px
.typo-medium  : 14px / 20px  ← 本文 default
.typo-large   : 16px / 24px (bold必須)
.typo-xlarge  : 18px / 28px (bold必須)
.typo-2xlarge : 20px / 28px (bold必須) ← セクション見出し
.typo-3xlarge : 24px / 32px (bold必須) ← ページタイトル
```

### Radius / Shadow

```
rounded-{none,xs,sm,md,lg,full} = 0 / 4 / 8 / 16 / 24 / 9999 px
shadow-{sm,md,lg}          : 一時レイヤー(modal/tooltip)専用
shadow-focus-ring          : 0 0 0 3px #2563eb（info-600固定）
shadow-destructive         : 0 0 0 3px #ef4444
```

**elevationの表現にシャドウを使わない。** 恒常的なsurface（カード等）はborder + 背景色で区切る。

---

## 禁止パターン要約

| 禁止 | 代替 |
|---|---|
| `padding: 16px` `color: #334155` 等の生値直書き | トークン経由（`p-4` / `text-fg-middle`） |
| 祝福外spacing（`p-5`, `p-7`等） | 近傍の祝福値 |
| `text-sm` / `text-base` 直書き | `.typo-small` / `.typo-medium` |
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
| `background-image` の SVG data URI 内の色 | `var()`/`currentColor` が解決できないため直書き。変更時はコメントの色名と実値を両方直す |
| Figma仕様やアイコンとの位置合わせでoff-scaleな`calc(var(--spacing) * N)`が必要 | 祝福値に丸めるとズレる少数のケース限定。コメントでpx値と理由を明記（例: `modal.css`のmax-width、`accordion.css`のpanel padding-left） |

---

## グローバル設定

| 設定 | 値 |
|---|---|
| カラーモード | ライトのみ |
| Primary | `#2f9e6f`（500）/ 主に使うのは600 `#25835c` |
| Font | Inter + Noto Sans JP |
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
