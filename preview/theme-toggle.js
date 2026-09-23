// カタログのテーマ切り替え（ライト → ダーク → OS に追従 の順に切り替わる）。
// <head> で同期実行し、描画前に data-color-mode を付けてちらつきを防ぐ。
(() => {
  const MODES = ["light", "dark", "auto"];
  const LABELS = { light: "ライト", dark: "ダーク", auto: "OS に追従" };
  const KEY = "ds-color-mode";

  const read = () => {
    try { return MODES.includes(localStorage.getItem(KEY)) ? localStorage.getItem(KEY) : "light"; } catch { return "light"; }
  };
  const apply = (mode) => document.documentElement.setAttribute("data-color-mode", mode);

  let current = read();
  apply(current);

  document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".catalog-header");
    if (!header) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm btn-neutral btn-outline";
    const render = (mode) => { button.textContent = `テーマ: ${LABELS[mode]}`; };
    render(current);
    button.addEventListener("click", () => {
      current = MODES[(MODES.indexOf(current) + 1) % MODES.length];
      try { localStorage.setItem(KEY, current); } catch {}
      apply(current);
      render(current);
    });
    header.append(button);
  });
})();
