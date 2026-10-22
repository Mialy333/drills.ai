// Everything interactive lives here: theme, timer, scoring, journal, offline.
// State is kept in localStorage only; every access is guarded because storage
// can be missing (private windows) or full.

type Entry = {
  id: string;
  date: string; // ISO timestamp
  seconds: number;
  scores: number[]; // 4 criteria, 0 to 2
  total: number; // 0 to 8, capped at 4 when the solution was opened
  revealed: boolean;
  proof: string;
  stuck: string;
};

const KEYS = {
  theme: "drills.theme",
  lang: "drills.lang",
  journal: "drills.journal",
  revealed: "drills.revealed",
};

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

const journal = (): Entry[] => read<Entry[]>(KEYS.journal, []);
const saveJournal = (entries: Entry[]) => write(KEYS.journal, entries);

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

/* ---------- theme and language ---------- */

function setupTheme(): void {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const label = button.querySelector(".theme-label");
  const sync = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    const text = dark ? button.dataset.toLight : button.dataset.toDark;
    if (label && text) label.textContent = text;
    button.setAttribute("aria-pressed", String(dark));
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
  const lang = document.body.dataset.lang;
  if (lang) {
    try {
      localStorage.setItem(KEYS.lang, lang);
    } catch {}
  }
}

/* ---------- drill status in the side list ---------- */

function paintStatuses(): void {
  const t = document.body.dataset.lang === "fr"
    ? { acquired: "Acquis", tried: "Essayé" }
    : { acquired: "Acquired", tried: "Tried" };
  const best = new Map<string, number>();
  for (const e of journal()) best.set(e.id, Math.max(best.get(e.id) ?? 0, e.total));
  document.querySelectorAll<HTMLElement>("[data-status-for]").forEach((el) => {
    const score = best.get(el.dataset.statusFor ?? "");
    el.className = "side-status";
    el.textContent = "";
    if (score === undefined) return;
    const acquired = score >= 7;
    el.classList.add(acquired ? "is-acquired" : "is-tried");
    el.textContent = acquired ? t.acquired : t.tried;
  });
}

/* ---------- current week in the rotation ---------- */

function markCurrentWeek(): void {
  const rows = [...document.querySelectorAll<HTMLElement>("tr[data-week]")];
  if (!rows.length) return;
  const now = Date.now();
  const current =
    rows.find((r) => {
      const start = new Date(`${r.dataset.week}T00:00:00`).getTime();
      return now >= start && now < start + 7 * 86_400_000;
    }) ?? (now < new Date(`${rows[0].dataset.week}T00:00:00`).getTime() ? rows[0] : undefined);
  current?.classList.add("is-now");
}

/* ---------- drill page: timer, solution, score ---------- */

function setupDrill(): void {
  const article = document.querySelector<HTMLElement>("article.drill");
  if (!article) return;
  const id = article.dataset.drill!;
  const target = Number(article.dataset.minutes) * 60;

  // Timer
  const display = document.getElementById("timer-display")!;
  const state = document.getElementById("timer-state")!;
  const bar = document.getElementById("timer-bar")!;
  const toggle = document.getElementById("timer-toggle") as HTMLButtonElement;
  const reset = document.getElementById("timer-reset") as HTMLButtonElement;
  const crt = article.querySelector<HTMLElement>(".crt")!;
  const labels = JSON.parse(toggle.dataset.labels!) as Record<string, string>;
  const states = JSON.parse(state.dataset.labels!) as Record<string, string>;
  let elapsed = 0;
  let startedAt = 0;
  let ticking: number | undefined;

  const seconds = () => elapsed + (ticking ? Math.floor((Date.now() - startedAt) / 1000) : 0);
  const paint = () => {
    const s = seconds();
    display.textContent = clock(s);
    bar.style.width = `${Math.min(100, (s / (target * 2)) * 100)}%`;
    crt.classList.toggle("is-over", s > target && s <= target * 2);
    crt.classList.toggle("is-twice", s > target * 2);
    if (s > target * 2) state.textContent = states.twice;
    else if (s > target) state.textContent = states.over;
    else state.textContent = ticking ? states.running : states.idle;
  };
  toggle.addEventListener("click", () => {
    if (ticking) {
      elapsed = seconds();
      window.clearInterval(ticking);
      ticking = undefined;
      toggle.textContent = labels.resume;
      crt.classList.remove("is-running");
    } else {
      startedAt = Date.now();
      ticking = window.setInterval(paint, 250);
      toggle.textContent = labels.pause;
      crt.classList.add("is-running");
    }
    paint();
  });
  reset.addEventListener("click", () => {
    window.clearInterval(ticking);
    ticking = undefined;
    elapsed = 0;
    toggle.textContent = labels.start;
    crt.classList.remove("is-running");
    paint();
  });

  // Solution, behind a deliberate click
  const revealButton = document.getElementById("reveal") as HTMLButtonElement;
  const body = document.getElementById("solution-body")!;
  const note = document.getElementById("revealed-note")!;
  const revealed = () => read<string[]>(KEYS.revealed, []).includes(id);
  const showSolution = () => {
    body.hidden = false;
    note.hidden = false;
    revealButton.hidden = true;
    revealButton.setAttribute("aria-expanded", "true");
  };
  if (revealed()) showSolution();
  revealButton.addEventListener("click", () => {
    write(KEYS.revealed, [...new Set([...read<string[]>(KEYS.revealed, []), id])]);
    showSolution();
    body.focus?.();
    updateTotal();
  });

  // Score
  const form = document.getElementById("grade-form") as HTMLFormElement;
  const totalEl = document.getElementById("total")!;
  const verdict = document.getElementById("verdict")!;
  const scores = () =>
    [0, 1, 2, 3].map((i) => Number((form.elements.namedItem(`c${i}`) as RadioNodeList).value || 0));
  const computeTotal = () => {
    const raw = scores().reduce((a, b) => a + b, 0);
    return revealed() ? Math.min(raw, 4) : raw;
  };
  function updateTotal() {
    const total = computeTotal();
    totalEl.textContent = String(total);
    const acquired = total >= 7;
    verdict.textContent = acquired ? verdict.dataset.yes! : verdict.dataset.no!;
    verdict.classList.toggle("is-yes", acquired);
  }
  form.addEventListener("change", updateTotal);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const entry: Entry = {
      id,
      date: new Date().toISOString(),
      seconds: seconds(),
      scores: scores(),
      total: computeTotal(),
      revealed: revealed(),
      proof: String(data.get("proof") ?? "").trim(),
      stuck: String(data.get("stuck") ?? "").trim(),
    };
    saveJournal([...journal(), entry]);
    write(KEYS.revealed, read<string[]>(KEYS.revealed, []).filter((x) => x !== id));
    form.reset();
    body.hidden = true;
    note.hidden = true;
    revealButton.hidden = false;
    revealButton.setAttribute("aria-expanded", "false");
    updateTotal();
    paintStatuses();
    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    toast(submit.dataset.saved!);
  });
  updateTotal();
  paint();
}

