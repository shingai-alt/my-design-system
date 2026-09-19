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
2. **Semantic Color** — `bg-primary-600` / `text-fg-high` を使う。primitive（`bg-primary-*` 以外の生スケール）直参照は最終手段
3. **Blessed Spacing** — `p-{0,1,2,3,4,6,8,12,16}` のみ使う
4. **Typography セマンティック層** — `.typo-{xsmall..3xlarge}` を使う。生の `text-sm` 等は禁止
5. **ARIA属性で状態を表現** — `[aria-pressed="true"]` 等をCSSセレクタに使う。独自の `is-*` クラスは作らない
6. **フォーカスリングはinfo（青）固定** — `--shadow-focus-ring` のみ。色を変えない、見切れさせない
7. **保護ブランチへの直push禁止** — feature branch + PR

---

## Quick Reference

### Color Tokens

```
プライマリ (forest-green) : bg-primary-600 (#25835c) / hover bg-primary-700
ニュートラル (slate)      : neutral-{50..900}
本文テキスト(高優先)      : text-fg-high (neutral-900)
本文テキスト(中優先)      : text-fg-middle (neutral-700)
補助テキスト              : text-fg-low (neutral-500)
ボーダー                  : border-stroke-{high,middle}
ステータス                : success(#16a34a) / warning(#f59e0b) / negative(#ef4444) / info(#2563eb)
背景                      : bg-page (white) / bg-surface (neutral-50)
```

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
| 恒常的なsurfaceのelevationをシャドウで表現 | border + 背景色 |
| main（保護ブランチ）へ直push | feature branch + PR |

### ハードコードを許容する例外

| 状況 | 理由 |
|---|---|
| 1箇所限定のbespoke装飾色（パレットに無い） | トークン化するほどではない。コメントで由来を明記 |
| 比率・100%・auto | スケール非依存値 |
| 強制カラーモードのシステムカラー（`ButtonText`等） | OSの設定に追従する系統色のため |
| `background-image` の SVG data URI 内の色 | `var()`/`currentColor` が解決できないため直書き。変更時はコメントの色名と実値を両方直す |

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

## より深く知りたいとき

- **トークン値の正本**: [tokens/](tokens/)
- **方向性の背景**: [PHASE0-DIRECTION.md](PHASE0-DIRECTION.md)
- **ビルド**: `npm run build` → `dist/ds.css`
