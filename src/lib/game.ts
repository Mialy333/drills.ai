// Gamification computed from the journal alone: XP, levels, streaks and badges.
// Nothing is stored apart from the list of badges already announced, so deleting or
// importing attempts recomputes everything; the journal stays the single source of truth.

export type Attempt = {
  track: string;
  id: string;
  date: string;
  seconds: number;
  total: number;
  withSolution: boolean;
  completeness?: number;
  hints?: number;
  proof: string;
};

export type CatalogEntry = { id: string; cat: string; minutes: number; track: string };

type L = { fr: string; en: string };
export type BadgeDef = { id: string; icon: string; name: L; how: L; tier: "bronze" | "silver" | "gold" };

export const BADGES: BadgeDef[] = [
  { id: "first-step", icon: "▶", tier: "bronze", name: { fr: "Premier pas", en: "First step" }, how: { fr: "Enregistrer un premier passage.", en: "Save a first attempt." } },
  { id: "first-acquired", icon: "★", tier: "bronze", name: { fr: "Premier acquis", en: "First acquired" }, how: { fr: "Acquérir un drill : 7 sur 8 sans la solution.", en: "Acquire a drill: 7 of 8 without the solution." } },
  { id: "perfect", icon: "8", tier: "silver", name: { fr: "Huit sur huit", en: "Eight of eight" }, how: { fr: "Un passage à 8 sur 8, sans la solution.", en: "An attempt at 8 of 8, without the solution." } },
  { id: "no-net", icon: "◎", tier: "silver", name: { fr: "Sans filet", en: "No safety net" }, how: { fr: "100 % de complétude sans aucun indice.", en: "100% completeness without a single hint." } },
  { id: "lightning", icon: "ϟ", tier: "silver", name: { fr: "Éclair", en: "Lightning" }, how: { fr: "Acquérir un drill en moins de la moitié du temps cible.", en: "Acquire a drill in under half the target time." } },
  { id: "comeback", icon: "↻", tier: "silver", name: { fr: "Retour gagnant", en: "Comeback" }, how: { fr: "Acquérir un drill raté une première fois (moins de 5).", en: "Acquire a drill you first missed (under 5)." } },
  { id: "stubborn", icon: "⟳", tier: "bronze", name: { fr: "Tenace", en: "Stubborn" }, how: { fr: "Trois passages sur le même drill.", en: "Three attempts on the same drill." } },
  { id: "grit", icon: "⌛", tier: "bronze", name: { fr: "Jusqu'au bout", en: "All the way" }, how: { fr: "Finir à 100 % alors que le chrono a dépassé le double.", en: "Reach 100% after the timer went past twice the target." } },
  { id: "honest", icon: "✓", tier: "bronze", name: { fr: "Honnête", en: "Honest" }, how: { fr: "Enregistrer un passage fait avec la solution : il compte aussi.", en: "Save an attempt made with the solution: it counts too." } },
  { id: "proof", icon: "⛓", tier: "silver", name: { fr: "Preuve à l'appui", en: "With proof" }, how: { fr: "Joindre un lien de preuve (commit, PR, capture).", en: "Attach a proof link (commit, PR, screenshot)." } },
  { id: "streak-3", icon: "▲", tier: "bronze", name: { fr: "Trois jours d'affilée", en: "Three days in a row" }, how: { fr: "Au moins un passage trois jours de suite.", en: "At least one attempt three days running." } },
  { id: "streak-7", icon: "▲▲", tier: "gold", name: { fr: "Semaine pleine", en: "Full week" }, how: { fr: "Au moins un passage sept jours de suite.", en: "At least one attempt seven days running." } },
  { id: "ten", icon: "10", tier: "bronze", name: { fr: "Dix passages", en: "Ten attempts" }, how: { fr: "Enregistrer dix passages.", en: "Save ten attempts." } },
  { id: "fifty", icon: "50", tier: "gold", name: { fr: "Cinquante passages", en: "Fifty attempts" }, how: { fr: "Enregistrer cinquante passages.", en: "Save fifty attempts." } },
  { id: "early", icon: "☀", tier: "bronze", name: { fr: "Lève-tôt", en: "Early bird" }, how: { fr: "Un passage avant 8 h.", en: "An attempt before 8 am." } },
  { id: "night", icon: "☾", tier: "bronze", name: { fr: "Oiseau de nuit", en: "Night owl" }, how: { fr: "Un passage après 22 h.", en: "An attempt after 10 pm." } },
  { id: "cat-debug", icon: "⚑", tier: "gold", name: { fr: "Chasseuse de bugs", en: "Bug hunter" }, how: { fr: "Acquérir tous les drills de débogage.", en: "Acquire every debugging drill." } },
  { id: "cat-refactor", icon: "▦", tier: "gold", name: { fr: "Architecte", en: "Architect" }, how: { fr: "Acquérir tous les drills de refactoring.", en: "Acquire every refactoring drill." } },
  { id: "cat-read", icon: "◉", tier: "gold", name: { fr: "Lectrice de code", en: "Code reader" }, how: { fr: "Acquérir tous les drills de lecture de code.", en: "Acquire every code-reading drill." } },
  { id: "cat-formats", icon: "◆", tier: "gold", name: { fr: "Prête pour l'entretien", en: "Interview ready" }, how: { fr: "Acquérir tous les formats d'entretien.", en: "Acquire every interview format." } },
  { id: "half", icon: "½", tier: "silver", name: { fr: "À mi-chemin", en: "Halfway" }, how: { fr: "Acquérir la moitié des drills d'un langage.", en: "Acquire half the drills of a language." } },
  { id: "complete", icon: "♛", tier: "gold", name: { fr: "Parcours complet", en: "Full track" }, how: { fr: "Acquérir tous les drills d'un langage.", en: "Acquire every drill of a language." } },
];

