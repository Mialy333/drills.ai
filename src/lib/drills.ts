import { marked } from "marked";

export type Lang = "fr" | "en";
export const LANGS: Lang[] = ["fr", "en"];

export type Track = "python" | "typescript";
export const TRACKS: Track[] = ["python", "typescript"];
/** Tracks with content today. TypeScript has its door on the welcome screen but no drills yet. */
export const READY_TRACKS: Track[] = ["python"];

export type Category = "debug" | "refactor" | "read" | "formats";
export const CATEGORIES: Category[] = ["debug", "refactor", "read", "formats"];

export interface Drill {
  id: string;
  track: Track;
  cat: Category;
  order: number;
  minutes: number;
  title: string;
  sourceHtml: string;
  statementHtml: string;
  solutionHtml: string;
}

const files = import.meta.glob("../drills/*/*/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

marked.setOptions({ gfm: true });

function parse(raw: string, track: Track): Drill {
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
    track,
    cat: meta.cat as Category,
    order: Number(meta.order),
    minutes: Number(meta.minutes),
    title: meta.title,
    sourceHtml: marked.parseInline(meta.source) as string,
    statementHtml: marked.parse(statement.trim()) as string,
    solutionHtml: marked.parse(solution.trim()) as string,
  };
}

const store = new Map<string, Drill[]>();
for (const [path, raw] of Object.entries(files)) {
  const [track, lang] = path.split("/").slice(-3, -1) as [Track, Lang];
  const key = `${track}/${lang}`;
  if (!store.has(key)) store.set(key, []);
  store.get(key)!.push(parse(raw, track));
}
for (const list of store.values()) {
  list.sort((a, b) => CATEGORIES.indexOf(a.cat) - CATEGORIES.indexOf(b.cat) || a.order - b.order);
}

export function drills(track: Track, lang: Lang): Drill[] {
  return store.get(`${track}/${lang}`) ?? [];
}

export function neighbours(track: Track, lang: Lang, id: string): { prev?: Drill; next?: Drill } {
  const list = drills(track, lang);
  const i = list.findIndex((d) => d.id === id);
  return { prev: list[i - 1], next: list[i + 1] };
}

/** Base-aware path: every internal link goes through this. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}
