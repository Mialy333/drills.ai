import { marked } from "marked";

export type Lang = "fr" | "en";
export const LANGS: Lang[] = ["fr", "en"];
export type Category = "debug" | "refactor" | "read" | "formats";
export const CATEGORIES: Category[] = ["debug", "refactor", "read", "formats"];

export interface Drill {
  id: string;
  cat: Category;
  order: number;
  minutes: number;
  title: string;
  sourceHtml: string;
  statementHtml: string;
  solutionHtml: string;
}

const files = import.meta.glob("../drills/*/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

marked.setOptions({ gfm: true });

function parse(raw: string): Drill {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Drill file without front matter");
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const i = line.indexOf(": ");
    if (i > 0) meta[line.slice(0, i)] = line.slice(i + 2);
  }
  const [statement, solution = ""] = match[2].split("<!-- solution -->");
  return {
    id: meta.id,
    cat: meta.cat as Category,
    order: Number(meta.order),
    minutes: Number(meta.minutes),
    title: meta.title,
    sourceHtml: marked.parseInline(meta.source) as string,
    statementHtml: marked.parse(statement.trim()) as string,
    solutionHtml: marked.parse(solution.trim()) as string,
  };
}

const byLang: Record<Lang, Drill[]> = { fr: [], en: [] };
for (const [path, raw] of Object.entries(files)) {
  const lang = path.split("/").at(-2) as Lang;
  byLang[lang].push(parse(raw));
}
for (const lang of LANGS) {
  byLang[lang].sort(
    (a, b) => CATEGORIES.indexOf(a.cat) - CATEGORIES.indexOf(b.cat) || a.order - b.order,
  );
}

export function drills(lang: Lang): Drill[] {
  return byLang[lang];
}

export function drill(lang: Lang, id: string): Drill {
  const found = byLang[lang].find((d) => d.id === id);
  if (!found) throw new Error(`Unknown drill ${lang}/${id}`);
  return found;
}

/** Base-aware path: every internal link goes through this. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}
