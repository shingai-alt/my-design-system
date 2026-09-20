/*
 * evals/status.mjs — eval結果の失敗分類（run.mjs / report.mjs共用）
 *
 *   PASS/FAILの2値では「品質の失敗」と「測定側の故障」が同じ✗に潰れ、
 *   スコアの劣化が本物かどうか判別できない。結果1件を次の4区分に分類する
 *   （relay-design-systemのevals/status.mjsと同じ設計）:
 *
 *   pass             — 採点して合格
 *   fail             — 採点して不合格（品質の問題。DS側の改善対象）
 *   error:generation — 生成自体が失敗（claude CLI/ハーネスの問題。品質シグナルではない）
 *   error:judge      — 機械チェックは通ったがLLM審査員の応答を解析できず判定不能。
 *                      機械チェックが落ちていればfail扱い
 */

export const STATUS_SYMBOL = {
  pass: "✓",
  fail: "✗",
  "error:generation": "G",
  "error:judge": "J",
};

export function classifyResult(r) {
  if (r.status) return r.status;
  if (r.generated === false) return "error:generation";
  const machineFail = [r.hardcode, r.classes, r.patterns].some((c) => c && c.pass === false);
  if (r.rubric?.error && !machineFail) return "error:judge";
  return r.pass ? "pass" : "fail";
}

export function isError(status) {
  return status.startsWith("error:");
}
