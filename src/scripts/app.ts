// Everything interactive lives here: theme, progress, timer, attempts, journal, offline.
// State is kept in localStorage only; every access is guarded because storage can be
// missing (private windows) or full.

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

function setupDrill(): void {
  const article = document.querySelector<HTMLElement>("article.drill");
  if (!article) return;
  const id = article.dataset.drill!;
  const track = article.dataset.track!;
  const target = Number(article.dataset.minutes) * 60;
  const s = strings<DrillStrings>(article);
  const draftKey = `drills.draft.${track}:${id}`;
  const runner = new PythonRunner(base);
  const questions = [...article.querySelectorAll<HTMLElement>(".q")];
  let draft: Draft = read<Draft>(draftKey, { answers: {}, scores: {}, hints: {} });
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
    if (!quiet && score >= 1 && before < 1) celebrate(q);
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
    const hintList = q.querySelector<HTMLElement>("[data-hints]")!;
    const showHints = (n: number) => {
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
  let withSolution = read<string[]>("drills.revealed", []).includes(`${track}:${id}`);
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
      write("drills.revealed", [...new Set([...read<string[]>("drills.revealed", []), `${track}:${id}`])]);
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
    write("drills.revealed", read<string[]>("drills.revealed", []).filter((x) => x !== `${track}:${id}`));
    questions.forEach((q) => {
      const answer = q.querySelector<HTMLTextAreaElement>("[data-answer]");
      if (answer) answer.value = answer.dataset.starter ?? "";
      q.querySelectorAll<HTMLInputElement>("input[type=radio]").forEach((r) => (r.checked = false));
      const fb = q.querySelector<HTMLElement>("[data-feedback]")!;
      fb.className = "q-feedback";
      fb.replaceChildren();
      setScore(q, undefined);
      const hintList = q.querySelector<HTMLElement>("[data-hints]")!;
      hintList.hidden = true;
      hintList.querySelectorAll("li").forEach((li) => (li.hidden = true));
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
    saveJournal([...journal(), attempt]);
    toast(s.saved);
    if (attempt.total >= 7 && !attempt.withSolution) celebrate(article.querySelector(".score") as HTMLElement, true);
    newAttempt();
    renderHistory();
    paintProgress();
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
setupJournal();
registerServiceWorker();
