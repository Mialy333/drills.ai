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
};

function setupDrill(): void {
  const article = document.querySelector<HTMLElement>("article.drill");
  if (!article) return;
  const id = article.dataset.drill!;
  const track = article.dataset.track!;
  const target = Number(article.dataset.minutes) * 60;
  const s = strings<DrillStrings>(article);

  // Timer
  const display = document.getElementById("timer-display")!;
  const state = document.getElementById("timer-state")!;
  const bar = document.getElementById("timer-bar")!;
  const toggle = document.getElementById("timer-toggle") as HTMLButtonElement;
  const crt = article.querySelector<HTMLElement>(".crt")!;
  let elapsed = 0;
  let startedAt = 0;
  let ticking: number | undefined;

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
  };
  const stopTimer = () => {
    if (ticking) elapsed = seconds();
    window.clearInterval(ticking);
    ticking = undefined;
    crt.classList.remove("is-running");
  };
  const resetTimer = () => {
    stopTimer();
    elapsed = 0;
    toggle.textContent = s.timer.start;
    paintTimer();
  };
  toggle.addEventListener("click", () => {
    if (ticking) {
      stopTimer();
      toggle.textContent = s.timer.resume;
    } else {
      startedAt = Date.now();
      ticking = window.setInterval(paintTimer, 250);
      toggle.textContent = s.timer.pause;
      crt.classList.add("is-running");
    }
    paintTimer();
  });
  document.getElementById("timer-reset")!.addEventListener("click", resetTimer);

  // Solution: can be opened and closed again; opening it marks this attempt only.
  const revealButton = document.getElementById("reveal") as HTMLButtonElement;
  const body = document.getElementById("solution-body")!;
  const note = document.getElementById("revealed-note")!;
  let withSolution = false;
  const setSolution = (open: boolean) => {
    body.hidden = !open;
    revealButton.textContent = open ? s.hide : s.reveal;
    revealButton.setAttribute("aria-expanded", String(open));
    note.hidden = !withSolution;
  };
  revealButton.addEventListener("click", () => {
    const open = body.hidden;
    if (open) withSolution = true;
    setSolution(open);
    updateTotal();
  });

  // Score
  const form = document.getElementById("grade-form") as HTMLFormElement;
  const totalEl = document.getElementById("total")!;
  const verdict = document.getElementById("verdict")!;
  const scores = () =>
    [0, 1, 2, 3].map((i) => Number((form.elements.namedItem(`c${i}`) as RadioNodeList).value || 0));
  const total = () => scores().reduce((a, b) => a + b, 0);
  function updateTotal() {
    const acquired = total() >= 7 && !withSolution;
    totalEl.textContent = String(total());
    verdict.textContent = acquired ? s.acquired : withSolution ? s.withSolution : s.notYet;
    verdict.classList.toggle("is-yes", acquired);
  }
  form.addEventListener("change", updateTotal);

  // History of attempts, with a bar per attempt so progress shows at a glance.
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
        meta.textContent = [shortDate.format(new Date(a.date)), clock(a.seconds), a.withSolution ? s.withSolution : "", a.total === best ? s.best : ""]
          .filter(Boolean)
          .join(", ");
        li.append(label, meter, score, meta);
        return li;
      }),
    );
  };

  const newAttempt = () => {
    form.reset();
    withSolution = false;
    setSolution(false);
    resetTimer();
    updateTotal();
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
      proof: String(data.get("proof") ?? "").trim(),
      stuck: String(data.get("stuck") ?? "").trim(),
    };
    saveJournal([...journal(), attempt]);
    toast(s.saved);
    newAttempt();
    renderHistory();
    paintProgress();
    document.getElementById("history-h")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("again")!.addEventListener("click", () => {
    newAttempt();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  updateTotal();
  paintTimer();
  renderHistory();
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
