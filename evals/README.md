# evals — エージェントがDSのルールに従うかを測る回帰スイート

固定のお題（意図レベルのプロンプト）をAIエージェントに解かせ、生成物を採点する。
relay-design-systemのevalsを、このDS（MCP最小構成・コンポーネント10種）の規模に合わせて簡略化したもの。

- お題の正本: [cases.mjs](cases.mjs)
- ランナー: [run.mjs](run.mjs)
- 履歴ビュー: [report.mjs](report.mjs)（テキスト）/ [report-html.mjs](report-html.mjs)（HTML・無料）

## 実行

```sh
npm run eval                       # 全お題（生成 + 機械チェック + LLM審査 = サブスク枠を消費）
npm run eval -- --case invite-form # 1お題のみ
npm run eval -- --skip-generate    # 既存の生成物を再採点（LLM審査のみ消費）
npm run eval -- --skip-judge       # 機械チェックのみ（LLM不使用・無料）
npm run eval -- --votes 3          # 審査3回の多数決（審査員のブレ対策）
npm run eval:report                # 実行履歴の推移表（無料）
npm run eval:report:html           # HTMLレポート（推移 + 最新実行のシーケンス・突合。無料）
```

生成物は `evals/output/*.html`（ブラウザで目視可）、結果は `evals/results/*.json`（いずれもgitignored）。

## 採点

| チェック | 内容 | 判定元 | コスト |
|---|---|---|---|
| hardcode | 生hex/px/独自状態クラス等 | `.claude/hooks/ds-hardcode-gate.mjs` | 無料 |
| classes | 必須クラスの使用/捏造variantの検知 | `src/components/*.css` から動的に読む | 無料 |
| patterns | 必須マークアップ + 全お題共通のa11yチェック | cases.mjsの`mustPatterns` + `COMMON_PATTERNS` | 無料 |
| rubric | コンポーネント選定の適切さ等、機械で測れない判断 | cases.mjsの`rubric`をLLM審査員が判定 | LLM 1〜votes回/お題 |

## 結果の4区分

| status | 意味 | 対処 |
|---|---|---|
| `pass` / `fail` | 採点できた上での合否。**failだけが品質シグナル** | DS側（MCP・DESIGN.md等）を直す |
| `error:generation` | 生成自体が失敗（claude CLI/ハーネスの問題） | ハーネス側を直す。品質劣化と読まない |
| `error:judge` | 機械チェックは通ったが審査員の応答を解析できず判定不能 | 再実行 or 審査員まわりを直す |

## お題の増やし方

relayの方針を踏襲: **机上で発明せず、実運用で実際に起きた失敗を一般化して追加する。**
まだ実運用が無いため、今のお題（5件）はコンポーネントの主要な使い分け判断の最小セット。
実際にClaude Codeから使ってみて、AIが変な部品選定をした場面があればお題化する。

## いつ回すか

- MCP（`src/mcp/`）・DESIGN.md・コンポーネントヘッダを変更したPRの前後（変更の効果測定）
- 定期的に（週1回目安）— モデル更新によるドリフト検知

## 人のレビューの記録先

evalの合否そのものだけでなく、**それを判定しているLLM審査員が信頼できるか**も別途チェックする。
月1回目安で抜き取り監査し、[review-log.md](review-log.md) に記録する。監査時に採点対象だった
HTMLのスナップショットは [audited/](audited/) にコピーして残す（運用はaudited/README.md参照）。
