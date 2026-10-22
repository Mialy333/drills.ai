import { marked } from "marked";

export type Lang = "fr" | "en";
export const LANGS: Lang[] = ["fr", "en"];

export type Track = "python" | "typescript";
export const TRACKS: Track[] = ["python", "typescript"];
/** Tracks with content today. TypeScript has its door on the welcome screen but no drills yet. */
export const READY_TRACKS: Track[] = ["python"];

export type Category = "debug" | "refactor" | "read" | "formats";
export const CATEGORIES: Category[] = ["debug", "refactor", "read", "formats"];

type L<T = string> = Record<Lang, T>;

/** Raw shape of src/drills/<track>/qa/<id>.json, written by scripts/build_content.py. */
interface RawQuestion {
  id: string;
  type: "code" | "text" | "choice";
  mode?: "tests";
  prompt: L;
  hints?: L<string[]>;
  // code
  starter?: string;
  tests?: string;
  labels?: Record<string, L>;
  model?: string | L;
  // text
  concepts?: { label: L; any: string[] }[];
  // choice
  options?: L<string[]>;
  answer?: number;
  why?: L;
}

interface RawDrill {
  id: string;
  cat: Category;
  order: number;
  minutes: number;
  title: L;
  source: L;
  context: L;
  mission: L;
  criteria: L<string[]>;
  questions: RawQuestion[];
  explanation: L;
}

/** A question ready for one language: markdown already rendered to HTML. */
export interface Question {
  id: string;
  type: "code" | "text" | "choice";
  mode?: "tests";
  promptHtml: string;
  hintsHtml: string[];
  starter?: string;
  tests?: string;
  labels?: Record<string, string>;
  modelCode?: string;
  modelHtml?: string;
  concepts?: { labelHtml: string; any: string[] }[];
  optionsHtml?: string[];
  answer?: number;
  whyHtml?: string;
}

export interface Drill {
  id: string;
  track: Track;
  cat: Category;
  order: number;
  minutes: number;
  title: string;
  source: string;
  contextHtml: string;
  missionHtml: string;
  criteriaHtml: string[];
  explanationHtml: string;
  questions: Question[];
}

const files = import.meta.glob("../drills/*/qa/*.json", { eager: true, import: "default" }) as Record<string, RawDrill>;

marked.setOptions({ gfm: true });
const md = (s: string) => marked.parse(s ?? "") as string;
const inline = (s: string) => marked.parseInline(s ?? "") as string;

function localise(raw: RawDrill, track: Track, lang: Lang): Drill {
  return {
    id: raw.id,
    track,
    cat: raw.cat,
    order: raw.order,
    minutes: raw.minutes,
    title: raw.title[lang],
    source: raw.source[lang],
    contextHtml: md(raw.context[lang]),
    missionHtml: inline(raw.mission[lang]),
    criteriaHtml: raw.criteria[lang].map(inline),
    explanationHtml: md(raw.explanation?.[lang] ?? ""),
    questions: raw.questions.map((q) => ({
      id: q.id,
      type: q.type,
      mode: q.mode,
      promptHtml: md(q.prompt[lang]),
      hintsHtml: (q.hints?.[lang] ?? []).map(inline),
      starter: q.starter,
      tests: q.tests,
      labels: q.labels ? Object.fromEntries(Object.entries(q.labels).map(([k, v]) => [k, inline(v[lang])])) : undefined,
      modelCode: typeof q.model === "string" ? q.model : undefined,
      modelHtml: q.model && typeof q.model !== "string" ? md(q.model[lang]) : undefined,
      concepts: q.concepts?.map((c) => ({ labelHtml: inline(c.label[lang]), any: c.any })),
      optionsHtml: q.options?.[lang].map(inline),
      answer: q.answer,
      whyHtml: q.why ? inline(q.why[lang]) : undefined,
    })),
  };
}

const store = new Map<string, Drill[]>();
for (const [path, raw] of Object.entries(files)) {
  const track = path.split("/").at(-3) as Track;
  for (const lang of LANGS) {
    const key = `${track}/${lang}`;
    if (!store.has(key)) store.set(key, []);
    store.get(key)!.push(localise(raw, track, lang));
  }
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
