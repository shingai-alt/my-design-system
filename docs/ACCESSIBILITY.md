# アクセシビリティチェックリスト（WCAG 2.2 抜粋版）

relay-design-systemの`docs/ACCESSIBILITY.md`（WCAG 2.2 全86基準を1基準ずつ解説、1451行）を
土台にしているが、全文は移植していない。単独メンテナが運用する分量としては重すぎるため、
「DSが実際に何を担保しているか」「プロダクト側で何が必要か」の早見表だけを抜粋している。

個別コンポーネントのアクセシビリティ仕様（キーボード操作・ARIA属性・OK/NG）は
[src/components/*.css](../src/components/) 先頭コメントが正本。このファイルは横断的な
早見表であり、コンポーネント単位の詳細はそちらを見る。

## Levelの考え方

WCAG 2.2は A ⊂ AA ⊂ AAA の階層。一般的な準拠目標は **AA**（AAAは一部のみ現実的）。
このDSはAA相当を基本ラインとし、コントラストなど一部の値でAAAも満たす。

## DSが既に担保している項目

| 担保 | 関連基準 | 実装 |
|---|---|---|
| 本文コントラスト (AAA, 通常文字) | 1.4.6 | `--color-fg-high` (neutral-900, 白背景比 約17.9:1) / `--color-fg-middle` (neutral-700, 約10.4:1) |
| 標準コントラスト (AA) | 1.4.3 | `--color-fg-low` (neutral-500, 約4.76:1) — 通常文字AAA(7:1)は満たさないので本文には使わない |
| キーボード操作 | 2.1.1 / 2.1.2 | 標準コンポーネントを使うだけ（トラップなし） |
| Focus ring | 2.4.7 | `--shadow-focus-ring`（info-600固定, 3px）がデフォルト。色は変えない仕様（[DESIGN.md](../DESIGN.md)） |
| 閃光なし | 2.3.1 / 2.3.2 | DSにアニメーション閃光は無い |
| 動きの抑制 | 2.3.3 | `prefers-reduced-motion: reduce` で accordion のアイコン回転・switch のつまみスライドを止める。色/透明度のフェード(150ms)は動きではないので残す。button の loading スピナーは状態表示そのものなので止めない |
| 入力共存 | 2.5.6 | キーボード / マウス / タッチ全対応（clickイベントベース） |
| ポインタキャンセル | 2.5.2 | `click`イベントベース、`mousedown`で発火しない |
| 見出し階層 | 2.4.6 / 2.4.10 | `.typo-*` を意味順で使う（サイズでなく見出しレベルで選ぶ） |
| 名前・役割・値 | 4.1.2 | ネイティブHTML + ARIA state（`aria-pressed`等。[DESIGN.md](../DESIGN.md)の非交渉原則5） |
| 最小ターゲット (AA) | 2.5.8 | ボタン`sm`でも32px。checkbox/radio/switchの`sm`はラベル併用でタップ領域を確保 |
| 強制カラーモード (Windows High Contrast) | 1.4.11 相当 | 20/28コンポーネントで`forced-colors`対応済み。**実機のHCM表示は未検証**（build/構文チェックのみ） |

## プロダクト側で実装が必要なもの

DSはコンポーネント単体の見た目・操作性しか担保できない。ページ単位の項目はプロダクト側の責務。

| 領域 | 実装項目 |
|---|---|
| 画像・メディア | 全画像に`alt`、動画にキャプション・トランスクリプト (1.1.1 / 1.2.*) |
| 言語属性 | `<html lang="ja">`、多言語混在部分に`lang` (3.1.1 / 3.1.2) |
| ページ構造 | `<title>`個別設定、Skip to main、現在位置に`aria-current` (2.4.1 / 2.4.2 / 2.4.8) |
| アニメ抑制 | DS外で追加したアニメーション（ページ遷移・スクロール演出等）に `@media (prefers-reduced-motion: reduce)` を (2.3.3) |
| フォーム | 送信前確認・エラーメッセージはテキストで（色だけに頼らない） (1.4.1 / 3.3.1 / 3.3.3) |
| ステータス通知 | 非同期更新に`role="status"` / `aria-live` (4.1.3) |

## 検証ツール

### 自動チェック

| ツール | 用途 |
|---|---|
| [axe DevTools](https://www.deque.com/axe/devtools/) | ARIA / コントラスト / HTML構造 |
| [Lighthouse (Chrome)](https://developer.chrome.com/docs/lighthouse) | Accessibilityスコア + 詳細指摘 |
| [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) | 個別の色組み合わせ確認 |

### 手動チェック（自動では拾えない）

- **キーボードのみで全操作**: Tab / Shift+Tab / Enter / Space / Esc
- **`prefers-reduced-motion`**: OS設定でアニメーション確認
- **`forced-colors: active`**: Windows実機では未検証。Chrome DevToolsの Rendering パネル →「Emulate CSS media feature forced-colors」で近似確認できる（OSのテーマ色までは再現しない）

## 参考リンク

| リソース | URL |
|---|---|
| WAIC - WCAG 2.2 達成基準（日本語訳） | https://waic.jp/translations/WCAG22/ |
| W3C - WCAG 2.2 原文 | https://www.w3.org/TR/WCAG22/ |
| W3C - WAI-ARIA Authoring Practices | https://www.w3.org/WAI/ARIA/apg/ |

全86基準を1つずつ確認したい場合は、relay-design-system（このDSの参照元、非公開リポジトリ）の
`docs/ACCESSIBILITY.md`がフルバージョンとして手元にある。
