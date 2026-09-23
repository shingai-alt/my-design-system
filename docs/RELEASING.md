# リリース手順

relay-design-systemのdocs/RELEASING.mdを土台にしているが、**今の実態**に合わせて書き換えている。
relayとの違い:

- **npm publishはしない**（`package.json`が`"private": true`）。リリース = SemVerのgitタグ + GitHub Release
- **mainへ直push運用**なので、relayのような release ブランチ → PR → マージ後にタグ、の手順は不要
  （relayはmainが保護ブランチのため、`npm version`のタグをそのまま push すると孤児タグになる問題があった）
- Slack通知・カタログのリリースログ（`releases.json`）は無い

## SemVer 運用ルール

| 種別 | コマンド | 例 | 使うとき |
|---|---|---|---|
| patch | `npm version patch` | 0.1.0 → 0.1.1 | バグ修正 / スタイル微調整 / ドキュメント修正 |
| minor | `npm version minor` | 0.1.0 → 0.2.0 | 後方互換のあるコンポーネント / トークン追加 |
| major | `npm version major` | 0.1.0 → 1.0.0 | トークン名変更 / 既存クラス削除など破壊的変更 |

0.x の間は破壊的変更も minor で出してよい（SemVer の 0.x 慣習）。1.0.0 は「外部から使われ始めた」時点で切る。

## 手順

```bash
# 1) main が最新・作業ツリーがクリーンであることを確認
git status -sb

# 2) 前回タグからの変更を確認（初回はタグが無いので git log --oneline だけでよい）
git log --oneline $(git describe --tags --abbrev=0)..HEAD

# 3) 公開前チェック（下記チェックリスト）

# 4) バージョンを bump。npm version が package.json 更新 + コミット + タグ v0.x.y を作る
npm version minor -m "chore: %s をリリース"    # or patch / major

# 5) 🛑 ユーザーの「push して」を待ってから、コミットとタグを一緒に push
git push origin main --follow-tags

# 6) GitHub Release を作成（本文は 2) の変更点を箇条書きで）
gh release create v0.x.y --title "v0.x.y" --notes "..."
```

push のチェックポイントは通常の開発フローと同じ（[CONTRIBUTING.md](CONTRIBUTING.md)）。
mainは保護されていないので、`--follow-tags` でコミットとタグが同時に届き、孤児タグにはならない。

## 公開前チェックリスト

- [ ] `npm run build` が成功し、`dist/ds.css`・`dist/icons.svg` が生成される
- [ ] `npm run check:consistency` が全項目通過
- [ ] `preview/index.html` をブラウザで開き（[CONTRIBUTING.md](CONTRIBUTING.md) の簡易サーバー手順）、追加 / 変更したコンポーネントが正しく表示される
- [ ] README のコンポーネント一覧が最新（追加した場合）
- [ ] トークンを変更した場合、DESIGN.md のトークン記載も更新済み（正本はコード）

## 失敗 / リカバリ

- タグを push する前に間違いに気づいた: `git tag -d v0.x.y && git reset --hard HEAD~1` でやり直す
- push 済みタグに不具合があった: タグは付け直さず、**新しい patch バージョンを出す**（relayと同じ方針）

## 将来 npm publish する場合

今は不要。外部プロジェクトから `npm install` で使いたくなったら、relayの手順に寄せて以下を足す:

- `package.json` の `"private": true` を外し、`files`（配布物を `dist/` 等に絞る）と `prepublishOnly: "npm run build"` を追加
- チェックリストに `npm pack --dry-run`（配布物に余計なファイルが無いか）を追加
- 手順の 6) の前に `npm publish` を追加
