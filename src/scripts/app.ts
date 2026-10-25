// Everything interactive lives here: theme, progress, timer, attempts, journal, offline.
// State is kept in localStorage only; every access is guarded because storage can be
// missing (private windows) or full.

import { compute, streakDisplay, type CatalogEntry, type GameState } from "../lib/game";
import { initializeCompanionPanels } from "./companion";

type Attempt = {
  v: 2;
  track: string;
  id: string;
  date: string; // ISO timestamp
  seconds: number;
  scores: number[]; // 4 criteria, 0 to 2
  total: number; // 0 to 8
  withSolution: boolean;
  completeness?: number; // 0 to 1, share of deliverables fully right
  hints?: number;
  proof: string;
  stuck: string;
};

const KEYS = { theme: "drills.theme", lang: "drills.lang", journal: "drills.journal" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the app still works, it just forgets on reload.
  }
}

function revealedKeys(): string[] {
  const value = read<unknown>("drills.revealed", []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Accepts version-1 entries (Python only, score capped when the solution was opened). */
function normalise(x: unknown): Attempt | null {
  const e = x as Record<string, unknown>;
  if (!e || typeof e.id !== "string" || typeof e.date !== "string" || typeof e.total !== "number") return null;
  return {
    v: 2,
    track: typeof e.track === "string" ? e.track : "python",
    id: e.id,
    date: e.date,
    seconds: typeof e.seconds === "number" ? e.seconds : 0,
    scores: Array.isArray(e.scores) ? (e.scores as number[]) : [],
    total: e.total,
    withSolution: Boolean(e.withSolution ?? e.revealed),
    completeness: typeof e.completeness === "number" ? e.completeness : undefined,
    hints: typeof e.hints === "number" ? e.hints : undefined,
    proof: typeof e.proof === "string" ? e.proof : "",
    stuck: typeof e.stuck === "string" ? e.stuck : "",
  };
}

function journal(): Attempt[] {
  return read<unknown[]>(KEYS.journal, []).map(normalise).filter((a): a is Attempt => a !== null);
}

const saveJournal = (all: Attempt[]) => write(KEYS.journal, all);
const keyOf = (a: { track: string; id: string }) => `${a.track}:${a.id}`;
const attemptsFor = (track: string, id: string) =>
  journal().filter((a) => a.track === track && a.id === id).sort((a, b) => a.date.localeCompare(b.date));
const isAcquired = (list: Attempt[]) => list.some((a) => a.total >= 7 && !a.withSolution);

function strings<T>(el: HTMLElement | null): T {
  return JSON.parse(el?.dataset.strings ?? "{}") as T;
}

function toast(message: string): void {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-shown");
  window.setTimeout(() => el.classList.remove("is-shown"), 2600);
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const lang = document.body.dataset.lang ?? "fr";
const base = document.body.dataset.base ?? "/";
const shortDate = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/* ---------- theme and language ---------- */

function setupTheme(): void {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const s = strings<{ toDark: string; toLight: string }>(document.body);
  const label = button.querySelector(".theme-label");
  const sync = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    if (label) label.textContent = dark ? s.toLight : s.toDark;
    button.setAttribute("aria-label", dark ? s.toLight : s.toDark);
  };
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEYS.theme, next);
    } catch {}
    sync();
  });
  sync();
}

function rememberLang(): void {
  try {
    localStorage.setItem(KEYS.lang, lang);
  } catch {}
}

/* ---------- progress shown in lists, cards and the start button ---------- */

function paintProgress(): void {
  paintHud();
  const s = strings<{ acquired: string; tried: string }>(document.body);
  const groups = new Map<string, Attempt[]>();
  for (const a of journal()) groups.set(keyOf(a), [...(groups.get(keyOf(a)) ?? []), a]);

  document.querySelectorAll<HTMLElement>("[data-status-for]").forEach((el) => {
    const list = groups.get(el.dataset.statusFor ?? "");
    el.className = "side-status";
    el.textContent = "";
    if (!list) return;
    const acquired = isAcquired(list);
    el.classList.add(acquired ? "is-acquired" : "is-tried");
    el.textContent = acquired ? s.acquired : s.tried;
  });

  document.querySelectorAll<HTMLElement>("[data-track-card]").forEach((card) => {
    const track = card.dataset.trackCard!;
    const total = Number(card.dataset.total);
    let done = 0;
    let touched = false;
    for (const [k, list] of groups) {
      if (!k.startsWith(`${track}:`)) continue;
      touched = true;
      if (isAcquired(list)) done += 1;
    }
    const count = card.querySelector(".track-count");
    const meter = card.querySelector<HTMLElement>(".track-meter span");
    if (count) count.textContent = touched ? card.dataset.progressTemplate!.replace("{n}", String(done)) : card.dataset.empty!;
    if (meter) meter.style.width = `${(done / total) * 100}%`;
  });

  const begin = document.getElementById("begin") as HTMLAnchorElement | null;
  if (begin) {
    const order = JSON.parse(begin.dataset.order!) as string[];
    const track = document.body.dataset.track!;
    const anyAttempt = order.some((id) => groups.has(`${track}:${id}`));
    const nextId = order.find((id) => !isAcquired(groups.get(`${track}:${id}`) ?? []));
    if (!anyAttempt) return;
    if (nextId) {
      begin.href = `${begin.dataset.basePath}${nextId}/`;
      begin.textContent = begin.dataset.resume!.replace("{id}", nextId.toUpperCase());
    } else {
      begin.textContent = begin.dataset.done!;
    }
  }
}


/* ---------- game: XP, levels, streaks, badges, effects ---------- */

type GameData = {
  catalog: CatalogEntry[];
  badges: Record<string, { icon: string; tier: string; name: string; how: string }>;
  levels: string[];
};
const gameData = JSON.parse(document.getElementById("game-data")?.textContent ?? "null") as GameData | null;
const layoutStrings = strings<Record<string, string>>(document.body);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function gameState(): GameState | null {
  return gameData ? compute(journal(), gameData.catalog) : null;
}

function paintHud(): void {
  const hud = document.getElementById("hud");
  const g = gameState();
  if (!hud || !g) return;
  hud.hidden = g.attempts === 0;
  hud.querySelector("[data-hud-level]")!.textContent = layoutStrings.hudLevel.replace("{n}", String(g.levelIndex + 1));
  (hud.querySelector("[data-hud-bar]") as HTMLElement).style.width = `${Math.round(g.levelProgress * 100)}%`;
  const streak = hud.querySelector<HTMLElement>("[data-hud-streak]")!;
  streak.textContent = g.streak ? layoutStrings.hudStreak.replace("{n}", String(g.streak)) : "";
  streak.hidden = !g.streak;
  hud.title = `${g.xp} XP`;
}

