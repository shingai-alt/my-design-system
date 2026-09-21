# audited — 監査済み判定の生成物スナップショット（コミット対象）

[review-log.md](../review-log.md) の監査記録の各行から参照される、**監査時に採点対象だった HTML** のコピー。
relay-design-system の evals/audited と同じ運用（このDSはGitHub Pagesにこのディレクトリを
同梱していないため、リンクはリポジトリ内でファイルを直接開く前提）。

## 運用

- 監査を記録したら、その判定が見ていた HTML を `evals/results/outputs/<実行スタンプ>/<お題>.html`
  （アーカイブ）からここへ `<監査日>-<お題>.html` の名前でコピーし、review-log.md の行からリンクする
- 固有名詞・実在の人名等のダミーデータが混ざっていないか確認し、あれば架空の値に置換して
  review-log.md の「置換の注記」に残す
- ファイルは `./ds.css` を参照する（`npm run eval:report:html` がレポート表示用に配布CSSを
  アーカイブへコピーするのと同じ理由。手動で開く場合は `cp dist/ds.css evals/audited/` する）
