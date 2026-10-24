export type Lang = "fr" | "en";
export const LANGS: Lang[] = ["fr", "en"];

export type Track = "python" | "typescript";
export const TRACKS: Track[] = ["python", "typescript"];
/** Python practice is generated from a learner's diagnostic or target job posting. */
export const READY_TRACKS: Track[] = ["python"];

export type Category = "debug" | "refactor" | "read" | "formats";
export const CATEGORIES: Category[] = ["debug", "refactor", "read", "formats"];

/** The public build contains no creator-specific static drill catalog. */
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

export function drills(_track: Track, _lang: Lang): Drill[] {
  return [];
}

export function neighbours(track: Track, lang: Lang, id: string): { prev?: Drill; next?: Drill } {
  const list = drills(track, lang);
  const index = list.findIndex((drill) => drill.id === id);
  return { prev: list[index - 1], next: list[index + 1] };
}

/** Base-aware path: every internal link goes through this. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}${path}`;
}