/** Phosphor confetti from a point on screen. */
function confetti(x: number, y: number, count = 28): void {
  const layer = document.getElementById("fx");
  if (!layer || reducedMotion()) return;
  const colors = ["var(--accent)", "var(--ok)", "var(--warn)", "var(--link)"];
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("span");
    bit.className = i % 3 ? "fx-bit" : "fx-bit is-square";
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 140;
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    bit.style.setProperty("--dy", `${Math.sin(angle) * dist - 60}px`);
    bit.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    bit.style.animationDelay = `${Math.random() * 80}ms`;
    layer.append(bit);
    window.setTimeout(() => bit.remove(), 1400);
  }
}

/** A short text that rises from an element: "+80 XP", "✓". */
function floater(el: Element | null, text: string, big = false): void {
  const layer = document.getElementById("fx");
  if (!el || !layer) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement("span");
  f.className = big ? "fx-float is-big" : "fx-float";
  f.textContent = text;
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.top}px`;
  layer.append(f);
  window.setTimeout(() => f.remove(), 1600);
}

const centre = (el: Element | null) => {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 120) } : { x: innerWidth / 2, y: innerHeight / 3 };
};

/** Announces badges and levels not shown yet, one card at a time. */
const unlockQueue: { kind: string; icon: string; name: string; how: string }[] = [];
function showNextUnlock(): void {
  const box = document.getElementById("unlock");
  const next = unlockQueue.shift();
  if (!box) return;
  if (!next) {
    box.hidden = true;
    return;
  }
  box.querySelector(".unlock-kind")!.textContent = next.kind;
  box.querySelector(".unlock-icon")!.textContent = next.icon;
  box.querySelector(".unlock-name")!.textContent = next.name;
  box.querySelector(".unlock-how")!.textContent = next.how;
  box.hidden = false;
  box.classList.remove("is-in");
  void box.offsetWidth;
  box.classList.add("is-in");
  const c = centre(box.querySelector(".unlock-card"));
  confetti(c.x, c.y, 36);
  (box.querySelector(".unlock-close") as HTMLButtonElement).focus({ preventScroll: true });
}

function announce(): void {
  const g = gameState();
  if (!g || !gameData) return;
  const seen = read<string[] | null>("drills.badges.seen", null);
  const seenLevel = read<number | null>("drills.level.seen", null);
  const fresh = g.badges.filter((b) => !(seen ?? []).includes(b));
  const wasEmpty = unlockQueue.length === 0;
  if (seenLevel !== null && g.levelIndex > seenLevel) {
    unlockQueue.push({ kind: layoutStrings.levelUp, icon: String(g.levelIndex + 1), name: g.level.name[lang as "fr" | "en"], how: `${g.xp} XP` });
  }
  for (const id of fresh) {
    const b = gameData.badges[id];
    unlockQueue.push({ kind: layoutStrings.badgeUnlocked, icon: b.icon, name: b.name, how: b.how });
  }
  write("drills.badges.seen", g.badges);
  write("drills.level.seen", g.levelIndex);
  if (wasEmpty && unlockQueue.length) showNextUnlock();
}

function setupUnlock(): void {
  const box = document.getElementById("unlock");
  if (!box) return;
  box.querySelector(".unlock-close")!.addEventListener("click", showNextUnlock);
  box.addEventListener("click", (e) => {
    if (e.target === box) showNextUnlock();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !box.hidden) showNextUnlock();
  });
}

/* ---------- current week in the plan ---------- */

function markCurrentWeek(): void {
  const weeks = [...document.querySelectorAll<HTMLElement>("[data-week]")];
  if (!weeks.length) return;
  const now = Date.now();
  const start = (el: HTMLElement) => new Date(`${el.dataset.week}T00:00:00`).getTime();
  const current =
    weeks.find((w) => now >= start(w) && now < start(w) + 7 * 86_400_000) ?? (now < start(weeks[0]) ? weeks[0] : undefined);
  current?.classList.add("is-now");
}

/* ---------- drill page ---------- */

type DrillStrings = {
  attempt: string;
  best: string;
  withSolution: string;
  acquired: string;
  notYet: string;
  saved: string;
  reveal: string;
  hide: string;
  timer: Record<"start" | "pause" | "resume" | "reset", string>;
  timerState: Record<"idle" | "running" | "over" | "twice", string>;
  validate: string;
  runTests: string;
  running: string;
  loadingPy: string;
  pyFailed: string;
  timeoutMsg: string;
  answerError: string;
  testsScore: string;
  conceptsScore: string;
  missingConcept: string;
  right: string;
  wrong: string;
  hintOf: string;
  hintsUsed: string;
  untouched: string;
};

type TestResult = { error: string | null; tests: { name: string; ok: boolean; msg?: string }[] };

/** One Python worker for the page; recreated if an answer runs too long. */
class PythonRunner {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, (r: TestResult) => void>();
  constructor(private base: string) {}

  private ensure(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL("./py-worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent) => {
        const { id, result } = e.data ?? {};
        const done = this.pending.get(id);
        if (done) {
          this.pending.delete(id);
          done(result);
        }
      };
    }
    return this.worker;
  }

  run(code: string, tests: string, timeoutMs = 10_000): Promise<TestResult | "timeout"> {
    const worker = this.ensure();
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        worker.terminate();
        this.worker = null;
        resolve("timeout");
      }, timeoutMs);
      this.pending.set(id, (r) => {
        window.clearTimeout(timer);
        resolve(r);
      });
      worker.postMessage({ id, base: this.base, code, tests });
    });
  }
}

/** Lower case, no accents, straight apostrophes: what the concept patterns expect. */
const fold = (s: string) =>
  s.replace(/’/g, "'").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Draft = { answers: Record<string, string>; scores: Record<string, number>; hints: Record<string, number>; elapsed?: number };

interface DynamicDrillData {
  output_language?: "fr" | "en";
  drill_id: string;
  family: "Debugging" | "Refactoring" | "Code reading";
  title: string;
  context: string;
  mission: string;
  broken_code: string;
  fixed_solution: string;
  hidden_test_harness: string;
  multiple_choice: { question: string; options: string[]; correct_answer_index: number; reasoning: string };
  model_answer_ideas: string[];
};

function isDynamicDrillData(value: unknown): value is DynamicDrillData {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<DynamicDrillData>;
  return (d.output_language === undefined || d.output_language === "fr" || d.output_language === "en") &&
    typeof d.drill_id === "string" &&
    (d.family === "Debugging" || d.family === "Refactoring" || d.family === "Code reading") &&
    typeof d.title === "string" &&
    typeof d.context === "string" && typeof d.mission === "string" &&
    typeof d.broken_code === "string" && typeof d.fixed_solution === "string" &&
    typeof d.hidden_test_harness === "string" && d.hidden_test_harness.trim().length > 0 && Array.isArray(d.model_answer_ideas) &&
    d.model_answer_ideas.length > 0 && d.model_answer_ideas.length <= 5 &&
    d.model_answer_ideas.every((idea) => typeof idea === "string") &&
    !!d.multiple_choice && typeof d.multiple_choice.question === "string" &&
    Array.isArray(d.multiple_choice.options) && d.multiple_choice.options.length > 0 &&
    Number.isInteger(d.multiple_choice.correct_answer_index) &&
    d.multiple_choice.correct_answer_index >= 0 &&
    d.multiple_choice.correct_answer_index < d.multiple_choice.options.length &&
    d.multiple_choice.options.every((option) => typeof option === "string");
}

/** Hydrate the static dynamic-job shell before the standard drill game loop binds its handlers. */
function mountDynamicJob(article: HTMLElement): boolean {
  if (article.dataset.dynamic !== "true") return true;
  const isFrench = document.documentElement.lang === "fr";
  const dynamicDrillStorageKey = `DRILLS_DYNAMIC_JOB_DATA_${document.documentElement.lang.toUpperCase()}`;
  let raw: string | null = null;
  try { raw = localStorage.getItem(dynamicDrillStorageKey); } catch {}
  let data: unknown;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!isDynamicDrillData(data) || (data.output_language && data.output_language !== (isFrench ? "fr" : "en"))) {
    const prompt = document.createElement("p");
    prompt.className = "note is-error";
    prompt.textContent = isFrench
      ? "Aucun exercice personnalisé n'a encore été créé en français."
      : "No tailored exercise has been created in English yet.";
    const link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = `${document.body.dataset.base ?? "/"}${document.body.dataset.lang ?? "en"}/generate/`;
    link.textContent = isFrench ? "Préparer une offre d'emploi" : "Prepare for a job posting";
    prompt.append(document.createTextNode(" "), link);
    article.querySelector(".brief")?.prepend(prompt);
    return false;
  }

  const text = (selector: string, value: string) => {
    const node = article.querySelector<HTMLElement>(selector);
    if (node) node.textContent = value;
  };
  // Give each generated/sample payload its own draft so an old exercise timer
  // cannot leak into a newly opened drill that reuses the dynamic-job route.
  article.dataset.contentId = data.drill_id;
  text(".drill-head h1", data.title);
  const category = article.querySelector<HTMLElement>(".drill-head .drill-cat");
  if (category) {
    const attemptTag = category.querySelector("#attempt-tag");
    const family = isFrench
      ? ({ Debugging: "Débogage", Refactoring: "Refactorisation", "Code reading": "Lecture de code" } as const)[data.family]
      : data.family;
    category.replaceChildren(document.createTextNode(`${family}, DYNAMIC `));
    if (attemptTag) category.append(attemptTag);
  }
  text(".brief .prose", data.context);
  text(".brief .mission", data.mission);
  const source = article.querySelector<HTMLElement>(".drill-meta div:nth-child(2) dd");
  if (source) source.textContent = isFrench ? "Généré par l'IA" : "AI generated";
  const criteria = article.querySelector(".criteria-list");
  if (criteria) criteria.replaceChildren();
  const solutionContent = article.querySelector<HTMLElement>(".solution #solution-body .prose");
  if (solutionContent) {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = data.fixed_solution;
    pre.append(code);
    solutionContent.replaceChildren(pre);
  }
  article.dataset.minutes = "15";
  if (gameData && !gameData.catalog.some((entry) => entry.track === "python" && entry.id === "dynamic-job")) {
    gameData.catalog.push({ id: "dynamic-job", cat: "debug", minutes: 15, track: "python" });
  }

  const questions = article.querySelector<HTMLElement>(".deliverables");
  if (!questions) return false;
  questions.querySelectorAll("article.q").forEach((q) => q.remove());
  const s = strings<DrillStrings>(article);
  const addQuestion = (index: number, kind: "code" | "choice" | "text", prompt: string) => {
    const q = document.createElement("article");
    q.className = `q q-${kind}`;
    q.dataset.qid = `q${index}`;
    q.dataset.type = kind;
    const head = document.createElement("header");
    head.className = "q-head";
    const title = document.createElement("h3");
    title.textContent = `${isFrench ? "Livrable" : "Deliverable"} ${index}`;
    const score = document.createElement("span");
    score.className = "q-score";
    score.dataset.qScore = "";
    head.append(title, score);
    const promptNode = document.createElement("div");
    promptNode.className = "prose q-prompt";
    promptNode.textContent = prompt;
    q.append(head, promptNode);
    // setupDrill expects a hint list on every question, even when generated drills
    // do not provide curated hints. Keeping the empty list prevents boot-time crashes.
    const hints = document.createElement("ol");
    hints.className = "q-hints";
    hints.dataset.hints = "";
    hints.hidden = true;
    q.append(hints);
    return q;
  };
  const addCheck = (q: HTMLElement, label: string) => {
    const actions = document.createElement("div");
    actions.className = "q-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary";
    button.dataset.check = "";
    button.textContent = label;
    actions.append(button);
    const feedback = document.createElement("div");
    feedback.className = "q-feedback";
    feedback.dataset.feedback = "";
    feedback.setAttribute("aria-live", "polite");
    q.append(actions, feedback);
  };
  const code = addQuestion(1, "code", isFrench
    ? "Corrige le code Python, puis lance les tests cachés."
    : "Repair the Python implementation, then run the hidden tests.");
  const codeArea = document.createElement("textarea");
  codeArea.id = "a-q1";
  codeArea.className = "code-input";
  codeArea.dataset.answer = "";
  codeArea.dataset.starter = data.broken_code;
  codeArea.value = data.broken_code;
  codeArea.spellcheck = false;
  codeArea.rows = Math.max(8, data.broken_code.split("\n").length + 2);
  code.append(codeArea);
  const tests = document.createElement("script");
  tests.type = "application/json";
  tests.dataset.tests = "";
  const harness = /\bdef\s+test_[A-Za-z0-9_]*\s*\(/.test(data.hidden_test_harness)
    ? data.hidden_test_harness
    : `def test_generated():\n${data.hidden_test_harness.split("\n").map((line) => `    ${line}`).join("\n")}`;
  tests.textContent = JSON.stringify({ tests: harness, labels: {} });
  code.append(tests);
  addCheck(code, s.runTests);
  questions.insertBefore(code, questions.querySelector(".note"));

  const choice = addQuestion(2, "choice", data.multiple_choice.question);
  const fieldset = document.createElement("fieldset");
  fieldset.className = "options";
  fieldset.dataset.answerChoice = "";
  const choiceOrder = data.multiple_choice.options.map((_, index) => index);
  for (let index = choiceOrder.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [choiceOrder[index], choiceOrder[swapIndex]] = [choiceOrder[swapIndex], choiceOrder[index]];
  }
  if (choiceOrder[0] === data.multiple_choice.correct_answer_index && choiceOrder.length > 1) {
    [choiceOrder[0], choiceOrder[1]] = [choiceOrder[1], choiceOrder[0]];
  }
  fieldset.dataset.correct = String(choiceOrder.indexOf(data.multiple_choice.correct_answer_index));
  choiceOrder.forEach((originalIndex, displayIndex) => {
    const option = data.multiple_choice.options[originalIndex];
    const label = document.createElement("label");
    label.className = "option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "a-q2";
    radio.value = String(displayIndex);
    const span = document.createElement("span");
    span.textContent = option;
    label.append(radio, span);
    fieldset.append(label);
  });
  choice.append(fieldset);
  const modelChoice = document.createElement("div");
  modelChoice.className = "q-model";
  modelChoice.dataset.model = "";
  modelChoice.hidden = true;
  const why = document.createElement("p");
  why.textContent = data.multiple_choice.reasoning;
  modelChoice.append(why);
  choice.append(modelChoice);
  addCheck(choice, s.validate);
  questions.insertBefore(choice, questions.querySelector(".note"));

  const written = addQuestion(3, "text", isFrench
    ? "Explique la correction technique en intégrant les idées clés de l'exercice."
    : "Explain the technical fix. Include the key ideas listed by the generated drill.");
  const answer = document.createElement("textarea");
  answer.id = "a-q3";
  answer.className = "text-input";
  answer.dataset.answer = "";
  answer.rows = 5;
  answer.placeholder = s.validate;
  written.append(answer);
  const concepts = document.createElement("script");
  concepts.type = "application/json";
  concepts.dataset.concepts = "";
  concepts.textContent = JSON.stringify(data.model_answer_ideas.map((idea) => ({
    label: idea,
    any: [idea.trim().split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+")],
  })));
  written.append(concepts);
  addCheck(written, s.validate);
  questions.insertBefore(written, questions.querySelector(".note"));
  return true;
}

function setupDrill(): void {
  const article = document.querySelector<HTMLElement>("article.drill");
  if (!article) return;
  if (!mountDynamicJob(article)) return;
  const id = article.dataset.drill!;
  const track = article.dataset.track!;
  const target = Number(article.dataset.minutes) * 60;
  const s = strings<DrillStrings>(article);
  const draftKey = `drills.draft.${track}:${id}` + (article.dataset.dynamic === "true" ? `:${article.dataset.contentId ?? "dynamic"}` : "");
  const runner = new PythonRunner(base);
  const questions = [...article.querySelectorAll<HTMLElement>(".q")];
  const storedDraft = read<Partial<Draft> | null>(draftKey, null);
  // Older or partially written drafts must never prevent the rest of the page
  // from binding its controls. Normalize each field before setup continues.
  let draft: Draft = {
    answers: storedDraft?.answers && typeof storedDraft.answers === "object" && !Array.isArray(storedDraft.answers) ? storedDraft.answers : {},
    scores: storedDraft?.scores && typeof storedDraft.scores === "object" && !Array.isArray(storedDraft.scores) ? storedDraft.scores : {},
    hints: storedDraft?.hints && typeof storedDraft.hints === "object" && !Array.isArray(storedDraft.hints) ? storedDraft.hints : {},
    elapsed: typeof storedDraft?.elapsed === "number" && Number.isFinite(storedDraft.elapsed) && storedDraft.elapsed >= 0 ? storedDraft.elapsed : 0,
  };
  const saveDraft = () => write(draftKey, draft);

  // ----- timer: starts by itself at the first answer -----
  const display = document.getElementById("timer-display")!;
  const state = document.getElementById("timer-state")!;
  const bar = document.getElementById("timer-bar")!;
  const toggle = document.getElementById("timer-toggle") as HTMLButtonElement;
  const crt = article.querySelector<HTMLElement>(".crt")!;
  // Time already spent survives a reload: it is kept in the draft, paused.
  let elapsed = draft.elapsed ?? 0;
  let startedAt = 0;
  let ticking: number | undefined;
  let overAnnounced = elapsed > target;
  let lastSaved = 0;

  const seconds = () => elapsed + (ticking ? Math.floor((Date.now() - startedAt) / 1000) : 0);
  const paintTimer = () => {
    const sec = seconds();
    display.textContent = clock(sec);
    bar.style.width = `${Math.min(100, (sec / (target * 2)) * 100)}%`;
    crt.classList.toggle("is-over", sec > target && sec <= target * 2);
    crt.classList.toggle("is-twice", sec > target * 2);
    if (sec > target * 2) state.textContent = s.timerState.twice;
    else if (sec > target) state.textContent = s.timerState.over;
    else state.textContent = ticking ? s.timerState.running : s.timerState.idle;
    if (ticking && Date.now() - lastSaved > 5000) {
      lastSaved = Date.now();
      draft.elapsed = sec;
      saveDraft();
    }
    if (sec > target && !overAnnounced) {
      overAnnounced = true;
      crt.classList.add("is-alarm");
      window.setTimeout(() => crt.classList.remove("is-alarm"), 1600);
    }
    paintScore();
  };
  const startTimer = () => {
    if (ticking) return;
    startedAt = Date.now();
    ticking = window.setInterval(paintTimer, 250);
    toggle.textContent = s.timer.pause;
    crt.classList.add("is-running");
    paintTimer();
  };
  const stopTimer = () => {
    if (ticking) elapsed = seconds();
    window.clearInterval(ticking);
    ticking = undefined;
    crt.classList.remove("is-running");
    draft.elapsed = elapsed;
    saveDraft();
  };
  const resetTimer = () => {
    stopTimer();
    elapsed = 0;
    draft.elapsed = 0;
    saveDraft();
    overAnnounced = false;
    toggle.textContent = s.timer.start;
    paintTimer();
  };
  toggle.addEventListener("click", () => {
    if (ticking) {
      stopTimer();
      toggle.textContent = s.timer.resume;
      paintTimer();
    } else startTimer();
  });
  document.getElementById("timer-reset")!.addEventListener("click", resetTimer);

  // ----- questions -----
  const setScore = (q: HTMLElement, value: number | undefined) => {
    const badge = q.querySelector<HTMLElement>("[data-q-score]")!;
    if (value === undefined) {
      badge.textContent = "";
      badge.className = "q-score";
    } else {
      badge.textContent = `${Math.round(value * 100)} %`;
      badge.className = `q-score ${value >= 1 ? "is-full" : value > 0 ? "is-part" : "is-zero"}`;
    }
    q.classList.toggle("is-done", value !== undefined && value >= 1);
  };

  const feedbackList = (items: { ok: boolean; html: string; msg?: string }[], head: string) => {
    const wrap = document.createElement("div");
    const h = document.createElement("p");
    h.className = "fb-head";
    h.textContent = head;
    const ul = document.createElement("ul");
    ul.className = "fb-list";
    for (const it of items) {
      const li = document.createElement("li");
      li.className = it.ok ? "ok" : "ko";
      const label = document.createElement("span");
      label.innerHTML = it.html;
      li.append(label);
      if (it.msg) {
        const m = document.createElement("code");
        m.className = "fb-msg";
        m.textContent = it.msg;
        li.append(m);
      }
      ul.append(li);
    }
    wrap.append(h, ul);
    return wrap;
  };

  const check = async (q: HTMLElement, quiet = false) => {
    const qid = q.dataset.qid!;
    const type = q.dataset.type!;
    const fb = q.querySelector<HTMLElement>("[data-feedback]")!;
    const btn = q.querySelector<HTMLButtonElement>("[data-check]")!;
    let score = 0;

    if (type === "choice") {
      const picked = q.querySelector<HTMLInputElement>("input[type=radio]:checked");
      if (!picked) return;
      const correct = picked.value === q.querySelector<HTMLElement>("[data-answer-choice]")!.dataset.correct;
      score = correct ? 1 : 0;
      fb.className = `q-feedback ${correct ? "is-ok" : "is-ko"}`;
      fb.textContent = correct ? s.right : s.wrong;
      if (correct) {
        const why = q.querySelector<HTMLElement>("[data-model] p");
        if (why) {
          const p = document.createElement("p");
          p.innerHTML = why.innerHTML;
          fb.append(p);
        }
      }
    } else if (type === "text") {
      const text = fold((q.querySelector<HTMLTextAreaElement>("[data-answer]")!).value);
      if (!text.trim()) return;
      const concepts = JSON.parse(q.querySelector("[data-concepts]")!.textContent!) as { label: string; any: string[] }[];
      const found = concepts.map((c) => c.any.some((p) => new RegExp(p).test(text)));
      score = found.filter(Boolean).length / concepts.length;
      const revealed = article.classList.contains("is-solution-open");
      fb.className = "q-feedback";
      fb.replaceChildren(
        feedbackList(
          concepts.map((c, i) => ({ ok: found[i], html: found[i] || revealed ? c.label : s.missingConcept })),
          s.conceptsScore.replace("{n}", String(found.filter(Boolean).length)).replace("{t}", String(concepts.length)),
        ),
      );
    } else {
      const area = q.querySelector<HTMLTextAreaElement>("[data-answer]")!;
      const code = area.value;
      // An untouched starter can pass the "returns None" tests by accident: it scores 0.
      if (code.trim() === (area.dataset.starter ?? "").trim()) {
        fb.className = "q-feedback is-ko";
        fb.textContent = s.untouched;
        draft.scores[qid] = 0;
        saveDraft();
        setScore(q, 0);
        paintScore();
        return;
      }
      const { tests, labels } = JSON.parse(q.querySelector("[data-tests]")!.textContent!) as { tests: string; labels: Record<string, string> };
      btn.disabled = true;
      fb.className = "q-feedback is-busy";
      fb.textContent = (window as any).__pyReady ? s.running : s.loadingPy;
      const result = await runner.run(code, tests);
      (window as any).__pyReady = true;
      btn.disabled = false;
      if (result === "timeout") {
        fb.className = "q-feedback is-ko";
        fb.textContent = s.timeoutMsg;
      } else if (result.error && !result.tests.length) {
        fb.className = "q-feedback is-ko";
        const p = document.createElement("p");
        p.textContent = result.error.includes("pyodide") ? s.pyFailed : s.answerError;
        const c = document.createElement("code");
        c.className = "fb-msg";
        c.textContent = result.error;
        fb.replaceChildren(p, c);
      } else {
        const passed = result.tests.filter((r) => r.ok).length;
        score = result.tests.length ? passed / result.tests.length : 0;
        fb.className = "q-feedback";
        fb.replaceChildren(
          feedbackList(
            result.tests.map((r) => ({ ok: r.ok, html: labels[r.name] ?? r.name, msg: r.ok ? undefined : r.msg })),
            s.testsScore.replace("{n}", String(passed)).replace("{t}", String(result.tests.length)),
          ),
        );
      }
    }
    const before = draft.scores[qid] ?? 0;
    draft.scores[qid] = score;
    saveDraft();
    setScore(q, score);
    paintScore();
    if (!quiet && score >= 1 && before < 1) {
      celebrate(q);
      const badge = q.querySelector("[data-q-score]");
      floater(badge, "✓");
      const c = centre(badge);
      confetti(c.x, c.y, 14);
    }
    if (!quiet && allDone()) {
      stopTimer();
      toggle.textContent = s.timer.resume;
      paintTimer();
      celebrate(article.querySelector(".score") as HTMLElement, true);
    }
  };

  const allDone = () => questions.every((q) => (draft.scores[q.dataset.qid!] ?? 0) >= 1);

  questions.forEach((q) => {
    const qid = q.dataset.qid!;
    const answer = q.querySelector<HTMLTextAreaElement>("[data-answer]");
    const choice = q.querySelector<HTMLElement>("[data-answer-choice]");

    // restore the draft
    if (answer && draft.answers[qid] !== undefined) answer.value = draft.answers[qid];
    if (choice && draft.answers[qid] !== undefined) {
      const radio = choice.querySelector<HTMLInputElement>(`input[value="${draft.answers[qid]}"]`);
      if (radio) radio.checked = true;
    }
    if (draft.scores[qid] !== undefined) {
      setScore(q, draft.scores[qid]);
      // Feedback for choices and written answers is cheap to rebuild; code waits for a new run.
      if (q.dataset.type !== "code") check(q, true);
    }

    const onInput = (value: string) => {
      draft.answers[qid] = value;
      saveDraft();
      startTimer();
    };
    answer?.addEventListener("input", () => onInput(answer.value));
    choice?.addEventListener("change", (e) => {
      onInput((e.target as HTMLInputElement).value);
      check(q);
    });

    // Tab writes 4 spaces in code; Escape first, then Tab, leaves the field.
    if (answer?.classList.contains("code-input")) {
      let escaped = false;
      answer.addEventListener("keydown", (e) => {
        if (e.key === "Escape") escaped = true;
        if (e.key === "Tab" && !escaped && !e.shiftKey) {
          e.preventDefault();
          const { selectionStart: a, selectionEnd: b, value } = answer;
          answer.value = value.slice(0, a) + "    " + value.slice(b);
          answer.selectionStart = answer.selectionEnd = a + 4;
          onInput(answer.value);
        }
        if (e.key !== "Escape" && e.key !== "Tab") escaped = false;
      });
    }

    q.querySelector("[data-check]")!.addEventListener("click", () => check(q));

    q.querySelector("[data-reset-code]")?.addEventListener("click", () => {
      if (!answer) return;
      answer.value = answer.dataset.starter ?? "";
      onInput(answer.value);
    });

    const hintBtn = q.querySelector<HTMLButtonElement>("[data-hint]");
    const hintList = q.querySelector<HTMLElement>("[data-hints]");
    const showHints = (n: number) => {
      if (!hintList) return;
      const items = [...hintList.querySelectorAll("li")];
      items.forEach((li, i) => (li.hidden = i >= n));
      hintList.hidden = n === 0;
      if (hintBtn) {
        const total = Number(hintBtn.dataset.total);
        hintBtn.textContent = s.hintOf.replace("{n}", String(Math.min(n + 1, total))).replace("{t}", String(total));
        hintBtn.disabled = n >= total;
      }
    };
    showHints(draft.hints[qid] ?? 0);
    hintBtn?.addEventListener("click", () => {
      draft.hints[qid] = (draft.hints[qid] ?? 0) + 1;
      saveDraft();
      showHints(draft.hints[qid]);
      paintScore();
      startTimer();
    });
  });

  // ----- solution: can be opened and closed; opening it marks this attempt -----
  const revealButton = document.getElementById("reveal") as HTMLButtonElement;
  const body = document.getElementById("solution-body")!;
  const note = document.getElementById("revealed-note")!;
  let withSolution = revealedKeys().includes(`${track}:${id}`);
  const setSolution = (open: boolean) => {
    body.hidden = !open;
    article.classList.toggle("is-solution-open", open);
    article.querySelectorAll<HTMLElement>("[data-model]").forEach((m) => (m.hidden = !open));
    revealButton.textContent = open ? s.hide : s.reveal;
    revealButton.setAttribute("aria-expanded", String(open));
    note.hidden = !withSolution;
  };
  revealButton.addEventListener("click", () => {
    const open = body.hidden;
    if (open && !withSolution) {
      withSolution = true;
      write("drills.revealed", [...new Set([...revealedKeys(), `${track}:${id}`])]);
    }
    setSolution(open);
    paintScore();
  });
  setSolution(false);

  // ----- score of this attempt: two criteria computed, two self-rated -----
  const form = document.getElementById("grade-form") as HTMLFormElement;
  const totalEl = document.getElementById("total")!;
  const verdict = document.getElementById("verdict")!;
  const compEl = document.getElementById("completeness")!;
  const compBar = document.getElementById("completeness-bar")!;
  const hintsEl = document.getElementById("hints-used")!;

  const completeness = () =>
    questions.reduce((sum, q) => sum + (draft.scores[q.dataset.qid!] ?? 0), 0) / Math.max(1, questions.length);
  const hintCount = () => Object.values(draft.hints).reduce((a, b) => a + b, 0);
  const autoResult = () => {
    const c = completeness();
    if (c >= 0.9 && hintCount() === 0) return 2;
    return c >= 0.5 ? 1 : 0;
  };
  const autoTime = () => {
    const sec = seconds();
    if (sec === 0) return 0;
    return sec <= target ? 2 : sec <= target * 2 ? 1 : 0;
  };
  const selfScore = (i: number) => Number((form.elements.namedItem(`c${i}`) as RadioNodeList).value || 0);
  const scores = () => [autoResult(), autoTime(), selfScore(2), selfScore(3)];
  const total = () => scores().reduce((a, b) => a + b, 0);

  function paintScore() {
    const c = completeness();
    compEl.textContent = `${Math.round(c * 100)} %`;
    compBar.style.width = `${c * 100}%`;
    compBar.classList.toggle("is-full", c >= 1);
    const n = hintCount();
    hintsEl.textContent = n ? s.hintsUsed.replace("{n}", String(n)) : "";
    const [r, tm] = scores();
    for (const [i, v] of [[0, r], [1, tm]] as const) {
      const radio = form.querySelector<HTMLInputElement>(`input[name=c${i}][value="${v}"]`);
      if (radio) radio.checked = true;
    }
    const acquired = total() >= 7 && !withSolution;
    totalEl.textContent = String(total());
    verdict.textContent = acquired ? s.acquired : withSolution ? s.withSolution : s.notYet;
    verdict.classList.toggle("is-yes", acquired);
  }
  form.addEventListener("change", paintScore);

  // ----- history -----
  const tag = document.getElementById("attempt-tag")!;
  const list = document.getElementById("history-list")!;
  const empty = document.getElementById("history-empty")!;
  const renderHistory = () => {
    const attempts = attemptsFor(track, id);
    tag.textContent = s.attempt.replace("{n}", String(attempts.length + 1));
    empty.hidden = attempts.length > 0;
    list.hidden = attempts.length === 0;
    const best = Math.max(0, ...attempts.map((a) => a.total));
    list.replaceChildren(
      ...attempts.map((a, i) => {
        const li = document.createElement("li");
        li.className = a.total >= 7 && !a.withSolution ? "is-acquired" : a.withSolution ? "is-helped" : "";
        const label = document.createElement("span");
        label.className = "h-label";
        label.textContent = s.attempt.replace("{n}", String(i + 1));
        const meter = document.createElement("span");
        meter.className = "h-meter";
        const fill = document.createElement("span");
        fill.style.width = `${(a.total / 8) * 100}%`;
        meter.append(fill);
        const score = document.createElement("span");
        score.className = "h-score";
        score.textContent = `${a.total}/8`;
        const meta = document.createElement("span");
        meta.className = "h-meta";
        meta.textContent = [
          shortDate.format(new Date(a.date)),
          clock(a.seconds),
          a.completeness !== undefined ? `${Math.round(a.completeness * 100)} %` : "",
          a.withSolution ? s.withSolution : "",
          a.total === best ? s.best : "",
        ]
          .filter(Boolean)
          .join(", ");
        li.append(label, meter, score, meta);
        return li;
      }),
    );
  };

  const newAttempt = () => {
    form.reset();
    draft = { answers: {}, scores: {}, hints: {}, elapsed: 0 };
    saveDraft();
    withSolution = false;
    write("drills.revealed", revealedKeys().filter((x) => x !== `${track}:${id}`));
    questions.forEach((q) => {
      const answer = q.querySelector<HTMLTextAreaElement>("[data-answer]");
      if (answer) answer.value = answer.dataset.starter ?? "";
      q.querySelectorAll<HTMLInputElement>("input[type=radio]").forEach((r) => (r.checked = false));
      const fb = q.querySelector<HTMLElement>("[data-feedback]")!;
      fb.className = "q-feedback";
      fb.replaceChildren();
      setScore(q, undefined);
      const hintList = q.querySelector<HTMLElement>("[data-hints]");
      if (hintList) {
        hintList.hidden = true;
        hintList.querySelectorAll("li").forEach((li) => (li.hidden = true));
      }
      const hintBtn = q.querySelector<HTMLButtonElement>("[data-hint]");
      if (hintBtn) {
        hintBtn.disabled = false;
        hintBtn.textContent = s.hintOf.replace("{n}", "1").replace("{t}", hintBtn.dataset.total!);
      }
    });
    setSolution(false);
    resetTimer();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    stopTimer();
    const attempt: Attempt = {
      v: 2,
      track,
      id,
      date: new Date().toISOString(),
      seconds: seconds(),
      scores: scores(),
      total: total(),
      withSolution,
      completeness: completeness(),
      hints: hintCount(),
      proof: String(data.get("proof") ?? "").trim(),
      stuck: String(data.get("stuck") ?? "").trim(),
    };
    const xpBefore = gameState()?.xp ?? 0;
    saveJournal([...journal(), attempt]);
    const gained = (gameState()?.xp ?? 0) - xpBefore;
    toast(s.saved);
    const saveBtn = form.querySelector("button[type=submit]");
    if (gained > 0) floater(saveBtn, layoutStrings.xpGain.replace("{n}", String(gained)), true);
    if (attempt.total >= 7 && !attempt.withSolution) {
      celebrate(article.querySelector(".score") as HTMLElement, true);
      const c = centre(saveBtn);
      confetti(c.x, c.y, 40);
    }
    newAttempt();
    renderHistory();
    paintProgress();
    window.setTimeout(announce, 700);
    document.getElementById("history-h")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("again")!.addEventListener("click", () => {
    newAttempt();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  if (elapsed > 0) toggle.textContent = s.timer.resume;
  paintTimer();
  renderHistory();
}

/** A short phosphor burst on an element; skipped when the person prefers reduced motion. */
function celebrate(el: HTMLElement | null, big = false): void {
  if (!el) return;
  el.classList.remove("is-celebrating", "is-celebrating-big");
  void el.offsetWidth;
  el.classList.add(big ? "is-celebrating-big" : "is-celebrating");
  window.setTimeout(() => el.classList.remove("is-celebrating", "is-celebrating-big"), 1400);
}

/* ---------- journal page ---------- */

type JournalStrings = { delete: string; copied: string; importDone: string; importError: string };

function setupJournal(): void {
  const root = document.getElementById("journal");
  if (!root) return;
  const titles = JSON.parse(root.dataset.titles!) as Record<string, string>;
  const s = strings<JournalStrings>(root);
  const listEl = document.getElementById("journal-list")!;
  const empty = document.getElementById("journal-empty")!;
  const starNote = document.getElementById("journal-note")!;
  const filters = [...document.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  let filter = "all";

  const render = () => {
    const all = journal();
    const shown = all
      .map((a, index) => ({ a, index }))
      .filter(({ a }) => filter === "all" || a.track === filter)
      .sort((x, y) => y.a.date.localeCompare(x.a.date));
    empty.hidden = shown.length > 0;
    starNote.hidden = !shown.some(({ a }) => a.withSolution);
    listEl.replaceChildren(
      ...shown.map(({ a }) => {
        const li = document.createElement("li");
        li.className = "log-item";
        const head = document.createElement("div");
        head.className = "log-head";
        const link = document.createElement("a");
        link.href = `${base}${lang}/${a.track}/${a.id}/`;
        link.textContent = `${a.id.toUpperCase()} ${titles[keyOf(a)] ?? ""}`;
        const score = document.createElement("strong");
        score.className = a.total >= 7 && !a.withSolution ? "score-yes" : "";
        score.textContent = `${a.total}/8${a.withSolution ? " *" : ""}`;
        head.append(link, score);
        const meta = document.createElement("p");
        meta.className = "log-meta";
        meta.textContent = `${shortDate.format(new Date(a.date))}, ${clock(a.seconds)}`;
        li.append(head, meta);
        if (a.stuck) {
          const stuck = document.createElement("p");
          stuck.textContent = a.stuck;
          li.append(stuck);
        }
        if (/^https?:\/\//.test(a.proof)) {
          const proof = document.createElement("a");
          proof.href = a.proof;
          proof.rel = "noopener";
          proof.target = "_blank";
          proof.className = "log-proof";
          proof.textContent = a.proof.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48);
          li.append(proof);
        }
        const del = document.createElement("button");
        del.type = "button";
        del.className = "link-btn";
        del.textContent = s.delete;
        del.addEventListener("click", () => {
          saveJournal(journal().filter((x) => !(x.date === a.date && keyOf(x) === keyOf(a))));
          render();
          paintProgress();
        });
        li.append(del);
        return li;
      }),
    );
  };

  filters.forEach((btn) =>
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter!;
      filters.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render();
    }),
  );

  const merge = (text: string) => {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("not a list");
      const incoming = data.map(normalise);
      if (incoming.some((a) => a === null)) throw new Error("bad entry");
      const current = journal();
      const seen = new Set(current.map((a) => `${keyOf(a)}@${a.date}`));
      const added = (incoming as Attempt[]).filter((a) => !seen.has(`${keyOf(a)}@${a.date}`));
      saveJournal([...current, ...added]);
      render();
      paintProgress();
      announce();
      toast(s.importDone.replace("{n}", String(added.length)));
      return true;
    } catch {
      toast(s.importError);
      return false;
    }
  };

  document.getElementById("copy")!.addEventListener("click", async () => {
    const text = JSON.stringify(journal());
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older Safari without clipboard permission: fall back to a selected textarea.
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast(s.copied);
  });

  document.getElementById("export")!.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(journal(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drills-journal-${new Date().toISOString().slice(0, 10)}.json`;
    // Safari only downloads from a link that is in the page, and needs the URL alive a moment.
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  const input = document.getElementById("import") as HTMLInputElement;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (file) merge(await file.text());
    input.value = "";
  });

  const paste = document.getElementById("paste") as HTMLTextAreaElement;
  document.getElementById("paste-add")!.addEventListener("click", () => {
    if (paste.value.trim() && merge(paste.value.trim())) paste.value = "";
  });

  render();
}


