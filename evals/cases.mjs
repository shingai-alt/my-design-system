/*
 * evals/cases.mjs — eval のお題定義（正本）
 *
 *   エージェントがこのDesign Systemのルールに従えるかを測る固定のお題。
 *   プロンプトは**意図レベル**で書き、コンポーネント名を含めないこと
 *   （名指しすると「DSが選定を導けているか」を測れなくなる。relay-design-system
 *   のevals/cases.mjsと同じ設計方針）。
 *
 * 各フィールド:
 *   id           — 出力ファイル名（evals/output/<id>.html）
 *   prompt       — エージェントに渡す要件（意図レベル）
 *   mustClasses  — 生成物に必須のDSクラス（機械チェック）
 *   mustPatterns — 生成物に必須の正規表現（機械チェック）
 *   rubric       — LLM審査員の採点項目
 *
 * お題は実運用で実際に起きた失敗を一般化して追加していく（机上で発明しない）。
 * 今はまだ実運用が無いため、コンポーネントの主要な使い分け判断を検証する
 * 最小セットから始める。
 */

export const COMMON_PATTERNS = [
  { pattern: "<html[^>]*\\slang=", label: "html に lang 指定（WCAG 3.1.1）" },
  { pattern: "<img\\b(?![^>]*\\balt=)", forbid: true, label: "alt なしの img（WCAG 1.1.1。装飾なら alt=\"\"）" },
];

export const CASES = [
  {
    id: "invite-form",
    prompt:
      "メンバーを招待するフォームを作ってください。入力項目は、メールアドレス（必須）、役割の選択（管理者・編集者・閲覧者から1つ）、補足メモ（任意）の3つです。",
    mustClasses: ["input", "select", "btn-primary"],
    mustPatterns: [],
    rubric: [
      "役割の選択に select を使っている（自作ドロップダウンではない）",
      "送信ボタンは btn-primary が1つだけ（primaryは1画面1つの原則）",
      "各入力欄にラベルが関連付いている（placeholder だけに頼っていない）",
    ],
  },
  {
    id: "status-table",
    prompt:
      "契約の一覧を確認できる画面を作ってください。各契約について、契約名・取引先・金額と、状態（有効/期限切れ/審査中）が一目で分かるようにしてください。",
    mustClasses: ["data-table", "badge"],
    mustPatterns: [],
    rubric: [
      "一覧に data-table を使っている（table要素の手書きスタイリングではない）",
      "状態表示に badge を使い、状態ごとに意味の合うステータス色を使い分けている（全状態に同じ色を使うのは不可）",
      "金額など数値の桁揃えに配慮している",
    ],
  },
  {
    id: "delete-confirmation",
    prompt:
      "メンバー一覧のページに、メンバーのアカウントを削除する操作を追加してください。誤操作で消えると取り返しがつかないので、削除の前にひと呼吸置けるUIにしてください。",
    mustClasses: ["modal", "btn-negative"],
    mustPatterns: [{ pattern: "<dialog", label: "ネイティブ <dialog> ベース（modal の正本仕様）" }],
    rubric: [
      "確認UIに modal を使っている（alert・独自オーバーレイの手書きではない）",
      "削除の実行ボタンは btn-negative。primary（ブランド緑）を破壊的操作に使っていない",
      "キャンセルの逃げ道が明確にある",
    ],
  },
  {
    id: "settings-tabs",
    prompt:
      "設定画面に、プロフィール・通知・セキュリティの3セクションを行き来できるUIを付けてください。いま自分がどのセクションにいるかが分かるようにしてください。",
    mustClasses: ["tabs", "tab"],
    mustPatterns: [{ pattern: 'aria-selected="true"', label: "現在地は aria-selected（独自 is-* クラスでない）" }],
    rubric: [
      "セクション切り替えに tab を使っている（独自のボタン+ハイライトの手書きではない）",
      "現在地の表現が aria-selected で、is-active 等の独自状態クラスを使っていない",
    ],
  },
  {
    id: "terms-checkbox",
    prompt:
      "利用規約への同意が必須のアカウント登録フォームを作ってください。項目はメールアドレスとパスワード、利用規約への同意チェックです。",
    mustClasses: ["input", "checkbox", "btn-primary"],
    mustPatterns: [],
    rubric: [
      "利用規約への同意に checkbox を使っている",
      "checkboxのラベルがクリック領域に含まれている（checkbox-labelでラップ、またはfor/id関連付け）",
      "送信ボタンは1画面に btn-primary が1つだけ",
    ],
  },
];
