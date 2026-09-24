# コントリビューションガイド（Git / PR 運用）

relay-design-systemのdocs/CONTRIBUTING.mdを土台にしているが、運用ルールは**今の実態**に
合わせて書き換えている（relayはブランチ保護+PR必須の複数人運用、このDSは単独メンテナ +
AIアシスタントによる直接開発）。

## ブランチ運用

`main`は**保護ブランチではない**（2026-09時点。GitHub Settings → Branches に設定なし）。
実運用は、実装 → ローカルでコミット → mainへ直push。ブランチを切ってPRを経由する運用は
していない。将来チームで開発するようになったら、relay同様のブランチ保護 + PR必須運用に
切り替えるのが自然（そのときはこのファイルも更新する）。

## 開発セットアップ

```bash
npm install
npm run build     # dist/ds.css・dist/icons.svgを生成
```

このDSにはビルド済みの静的HTMLカタログ（`preview/`）しか無く、devサーバー用のnpmスクリプトは
無い。ローカルでプレビューを確認する場合は、リポジトリルートで簡易サーバーを立てて開く
（`icons.svg#id`のようなスプライト参照はfile://直開きでは描画されないため。詳細は
[ICONS.md](ICONS.md)）:

```bash
python3 -m http.server 8080
# → http://localhost:8080/preview/index.html
```

## 開発フロー（AIツールのチェックポイント運用）

「実装 → コミット → 🛑 ユーザー確認待ち → push」の**1段階で人間判断を挟む**。

```
[実装] → [git commit] → 🛑 ここでユーザーに「pushして」と言われるまで待つ
                                       ↓ ユーザー「push して」
                                     [git push origin main]
```

- コミットまではautonomousに進めてOK。**push は必ずユーザーの明示的な指示を待つ**
  （relayの「push→PR→マージ」の2段階チェックポイントを、直push運用に合わせて1段階に圧縮したもの）
- 1コミットは**self-contained**に — 単一のconcernを扱う。複数の変更を1コミットに混ぜない
  （例: このDSでは「selectorコンポーネント追加」「evals拡張」「forced-colors対応」を別コミットに分けた）

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) のプレフィックスを使う。
relayと違いscopeの括弧は付けず、本文は日本語で書く（このDSの既存コミット履歴と同じ書式）:

| プレフィックス | 用途 | 例 |
|---|---|---|
| `feat:`     | 新機能・新コンポーネント | `feat: Selector コンポーネントを追加` |
| `fix:`      | バグ修正 | `fix: selectorコンポーネントの登録漏れを修正` |
| `refactor:` | 動作を変えずに構造を整える | `refactor: typo-xs を typo-xsmall にリネーム` |
| `style:`    | 見た目・コード整形のみ | `style: 全コンポーネントをrelayの質感に突き合わせ` |
| `docs:`     | ドキュメント変更のみ | `docs: ICONS.md を移植` |
| `chore:`    | ビルド設定・依存更新・バージョン更新 | `chore: package.json にeval:report:htmlを追加` |

コミットメッセージの本文には**なぜ**その変更が必要だったかを書く（whatはdiffで見える）。
AI生成のコミットは`Co-Authored-By:`で明示する。

## コーディング規約

CSS / HTMLを書く時は**必ずデザインシステムが用意した変数を使う**（pixel / hex / 生数値の直書きは禁止）。
詳細は[DESIGN.md](../DESIGN.md)の非交渉原則と禁止パターン要約を参照。

## 整合性チェック

`npm run check:consistency`で、正本（コード側）と派生ドキュメントのズレを検知できる
（依存インストール不要）。pushすると`.github/workflows/check-consistency.yml`でも自動実行される。

| チェック | 正本 | 照合先 |
|---|---|---|
| アイコン数 | `scripts/build-icons.mjs`の`ICONS` | README / DESIGN.md / preview/index.html |
| MCPコンポーネント一覧 | `src/components/*.css`の実ファイル | `src/mcp/handlers.mjs`の`COMPONENT_NAMES`（過不足なく一致） |
| コンポーネント数 | `COMPONENT_NAMES`からicon除いた数 | READMEの見出し・表 |
| ヘッダ規約 | — | `src/components/*.css`先頭コメントの機能:/使用法:/アクセシビリティ:（MCPの正本） |
| index.css | `tokens/` `src/components/`の実ファイル | `@import`の網羅とtokens→components順序 |
| 色トークンの定義 | `tokens/colors.css` | `src/components/` `tokens/` `preview/` が参照する`var(--color-*)`がすべて定義済み |
| semantic のみ | — | `src/components/*.css`の色参照が semantic（`bg-*` `fg-*` `stroke-*` `scrim`）だけ |
| ダーク定義の一致 | `[data-color-mode="dark"]` | `@media (prefers-color-scheme: dark)`内の`[data-color-mode="auto"]`と同じ内容 |
| コントラスト | `tokens/colors.css`（ライト/ダーク） | `scripts/check-consistency.mjs`の`CONTRAST_PAIRS`（文字4.5:1・UI部品3:1） |
| タイポのトークン | `tokens/typography.css` | `src/components/*.css`の`font` `font-size` `font-weight` `line-height`が`var(--typo-*)` / `var(--font-weight-*)` / `inherit`だけ |
| 余白のスケール | `scripts/spacing-exceptions.mjs`（9段と例外） | `src/components/*.css`の余白の`var(--spacing) * N`が9段、px直書きなし、部品の高さ32/40/48pxの直書きなし。使われなくなった例外も検知 |
| 角丸・影・フォーカス | `tokens/radius.css` / `tokens/shadow.css` | `src/components/*.css`の`border-radius`が`var(--radius-*)`、`box-shadow`が`var(--shadow-md|lg)`か`none`、フォーカス時の`outline`が`var(--focus-outline)`（強制カラー用のシステム色は許可） |

エラーが出たら、指示に従いドキュメント側の表記を更新する。意図的に文言を変えた場合は
`scripts/check-consistency.mjs`のパターン定義（`ICON_CLAIMS`等）も更新する。

## 関連ドキュメント

- [ICONS.md](ICONS.md) — アイコン（Lucide SVG sprite）の使い方
- [DESIGN.md](../DESIGN.md) — トークン値・非交渉原則
- [PHASE0-DIRECTION.md](../PHASE0-DIRECTION.md) — 設計判断の決定背景
