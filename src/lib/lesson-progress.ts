import { z } from "zod";

export const LESSON_PROGRESS_KEY = "drills.lessons.progress.v1";
const EventSchema = z.object({ type: z.enum(["started", "exercise-tested", "exercise-passed", "quiz-submitted", "reflection-submitted", "completed"]), at: z.string().datetime() }).strict();
const QuizAttemptSchema = z.object({ answers: z.array(z.number().int().min(-1).max(19)).min(1).max(20), score: z.number().int().min(0).max(20).nullable(), completedAt: z.string().datetime(), hintsUsed: z.array(z.boolean()).max(20) }).strict();
const LessonStateV2Schema = z.object({
  version: z.literal(2),
  lessonId: z.string().min(1).max(100),
  lastSequence: z.number().int().min(0).max(5),
  firstSeenAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  draft: z.string().max(12000),
  attempts: z.number().int().min(0),
  testsPassed: z.boolean(),
  passedBeforeSolution: z.boolean(),
  solutionViewed: z.boolean(),
  testResults: z.array(z.boolean()).max(20),
  answers: z.array(z.number().int().min(-1).max(19)).min(1).max(20),
  quizSubmitted: z.boolean(),
  quizIndex: z.number().int().min(0).max(19),
  quizChecked: z.array(z.boolean()).min(1).max(20),
  quizHintsUsed: z.array(z.boolean()).min(1).max(20),
  quizCompletedAt: z.string().datetime().nullable(),
  quizAttempts: z.array(QuizAttemptSchema).max(20),
  reflection: z.string().max(3000),
  reflectionSubmitted: z.boolean(),
  events: z.array(EventSchema).max(30),
}).strict().refine((state) => state.answers.length === state.quizChecked.length && state.answers.length === state.quizHintsUsed.length && state.quizIndex < state.answers.length, "Quiz state arrays must match the question count");
const LessonStateV1Schema = z.object({
  version: z.literal(1), lessonId: z.string().min(1).max(100), lastSequence: z.number().int().min(0).max(5),
  firstSeenAt: z.string().datetime(), updatedAt: z.string().datetime(), draft: z.string().max(12000), attempts: z.number().int().min(0),
  testsPassed: z.boolean(), passedBeforeSolution: z.boolean(), solutionViewed: z.boolean(), testResults: z.array(z.boolean()).max(20),
  answers: z.array(z.number().int().min(-1).max(3)).length(4), quizSubmitted: z.boolean(), reflection: z.string().max(3000),
  reflectionSubmitted: z.boolean(), events: z.array(EventSchema).max(30),
}).strict();
export const LessonStateSchema = LessonStateV2Schema;
export type LessonState = z.infer<typeof LessonStateSchema>;

export function createLessonState(lessonId: string, now = new Date().toISOString(), questionCount = 4): LessonState {
  const count = Math.max(1, Math.min(20, Math.floor(questionCount)));
  return { version: 2, lessonId, lastSequence: 0, firstSeenAt: now, updatedAt: now, draft: "", attempts: 0, testsPassed: false, passedBeforeSolution: false, solutionViewed: false, testResults: [], answers: Array(count).fill(-1), quizSubmitted: false, quizIndex: 0, quizChecked: Array(count).fill(false), quizHintsUsed: Array(count).fill(false), quizCompletedAt: null, quizAttempts: [], reflection: "", reflectionSubmitted: false, events: [{ type: "started", at: now }] };
}

export function parseLessonState(value: unknown): LessonState | null {
  const current = LessonStateV2Schema.safeParse(value);
  if (current.success) return current.data;
  const legacy = LessonStateV1Schema.safeParse(value);
  if (!legacy.success) return null;
  const old = legacy.data;
  const checked = old.answers.map((answer) => old.quizSubmitted && answer >= 0);
  const quizCompletedAt = old.quizSubmitted ? old.updatedAt : null;
  return {
    ...old,
    version: 2,
    quizIndex: Math.max(0, old.answers.findIndex((answer, index) => !checked[index])),
    quizChecked: checked,
    quizHintsUsed: Array(old.answers.length).fill(false),
    quizCompletedAt,
    quizAttempts: old.quizSubmitted
      ? [{ answers: old.answers, score: null, completedAt: old.updatedAt, hintsUsed: Array(old.answers.length).fill(false) }]
      : [],
  };
}

