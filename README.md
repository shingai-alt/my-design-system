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

## コンポーネント一覧（10個）

| # | コンポーネント | 主要クラス |
|---|---|---|
| 1 | Button | `.btn` + `.btn-{primary,neutral,negative}` + `.btn-{solid,outline,ghost}` + `.btn-{sm,md,lg}` |
| 2 | Input | `.input`, `.input-{sm,md,lg}`, `.input-error` |
| 3 | Select | `.select`, `.select-{sm,md,lg}`, `.select-error`（見た目はInputと統一） |
| 4 | Checkbox | `.checkbox`, `.checkbox-label`, `.checkbox-error` |
| 5 | Radio | `.radio`, `.radio-label`, `.radio-group` |
| 6 | Badge | `.badge` + `.badge-{soft,solid}-{neutral,primary,success,warning,negative,info}` |
| 7 | Card | `.card`, `.card-{header,title,subtitle,body,footer}` |
| 8 | Data Table | `.data-table`, `.data-table-num`, `.data-table-empty` |
| 9 | Alert | `.alert`, `.alert-{neutral,success,negative,warning,info}`, `.alert-{icon,body,title,close}` |
| 10 | Modal | `.modal`（ネイティブ `<dialog>` ベース。開閉は `showModal()` / `close()`） |
| 11 | Tab | `.tabs`, `.tab`（現在地は `aria-selected="true"`）, `.tab-count` |

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