/* ---------- journal page ---------- */

function isEntry(x: unknown): x is Entry {
  const e = x as Entry;
  return (
    !!e &&
    typeof e.id === "string" &&
    typeof e.date === "string" &&
    typeof e.total === "number" &&
    Array.isArray(e.scores)
  );
}

function setupJournal(): void {
  const root = document.getElementById("journal");
  if (!root) return;
  const titles = JSON.parse(root.dataset.titles!) as Record<string, string>;
  const tbody = document.getElementById("journal-body")!;
  const wrap = document.getElementById("journal-wrap")!;
  const empty = document.getElementById("journal-empty")!;
  const lang = document.body.dataset.lang!;
  const base = document.body.dataset.base!;
  const fmt = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const render = () => {
    const entries = journal()
      .map((e, index) => ({ e, index }))
      .sort((a, b) => b.e.date.localeCompare(a.e.date));
    wrap.hidden = entries.length === 0;
    empty.hidden = entries.length > 0;
    const starNote = document.getElementById("journal-note");
    if (starNote) starNote.hidden = !entries.some(({ e }) => e.revealed);
    tbody.replaceChildren(
      ...entries.map(({ e, index }) => {
        const tr = document.createElement("tr");
        const cell = (content: Node | string) => {
          const td = document.createElement("td");
          td.append(content);
          tr.append(td);
          return td;
        };
        cell(fmt.format(new Date(e.date)));
        const link = document.createElement("a");
        link.href = `${base}${lang}/drills/${e.id}/`;
        link.textContent = `${e.id.toUpperCase()} ${titles[e.id] ?? ""}`;
        cell(link);
        cell(clock(e.seconds));
        const score = cell(`${e.total}/8${e.revealed ? " *" : ""}`);
        score.className = e.total >= 7 ? "score-yes" : "";
        if (e.proof && /^https?:\/\//.test(e.proof)) {
          const a = document.createElement("a");
          a.href = e.proof;
          a.rel = "noopener";
          a.target = "_blank";
          a.textContent = e.proof.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40);
          cell(a);
        } else {
          cell(e.proof);
        }
        cell(e.stuck);
        const del = document.createElement("button");
        del.type = "button";
        del.className = "link-btn";
        del.textContent = root.dataset.delete!;
        del.addEventListener("click", () => {
          const all = journal();
          all.splice(index, 1);
          saveJournal(all);
          render();
          paintStatuses();
        });
        cell(del);
        return tr;
      }),
    );
  };

  document.getElementById("export")!.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(journal(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `python-drills-journal-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const input = document.getElementById("import") as HTMLInputElement;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data) || !data.every(isEntry)) throw new Error("bad shape");
      const seen = new Set(journal().map((e) => `${e.id}@${e.date}`));
      saveJournal([...journal(), ...data.filter((e) => !seen.has(`${e.id}@${e.date}`))]);
      render();
      paintStatuses();
      toast(input.dataset.done!);
    } catch {
      toast(input.dataset.error!);
    }
    input.value = "";
  });

  render();
}

/* ---------- offline ---------- */

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  const base = document.body.dataset.base!;
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
    // Offline support is a bonus; the app works without it.
  });
}

setupTheme();
rememberLang();
paintStatuses();
markCurrentWeek();
setupDrill();
setupJournal();
registerServiceWorker();
