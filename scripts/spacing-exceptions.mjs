/**
 * 余白の9段スケール（0 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px）の例外。
 * check-consistency.mjs（spacing-scale）と build-spacing-page.mjs（カタログの例外一覧）が読む。
 * 例外を足すときは理由を書く。使われなくなった例外はチェックが検知する。
 */
export const SPACING_SCALE = [0, 1, 2, 3, 4, 6, 8, 12, 16]; // var(--spacing) * N の N

export const SPACING_EXCEPTIONS = [
  { file: "accordion.css", selector: ".accordion-panel", prop: "padding", value: "左 44px（× 11）", reason: "トリガーのアイコン幅＋gap に本文の開始位置を揃える" },
  { file: "tab.css", selector: ".tab", prop: "margin-bottom", value: "-1px", reason: "タブの下線を、タブ列の下枠線に重ねる" },
  { file: "tab.css", selector: '.tab[aria-selected="true"]', prop: "padding-bottom", value: "8px - 3px", reason: "選択時に下線が 1px → 4px に太くなる分を引き、タブの高さを揃える" },
  { file: "stepper.css", selector: ".stepper-step + .stepper-step::before", prop: "top", value: "15px", reason: "32px のマーカーの中心（16px）に 2px の線を通す" },
];
