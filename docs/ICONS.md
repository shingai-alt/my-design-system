# Icons（Lucide SVG sprite）

[Lucide](https://lucide.dev) から21アイコンをSVG spriteとして同梱しています。JSフレームワーク不要、`currentColor`で着色追従します。
relay-design-systemのdocs/ICONS.mdと同じ方式（`currentColor` + サイズクラス + spriteのuse参照）です。

## 使い方

### このリポジトリ内・ビルド済みdist/を配布する場合

```html
<link rel="stylesheet" href="dist/ds.css">
<svg class="icon icon-md">
  <use href="dist/icons.svg#lucide-search"></use>
</svg>
```

このDSはnpm公開していない（`package.json`が`"private": true`）ため、`import`でパッケージから読み込む使い方はできません。`dist/ds.css` と `dist/icons.svg` を配置先にコピーして参照してください。

### 単一HTMLファイル / file:// で表示する場合（インラインsymbol）

外部の `icons.svg#id` 参照はfile://で開いた文書では描かれません（別ファイル扱いになるため）。プロトタイプの単一HTMLやメールなどスプライトを配信できない場面では、必要なアイコンの`<symbol>`を文書内に一度定義し、同一文書の`#id`で参照します。

```html
<svg hidden aria-hidden="true" focusable="false">
  <symbol id="lucide-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">…</symbol>
</svg>

<svg class="icon icon-md" aria-hidden="true"><use href="#lucide-search"></use></svg>
```

symbolのmarkupは `dist/icons.svg` を開いて該当する `<symbol id="lucide-…">…</symbol>` ブロックをそのままコピーします（relayにある`get_icon` MCPツールはこのDSにはまだ無いため、自分で探す必要があります）。どちらの書き方でもclassは`icon` + サイズクラス（`icon-md`等）を必ず併記します。`.icon`単体にはサイズが無く、省くとSVG既定の300×150pxで描かれます。

## サイズ

| クラス | px |
|---|---|
| `.icon-xs` | 12 |
| `.icon-sm` | 16 |
| `.icon-md` | 20（既定） |
| `.icon-lg` | 24 |
| `.icon-xl` | 32 |

## 着色

`currentColor`を継承します。`text-primary-500` / `text-fg-low` などのトークンユーティリティで色付け可能。

## 同梱アイコン一覧（21種）

| カテゴリ | アイコン名 |
|---|---|
| Action | `plus`, `x`, `check`, `pencil`, `trash-2` |
| Navigation | `chevron-up`, `chevron-down`, `chevron-left`, `chevron-right`, `menu`, `more-horizontal` |
| Status | `info`, `check-circle`, `alert-triangle`, `alert-circle` |
| Search / Visibility | `search`, `eye`, `eye-off` |
| Object | `external-link`, `settings`, `user` |

プレビューは[preview/index.html](../preview/index.html)の「Icons」カードでも確認できます。
追加して欲しいLucideアイコンがあれば`scripts/build-icons.mjs`の`ICONS`配列に追記してください。

## ビルドの仕組み

`scripts/build-icons.mjs`が `node_modules/lucide-static/icons/` から `dist/icons.svg` と `preview/icons.svg`（gitignored・ローカル閲覧用のコピー）を生成します。`npm run build`（内部で`npm run build:icons`を実行）でビルドされます。
