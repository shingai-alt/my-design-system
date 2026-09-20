# Design System

Tailwind CSS v4 ベース、フレームワーク非依存のデザインシステムです。
デザイントークン + コンポーネントを CSS として提供します。正本はこのリポジトリのコードです。

参考プロダクト: Linear / Notion / Vercel — 控えめで機能的、情報密度を優先。

## 使い始める

### 1. ビルド

```bash
npm install
npm run build
```

`dist/ds.css` が生成されます。

```html
<link rel="stylesheet" href="dist/ds.css">
```

これで `.btn` / `.input` / `.card` などのクラスと、`bg-primary-500` / `text-fg-high` などのトークンユーティリティが使えます。

### 2. すぐ書ける例

```html
<button class="btn btn-md btn-primary btn-solid">保存</button>

<div class="alert alert-info">
  <span class="alert-icon" aria-hidden="true">i</span>
  <div class="alert-body">
    <p class="alert-title">お知らせ</p>
    <p>新しいバージョンが利用可能です。</p>
  </div>
</div>
```

全コンポーネントの動作確認は [`preview/index.html`](preview/index.html) を参照してください。

## コンポーネント一覧（11個）

| # | コンポーネント | 主要クラス |
|---|---|---|
| 1 | Button | `.btn` + `.btn-{primary,neutral,negative}` + `.btn-{solid,outline,ghost}` + `.btn-{sm,md,lg}` |
| 2 | Label Control | `.label-control`, `.label-control-{row,text,support}`, `.label-badge-{required,optional}`, `.field-{error,support}-text` |
| 3 | Input | `.input`, `.input-{sm,md,lg}`, `.input-error` |
| 4 | Select | `.select`, `.select-{sm,md,lg}`, `.select-error`（見た目はInputと統一） |
| 5 | Checkbox | `.checkbox`, `.checkbox-label`, `.checkbox-error` |
| 6 | Radio | `.radio`, `.radio-label`, `.radio-group` |
| 7 | Badge | `.badge` + `.badge-{soft,solid}-{neutral,primary,success,warning,negative,info}` |
| 8 | Card | `.card`, `.card-{header,title,subtitle,body,footer}` |
| 9 | Data Table | `.data-table`, `.data-table-num`, `.data-table-empty` |
| 10 | Alert | `.alert`, `.alert-{neutral,success,negative,warning,info}`, `.alert-{icon,body,title,close}` |
| 11 | Modal | `.modal`（ネイティブ `<dialog>` ベース。開閉は `showModal()` / `close()`） |
| 12 | Tab | `.tabs`, `.tab`（現在地は `aria-selected="true"`）, `.tab-count` |

アイコンは Lucide SVG sprite（`dist/icons.svg`、21種）を `.icon icon-{xs,sm,md,lg,xl}` で使用（詳細はDESIGN.md）。

各コンポーネントの完成形HTML・使用法（OK/NG）・アクセシビリティ対応は `src/components/*.css` の先頭コメントを参照してください（正本）。

## ドキュメント一覧

| ファイル | 内容 |
|---|---|
| [DESIGN.md](DESIGN.md) | 1枚にまとめた憲法（トークン値・非交渉原則・禁止パターン） |
| [PHASE0-DIRECTION.md](PHASE0-DIRECTION.md) | 参考プロダクト・ブランドカラー・デザイン原則の決定背景 |
| [src/components/](src/components/) | コンポーネントCSS（先頭コメントが仕様の正本） |
| [tokens/](tokens/) | デザイントークンの正本 |

## 開発

```bash
npm install       # 依存関係インストール
npm run build     # dist/ds.css をビルド
```

新しいトークン/クラスを `src/index.css` の `@source inline(...)` safelist に含めないと、
実際に使うコンポーネントが増えるまでビルドで刈り取られる点に注意（Tailwind v4の `source(none)` 設定のため）。

## MCP（AIコーディングツール連携）

AI（Claude Code等）にこのDSのコンポーネント仕様・トークン・原則を直接読ませるMCPサーバーを同梱しています（`src/mcp/`、ツールは3つ: `get_component` / `get_tokens` / `get_design_principles`）。

```bash
claude mcp add ds-mcp --scope project -- node "$(pwd)/src/mcp/server.mjs"
```

登録後、そのプロジェクトで最初に `claude` を対話起動した時に一度だけ承認が必要です（`.mcp.json` はマシン固有の絶対パスを含むためgitignore対象。各自ローカルで上記コマンドを実行してください）。

## 回帰スイート（evals）

固定のお題をAIに解かせて自動採点する仕組みです。詳細は [evals/README.md](evals/README.md) を参照してください。

```bash
npm run eval             # 全お題を実行（claude CLIとMCP接続が必要）
npm run eval:report      # 実行履歴の推移表（無料）
```