/* ---------- progress page ---------- */

function setupProgress(): void {
  const root = document.getElementById("progress");
  if (!root || !gameData) return;
  const s = strings<Record<string, string | string[]>>(root);
  const titles = JSON.parse(root.dataset.titles!) as Record<string, string>;
  const svgNS = "http://www.w3.org/2000/svg";
  let track = root.dataset.track!;

  const el = <T extends SVGElement>(name: string, attrs: Record<string, string | number>) => {
    const node = document.createElementNS(svgNS, name) as T;
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
  };
  const days = (n: number) => (n === 1 ? (s.days as string[])[0] : (s.days as string[])[1].replace("{n}", String(n)));

  const render = () => {
    const all = journal().filter((a) => a.track === track).sort((a, b) => a.date.localeCompare(b.date));
    const catalog = gameData.catalog.filter((c) => c.track === track);
    const g = compute(all, catalog);

    // level card
    root.querySelector("[data-level-n]")!.textContent = String(g.levelIndex + 1);
    root.querySelector("[data-level-name]")!.textContent = gameData.levels[g.levelIndex];
    (root.querySelector("[data-level-bar]") as HTMLElement).style.width = `${Math.round(g.levelProgress * 100)}%`;
    root.querySelector("[data-level-xp]")!.textContent = g.next
      ? (s.xpTo as string).replace("{xp}", String(g.xp)).replace("{left}", String(g.next.xp - g.xp)).replace("{name}", gameData.levels[g.levelIndex + 1])
      : (s.xpMax as string).replace("{xp}", String(g.xp));

    // KPIs
    const kpi = (k: string, v: string) => (root.querySelector(`[data-kpi="${k}"]`)!.textContent = v);
    kpi("acquired", `${g.acquired.size}/${catalog.length}`);
    kpi("attempts", String(g.attempts));
    const minutes = Math.round(g.seconds / 60);
    kpi("time", minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`);
    const streaks = streakDisplay(g.attempts, g.streak, g.bestStreak, days, s.neverTried as string);
    kpi("streak", streaks.current);
    kpi("bestStreak", streaks.best);

    // per family
    root.querySelectorAll<HTMLElement>("[data-cat]").forEach((li) => {
      const group = catalog.filter((c) => c.cat === li.dataset.cat);
      const done = group.filter((c) => g.acquired.has(`${track}:${c.id}`)).length;
      (li.querySelector(".cat-meter span") as HTMLElement).style.width = `${group.length ? (done / group.length) * 100 : 0}%`;
      li.querySelector(".cat-count")!.textContent = `${done}/${group.length}`;
      li.classList.toggle("is-full", group.length > 0 && done === group.length);
    });

    // drill map: fill = best score
    root.querySelectorAll<HTMLElement>("[data-map]").forEach((a) => {
      const list = all.filter((x) => `${x.track}:${x.id}` === a.dataset.map);
      const best = Math.max(0, ...list.map((x) => x.total));
      (a.querySelector(".map-fill") as HTMLElement).style.height = `${(best / 8) * 100}%`;
      a.classList.toggle("is-acquired", isAcquired(list));
      a.classList.toggle("is-tried", list.length > 0);
      a.title = `${titles[a.dataset.map!] ?? ""}: ${list.length ? (s.bestOf as string).replace("{n}", String(best)) : s.neverTried}`;
    });

    // badges (all tracks: badges are earned once)
    const everything = compute(journal(), gameData.catalog);
    root.querySelectorAll<HTMLElement>("[data-badge]").forEach((b) => b.classList.toggle("is-earned", everything.badges.includes(b.dataset.badge!)));
    document.getElementById("badges-lead")!.textContent = (s.badgesLead as string)
      .replace("{n}", String(everything.badges.length))
      .replace("{t}", String(Object.keys(gameData.badges).length));

    // chart: one dot per attempt, score out of 8
    const box = document.getElementById("chart")!;
    const tip = document.getElementById("chart-tip")!;
    document.getElementById("chart-empty")!.hidden = all.length > 0;
    box.querySelector("svg")?.remove();
    if (!all.length) return;
    const W = 640, H = 240, L = 34, R = 12, T = 12, B = 30;
    const x = (i: number) => (all.length === 1 ? (L + W - R) / 2 : L + (i / (all.length - 1)) * (W - L - R));
    const y = (v: number) => T + (1 - v / 8) * (H - T - B);
    const svg = el<SVGSVGElement>("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": String(s.axis), class: "chart-svg" });
    for (const v of [0, 2, 4, 6, 8]) {
      svg.append(el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "c-grid" }));
      const label = el<SVGTextElement>("text", { x: L - 8, y: y(v) + 4, class: "c-axis", "text-anchor": "end" });
      label.textContent = String(v);
      svg.append(label);
    }
    svg.append(el("line", { x1: L, x2: W - R, y1: y(7), y2: y(7), class: "c-threshold" }));
    const t7 = el<SVGTextElement>("text", { x: W - R, y: y(7) - 6, class: "c-axis c-threshold-label", "text-anchor": "end" });
    t7.textContent = `7 · ${s.acquired}`;
    svg.append(t7);
    if (all.length > 1) {
      svg.append(el("polyline", { points: all.map((a, i) => `${x(i)},${y(a.total)}`).join(" "), class: "c-line" }));
    }
    const dots = all.map((a, i) => {
      const ok = a.total >= 7 && !a.withSolution;
      const dot = el<SVGCircleElement>("circle", { cx: x(i), cy: y(a.total), r: 5, class: ok ? "c-dot is-acquired" : "c-dot" });
      svg.append(dot);
      return dot;
    });
    const first = el<SVGTextElement>("text", { x: L, y: H - 8, class: "c-axis" });
    first.textContent = shortDate.format(new Date(all[0].date)).split(",")[0];
    const last = el<SVGTextElement>("text", { x: W - R, y: H - 8, class: "c-axis", "text-anchor": "end" });
    last.textContent = shortDate.format(new Date(all[all.length - 1].date)).split(",")[0];
    svg.append(first, last);
    const cross = el<SVGLineElement>("line", { x1: 0, x2: 0, y1: T, y2: H - B, class: "c-cross", visibility: "hidden" });
    svg.append(cross);
    box.append(svg);

    const move = (clientX: number) => {
      const r = svg.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * W;
      let k = 0;
      for (let i = 1; i < all.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(k) - px)) k = i;
      const a = all[k];
      cross.setAttribute("x1", String(x(k)));
      cross.setAttribute("x2", String(x(k)));
      cross.setAttribute("visibility", "visible");
      dots.forEach((d, i) => d.setAttribute("r", i === k ? "8" : "5"));
      tip.hidden = false;
      tip.replaceChildren();
      const h = document.createElement("strong");
      h.textContent = `${a.id.toUpperCase()} ${titles[`${a.track}:${a.id}`] ?? ""}`;
      const p = document.createElement("span");
      p.textContent = `${a.total}/8 · ${clock(a.seconds)} · ${shortDate.format(new Date(a.date))}`;
      tip.append(h, p);
      const left = (x(k) / W) * r.width;
      tip.style.left = `${Math.min(Math.max(left, 90), r.width - 90)}px`;
      tip.style.top = `${(y(a.total) / H) * r.height}px`;
    };
    svg.addEventListener("pointermove", (e) => move(e.clientX));
    svg.addEventListener("pointerdown", (e) => move(e.clientX));
    svg.addEventListener("pointerleave", () => {
      tip.hidden = true;
      cross.setAttribute("visibility", "hidden");
      dots.forEach((d) => d.setAttribute("r", "5"));
    });
  };

  root.querySelectorAll<HTMLButtonElement>("[data-progress-track]").forEach((btn, _, all) =>
    btn.addEventListener("click", () => {
      track = btn.dataset.progressTrack!;
      all.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render();
    }),
  );
  render();
}

/* ---------- offline ---------- */

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
    // Offline support is a bonus; the app works without it.
  });
}

setupTheme();
rememberLang();
paintProgress();
markCurrentWeek();
setupDrill();
initializeCompanionPanels();
setupJournal();
setupProgress();
setupUnlock();
announce();
registerServiceWorker();