export const LEVELS: { xp: number; name: L }[] = [
  { xp: 0, name: { fr: "Premier pas", en: "First steps" } },
  { xp: 150, name: { fr: "En pratique", en: "In practice" } },
  { xp: 500, name: { fr: "Régularité", en: "Consistency" } },
  { xp: 1100, name: { fr: "Curiosité", en: "Curiosity" } },
  { xp: 2000, name: { fr: "Élan", en: "Momentum" } },
  { xp: 3200, name: { fr: "Persévérance", en: "Persistence" } },
  { xp: 5000, name: { fr: "Exploration", en: "Exploration" } },
];

export const BADGE_XP = 50;
export const FIRST_ACQUIRED_XP = 100;

const acquiredAttempt = (a: Attempt) => a.total >= 7 && !a.withSolution;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** XP of one attempt, given whether it is the first acquisition of its drill. */
export const attemptXp = (a: Attempt, firstAcquisition: boolean) => a.total * 10 + (firstAcquisition ? FIRST_ACQUIRED_XP : 0);

/** Longest and current run of consecutive days with at least one attempt. */
export function streaks(attempts: Attempt[], now = new Date()) {
  const days = new Set(attempts.map((a) => dayKey(new Date(a.date))));
  const sorted = [...new Set(attempts.map((a) => new Date(a.date).setHours(0, 0, 0, 0)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = -Infinity;
  for (const t of sorted) {
    run = Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  // The current streak survives until the end of the day after the last attempt.
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { best, current };
}

/** A zero-day streak is not displayed as a streak before any attempt exists. */
export function streakDisplay(attemptCount: number, current: number, best: number, formatDays: (value: number) => string, noHistory: string) {
  return attemptCount > 0
    ? { current: formatDays(current), best: formatDays(best) }
    : { current: noHistory, best: noHistory };
}

export function compute(all: Attempt[], catalog: CatalogEntry[], now = new Date()) {
  const attempts = [...all].sort((a, b) => a.date.localeCompare(b.date));
  const info = new Map(catalog.map((c) => [`${c.track}:${c.id}`, c]));
  const acquired = new Set<string>();
  const firstScore = new Map<string, number>();
  const counts = new Map<string, number>();
  const earned = new Set<string>();
  let xp = 0;

  for (const a of attempts) {
    const key = `${a.track}:${a.id}`;
    const meta = info.get(key);
    const first = acquiredAttempt(a) && !acquired.has(key);
    xp += attemptXp(a, first);
    if (!firstScore.has(key)) firstScore.set(key, a.total);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (acquiredAttempt(a)) acquired.add(key);
    const hour = new Date(a.date).getHours();
    const target = (meta?.minutes ?? 15) * 60;

    earned.add("first-step");
    if (first) earned.add("first-acquired");
    if (a.total === 8 && !a.withSolution) earned.add("perfect");
    if ((a.completeness ?? 0) >= 1 && (a.hints ?? 0) === 0 && !a.withSolution) earned.add("no-net");
    if (acquiredAttempt(a) && a.seconds > 0 && a.seconds * 2 <= target) earned.add("lightning");
    if (acquiredAttempt(a) && (firstScore.get(key) ?? 8) < 5) earned.add("comeback");
    if ((counts.get(key) ?? 0) >= 3) earned.add("stubborn");
    if ((a.completeness ?? 0) >= 1 && a.seconds > target * 2) earned.add("grit");
    if (a.withSolution) earned.add("honest");
    if (/^https?:\/\//.test(a.proof)) earned.add("proof");
    if (hour < 8) earned.add("early");
    if (hour >= 22) earned.add("night");
  }

  const { best, current } = streaks(attempts, now);
  if (best >= 3) earned.add("streak-3");
  if (best >= 7) earned.add("streak-7");
  if (attempts.length >= 10) earned.add("ten");
  if (attempts.length >= 50) earned.add("fifty");

  const tracks = [...new Set(catalog.map((c) => c.track))];
  for (const track of tracks) {
    const inTrack = catalog.filter((c) => c.track === track);
    const done = inTrack.filter((c) => acquired.has(`${track}:${c.id}`)).length;
    if (inTrack.length && done * 2 >= inTrack.length) earned.add("half");
    if (inTrack.length && done === inTrack.length) earned.add("complete");
    for (const cat of ["debug", "refactor", "read", "formats"]) {
      const group = inTrack.filter((c) => c.cat === cat);
      if (group.length && group.every((c) => acquired.has(`${track}:${c.id}`))) earned.add(`cat-${cat}`);
    }
  }

  xp += earned.size * BADGE_XP;
  const levelIndex = LEVELS.reduce((i, l, k) => (xp >= l.xp ? k : i), 0);
  const level = LEVELS[levelIndex];
  const next = LEVELS[levelIndex + 1];
  return {
    xp,
    levelIndex,
    level,
    next,
    levelProgress: next ? (xp - level.xp) / (next.xp - level.xp) : 1,
    badges: BADGES.filter((b) => earned.has(b.id)).map((b) => b.id),
    acquired,
    streak: current,
    bestStreak: best,
    attempts: attempts.length,
    seconds: attempts.reduce((s, a) => s + a.seconds, 0),
  };
}

export type GameState = ReturnType<typeof compute>;
