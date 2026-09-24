/**
 * Design System — MCP handlers（最小構成）
 *
 *   Tool/resourceロジック本体。server.mjs（stdio transport）から呼ばれる。
 *   正本は既存ファイルそのもの（src/components/*.css のヘッダコメント、
 *   tokens/*.css、DESIGN.md）— ここで値を再定義せず、読んで返すだけにする。
 *   二重管理を避けるための設計（relay-design-systemのMCPと同じ思想）。
 *
 *   ファイルの読み方だけは transport ごとに違うので、createHandlers(read) で受け取る。
 *     stdio（server.mjs）   — read = ディスクから読む（DSを直すと即反映）
 *     Workers（worker.mjs） — read = ビルド時に固めた dist/mcp-files.json から引く
 *   read(相対パス) は文字列、無ければ null を返す。読むファイルは SOURCE_FILES が全部。
 */

const COMPONENT_NAMES = [
  "button", "icon-button", "label-control", "input", "textarea", "search-input",
  "select", "selector", "checkbox", "radio", "badge", "card", "data-table", "alert", "modal",
  "tab", "switch", "accordion", "tooltip", "link", "breadcrumb", "menu",
  "pagination", "stepper", "page-shell", "simple-table", "filter-chip", "icon",
];

const TOKEN_CATEGORIES = ["colors", "spacing", "typography", "radius", "shadow", "container"];

export const SOURCE_FILES = [
  "package.json",
  "DESIGN.md",
  "src/index.css",
  ...COMPONENT_NAMES.map((n) => `src/components/${n}.css`),
  ...TOKEN_CATEGORIES.map((c) => `tokens/${c}.css`),
];

export function createHandlers(read) {
  const { version } = JSON.parse(read("package.json"));
  const SERVER_INFO = { name: "design-system-mcp", version };

  // ds.css に入っている utility は src/index.css の safelist だけ（source(none) のため）。
  // 正本の @source inline 行をそのまま返し、一覧を二重管理しない。
  // primary-600 などの色スケールは safelist にはあるが使用禁止なので除く。
  const indexCss = read("src/index.css");
  const LAYOUT_UTILITIES = [...indexCss.matchAll(/@source inline\("([^"]+)"\)/g)]
    .map((m) => m[1])
    .filter((u) => !u.includes("-{50,"));

  const INSTRUCTIONS = `
このMCPは自社デザインシステムのトークン・コンポーネント仕様・非交渉原則をAIエージェントに渡すためのものです。
UIを生成する前に、まず get_design_principles を呼んで原則を把握し、使う部品ごとに get_component で完全仕様（使用法OK/NG・アクセシビリティ・Usage例）を取得してください。
色・余白・角丸などの値は get_tokens で取得し、絶対にハードコード（生hex・生px）しないでください。
色は semantic トークン（--color-bg-* / --color-fg-* / --color-stroke-*）を使い、primary-600 などのスケールを直接使わないでください（ダークモードに追従しなくなります）。
文字は font: var(--typo-*)（HTML では .typo-* クラス）で指定し、font-size: 14px などを直書きしないでください。
余白は p-{0,1,2,3,4,6,8,12,16} の9段だけを使い、部品の高さは既存コンポーネントのサイズ（sm / md / lg）に合わせてください。
フォーカスリングは outline: var(--focus-outline) で描き、box-shadow で描かないでください。
ds.css を読み込むだけの環境では Tailwind の utility は全部は使えません。使えるのはコンポーネントのクラスと、次の utility だけです（{a,b} は展開して読む）。ここに無い utility やインライン style でレイアウトしないでください:
${LAYOUT_UTILITIES.map((u) => `- ${u}`).join("\n")}
  `.trim();

  const TOOLS = [
    {
      name: "get_component",
      description:
        "指定コンポーネントの完全仕様を返す（機能・使用法OK/NG・アクセシビリティ・Usage例）。UIを組む前に必ず呼ぶ。",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", enum: COMPONENT_NAMES, description: "コンポーネント名" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
    {
      name: "get_tokens",
      description:
        "デザイントークン（色・余白・タイポ・角丸・影・コンテナ幅）を返す。category省略で全件。色や余白を推測でハードコードせず、必ずここから値を取る。",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string", enum: TOKEN_CATEGORIES, description: "省略で全カテゴリ" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "get_design_principles",
      description:
        "デザイン原則・非交渉原則（ハードコード禁止等）・禁止パターン要約を返す。コード生成前のガードに使う。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];

  function readComponentCss(name) {
    return COMPONENT_NAMES.includes(name) ? read(`src/components/${name}.css`) : null;
  }

  /** ファイル先頭の /* ... *\/ ヘッダコメント（仕様の正本）だけを抜き出し、
   *  各行先頭の " * " 装飾を取り除いて読みやすくする */
  function extractHeaderComment(css) {
    const match = css.match(/^\/\*([\s\S]*?)\*\//);
    const body = match ? match[1] : css;
    return body
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, ""))
      .join("\n")
      .trim();
  }

  function formatComponent(name) {
    const css = readComponentCss(name);
    if (!css) {
      return {
        text: `コンポーネント "${name}" は存在しません。利用可能: ${COMPONENT_NAMES.join(", ")}`,
        isError: true,
      };
    }
    return { text: `# ${name}\n\n${extractHeaderComment(css)}` };
  }

  function formatTokens(category) {
    const cats = category ? [category] : TOKEN_CATEGORIES;
    const parts = cats.map((c) => {
      const css = read(`tokens/${c}.css`);
      if (css === null) return `## ${c}\n（ファイルが見つかりません）`;
      return `## ${c}\n\n${css.trim()}`;
    });
    return { text: parts.join("\n\n---\n\n") };
  }

  function formatDesignPrinciples() {
    const md = read("DESIGN.md");

    const slice = (startMarker, endMarker) => {
      const start = md.indexOf(startMarker);
      if (start === -1) return "";
      const end = endMarker ? md.indexOf(endMarker, start) : md.length;
      return md.slice(start, end === -1 ? md.length : end).trim();
    };

    const principles = slice("## デザイン原則", "## Quick Reference");
    const prohibited = slice("### 禁止パターン要約", "## グローバル設定");

    return { text: `${principles}\n\n${prohibited}`.trim() };
  }

  /**
   * Run a tool. Returns { text, isError? } — transports wrap this into their own
   * content envelope.
   */
  function callTool(name, args = {}) {
    switch (name) {
      case "get_component":
        return formatComponent(args.name);
      case "get_tokens":
        return formatTokens(args.category);
      case "get_design_principles":
        return formatDesignPrinciples();
      default:
        return { text: `不明なツール: ${name}`, isError: true };
    }
  }

  return { SERVER_INFO, INSTRUCTIONS, TOOLS, callTool };
}