export function readLessonState(storage: Pick<Storage, "getItem">, lessonId: string, questionCount = 4): LessonState | null {
  try {
    const raw = storage.getItem(LESSON_PROGRESS_KEY);
    if (!raw) return null;
    const root: unknown = JSON.parse(raw);
    if (!root || typeof root !== "object" || !(lessonId in root)) return null;
    const state = parseLessonState((root as Record<string, unknown>)[lessonId]);
    return state && state.answers.length === questionCount ? state : null;
  } catch { return null; }
}

export function saveLessonState(storage: Pick<Storage, "getItem" | "setItem">, state: LessonState): boolean {
  const parsed = parseLessonState(state);
  if (!parsed) return false;
  try {
    let root: Record<string, unknown> = {};
    try {
      const value: unknown = JSON.parse(storage.getItem(LESSON_PROGRESS_KEY) ?? "{}");
      if (value && typeof value === "object" && !Array.isArray(value)) root = value as Record<string, unknown>;
    } catch { /* Start a clean versioned course-progress record. */ }
    root[parsed.lessonId] = parsed;
    storage.setItem(LESSON_PROGRESS_KEY, JSON.stringify(root));
    return true;
  } catch { return false; }
}

export function withLessonEvent(state: LessonState, type: LessonState["events"][number]["type"], now = new Date().toISOString()): LessonState {
  return { ...state, updatedAt: now, events: [...state.events, { type, at: now }].slice(-30) };
}

export function isLessonComplete(state: LessonState, correctAnswers: number[]): boolean {
  return state.passedBeforeSolution && state.quizSubmitted && state.quizChecked.every(Boolean) && state.answers.length === correctAnswers.length && state.answers.every((answer, index) => answer === correctAnswers[index]) && state.reflectionSubmitted;
}

/** Returns submitted quiz evidence only; a viewed or incomplete quiz has no score. */
export function scoreLessonQuiz(state: LessonState, correctAnswers: number[]): number | null {
  if (!state.quizSubmitted || correctAnswers.length !== state.answers.length) return null;
  return state.answers.reduce((score, answer, index) => score + Number(answer === correctAnswers[index]), 0);
}

export function submitQuizAnswer(state: LessonState, index: number, answer: number, now = new Date().toISOString()): LessonState {
  if (state.quizSubmitted || index !== state.quizIndex || state.quizChecked[index] || answer < 0 || answer > 19) return state;
  const answers = [...state.answers];
  answers[index] = answer;
  const quizChecked = [...state.quizChecked];
  quizChecked[index] = true;
  return { ...state, answers, quizChecked, updatedAt: now };
}

export function completeQuiz(state: LessonState, correctAnswers: number[], now = new Date().toISOString()): LessonState {
  if (state.quizSubmitted || !state.quizChecked.every(Boolean) || correctAnswers.length !== state.answers.length) return state;
  const score = scoreLessonQuiz({ ...state, quizSubmitted: true }, correctAnswers) ?? 0;
  const attempt = { answers: state.answers, score, completedAt: now, hintsUsed: state.quizHintsUsed };
  return withLessonEvent({ ...state, quizSubmitted: true, quizCompletedAt: now, quizAttempts: [...state.quizAttempts, attempt].slice(-20) }, "quiz-submitted", now);
}

export function restartQuiz(state: LessonState): LessonState {
  return { ...state, answers: Array(state.answers.length).fill(-1), quizSubmitted: false, quizIndex: 0, quizChecked: Array(state.answers.length).fill(false), quizHintsUsed: Array(state.answers.length).fill(false), quizCompletedAt: null };
}
