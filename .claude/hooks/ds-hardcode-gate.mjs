/*
 * design-system hardcode gate — Claude Code PostToolUse hook (Write|Edit)
 *
 * DESIGN.mdのハードコード違反を、人がレビューする前に「書き込んだ直後」に検知して
 * Claudeへ即フィードバックする品質ゲート。検知したらexit 2でstderrの内容が
 * Claudeに返り、その場で修正させる（relay-design-systemの同名hookと同じ設計）。
 *
 * 検査対象: .html / .css / .jsx / .tsx / .vue / .svelte
 * 検査項目:
 *   - 生 hex / rgb() 色（var()・color-mix()・ブランド色コメント行を除く）
 *   - font-size 生 px / 生 var(--text-*)（.typo-* 未使用）
 *   - 祝福外 spacing（var(--spacing) * N, N ∉ {0,1,2,3,4,6,8,12,16}）
 *   - 独自状態クラス is-{selected,active,pressed,current}（ARIA化されているべき）
 *
 * 例外（DESIGN.md準拠）: 第三者ブランド色は同一行のコメントに「ブランド」または
 * "brand" と明記すればスキップされる。background-image の SVG data URI 内の色は
 * 対象外（var()が解決できないため。select.cssのハードコード例外と同じ）。
 *
 * --include <正規表現>（任意）: file_path がマッチするファイルだけを検査する。
 * このリポジトリ自体（src/components/・tokens/）は、コンポーネント内部でスケールを
 * 定義する側であり生px/生hexの言及が正当に発生する（例: button.cssの
 * `.btn-md { font-size: 14px }` はスケール定義そのもの、select.cssのコメントは
 * ハードコード例外の説明）ため、agent生成物・利用者向けコード（preview/等）だけに
 * スコープするのが正しい運用（relay-design-systemと同じ設計）。
 *
 * 導入（.claude/settings.json）:
 *   { "hooks": { "PostToolUse": [ { "matcher": "Write|Edit",
 *     "hooks": [ { "type": "command",
 *       "command": "node .claude/hooks/ds-hardcode-gate.mjs --include \"^(?!src/components/|tokens/).*\"" } ] } ] } }
 */
import { readFileSync } from "node:fs";

const TARGET_EXT = /\.(html|css|jsx|tsx|vue|svelte)$/i;
const BLESSED = new Set(["0", "1", "2", "3", "4", "6", "8", "12", "16"]);

function checkLine(line) {
  const hits = [];
  const skipBrand = /ブランド|brand/i.test(line);
  const skipDataUri = /url\(["']?data:image\/svg/.test(line);
  const skipVar = /var\(/.test(line);
  const colorScan = line
    .replace(/color-mix\([^;]*\)/g, "")
    .replace(/var\([^)]*\)/g, "");

  if (!skipBrand && !skipDataUri && /#[0-9a-fA-F]{3,8}\b|rgba?\([0-9 ,.%/]+\)/.test(colorScan))
    hits.push("生色（hex/rgb直書き）→ var(--color-*) を使う");
  if (/font-size:\s*([0-9]+px|var\(--text-)/.test(line))
    hits.push("font-size 生値 → .typo-{xsmall…3xlarge} クラスを使う");
  for (const m of line.matchAll(/var\(--spacing\)\s*\*\s*([0-9.]+)/g)) {
    if (!BLESSED.has(m[1])) hits.push(`祝福外spacing（* ${m[1]}）→ {0,1,2,3,4,6,8,12,16} の近傍値に丸める`);
  }
  if (/\bis-(selected|active|pressed|current)\b/.test(line))
    hits.push("独自状態クラス → aria-selected/aria-pressed/aria-current/:disabled で表現する");
  return hits;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return 0; // stdinがJSONでない — 邪魔をしない
  }
  const filePath = input?.tool_input?.file_path;
  if (!filePath || !TARGET_EXT.test(filePath)) return 0;

  const includeIdx = process.argv.indexOf("--include");
  if (includeIdx !== -1) {
    const pattern = process.argv[includeIdx + 1];
    try {
      if (!pattern || !new RegExp(pattern).test(filePath)) return 0;
    } catch {
      return 0; // 正規表現が不正 — 邪魔をしない
    }
  }

  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return 0; // 読めない（削除直後等）— 邪魔をしない
  }

  const violations = [];
  content.split("\n").forEach((line, i) => {
    for (const hit of checkLine(line)) {
      violations.push(`${filePath}:${i + 1} — ${hit}\n    ${line.trim().slice(0, 120)}`);
    }
  });

  if (!violations.length) return 0;

  console.error(
    [
      `⛔ design-system hardcode gate: ${filePath} にハードコード違反 ${violations.length} 件。トークン経由に修正してから先に進むこと。`,
      ...violations.slice(0, 20),
      violations.length > 20 ? `…ほか ${violations.length - 20} 件` : "",
      "正当な例外（第三者ブランド色）は同一行のコメントに「ブランド」/ brand と明記する。実値が必要ならMCPのget_tokensを呼ぶ。",
    ].filter(Boolean).join("\n"),
  );
  return 2; // exit 2: stderrがClaudeにフィードバックされる
}

process.exit(main());
