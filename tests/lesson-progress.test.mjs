import assert from "node:assert/strict";
import test from "node:test";
import {
  createLessonState,
  isLessonComplete,
  parseLessonState,
  readLessonState,
  completeQuiz,
  restartQuiz,
  scoreLessonQuiz,
  saveLessonState,
  submitQuizAnswer,
  withLessonEvent,
} from "../src/lib/lesson-progress.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

const answers = [2, 3, 1, 2];

test("course progress saves and resumes the current step, code, attempts, and answers", () => {
  const storage = new MemoryStorage();
  let state = createLessonState("mcp-python-server", "2026-10-25T10:00:00.000Z");
  state = { ...state, lastSequence: 3, draft: "def calculate_total(): return 0", attempts: 2, answers, reflection: "Validate every input before allowing a payment." };
  state = withLessonEvent(state, "exercise-tested", "2026-10-25T10:05:00.000Z");
  assert.equal(saveLessonState(storage, state), true);
  const resumed = readLessonState(storage, "mcp-python-server");
  assert.equal(resumed.lastSequence, 3);
  assert.equal(resumed.draft, state.draft);
  assert.equal(resumed.attempts, 2);
  assert.deepEqual(resumed.answers, answers);
  assert.equal(resumed.events.at(-1).type, "exercise-tested");
});

test("lesson completion requires independent test evidence, correct answers, and a saved reflection", () => {
  const base = { ...createLessonState("mcp-python-server"), answers, quizSubmitted: true, quizChecked: [true, true, true, true], reflectionSubmitted: true, passedBeforeSolution: true };
  assert.equal(isLessonComplete(base, answers), true);
  assert.equal(isLessonComplete({ ...base, passedBeforeSolution: false }, answers), false);
  assert.equal(isLessonComplete({ ...base, answers: [2, 3, 1, -1] }, answers), false);
  assert.equal(isLessonComplete({ ...base, quizSubmitted: false }, answers), false);
  assert.equal(isLessonComplete({ ...base, reflectionSubmitted: false }, answers), false);
  assert.equal(isLessonComplete({ ...base, solutionViewed: true }, answers), true);
});

test("quiz score is shown only after submission and never implies mastery", () => {
  const base = createLessonState("mcp-python-server");
  const key = [2, 3, 1, 2];
  assert.equal(scoreLessonQuiz(base, key), null);
  assert.equal(scoreLessonQuiz({ ...base, quizSubmitted: true, answers: [2, 0, 1, 2] }, key), 3);
  assert.equal(scoreLessonQuiz({ ...base, quizSubmitted: true, answers: [2, 0, 1, 2] }, [0, 1]), null);
});

test("malformed or legacy course progress is ignored without throwing", () => {
  const storage = new MemoryStorage();
  storage.setItem("drills.lessons.progress.v1", JSON.stringify({ "mcp-python-server": { step: 2, complete: true } }));
  assert.equal(readLessonState(storage, "mcp-python-server"), null);
  assert.equal(parseLessonState({ version: 0 }), null);
});

test("question submission locks an answer, keeps hint evidence, and completes once", () => {
  const key = [2, 3, 1, 2];
  let state = createLessonState("mcp-python-server", "2026-10-25T10:00:00.000Z", key.length);
  state = { ...state, quizHintsUsed: [true, false, false, false] };
  state = submitQuizAnswer(state, 0, 0, "2026-10-25T10:01:00.000Z");
  assert.equal(state.quizChecked[0], true);
  assert.equal(state.answers[0], 0);
  assert.deepEqual(submitQuizAnswer(state, 0, 2), state, "a submitted answer cannot be silently changed");
  state = { ...state, quizIndex: 1 };
  for (let index = 1; index < key.length; index++) {
    state = submitQuizAnswer(state, index, key[index]);
    state = { ...state, quizIndex: Math.min(index + 1, key.length - 1) };
  }
  state = completeQuiz(state, key, "2026-10-25T10:05:00.000Z");
  assert.equal(state.quizSubmitted, true);
  assert.equal(scoreLessonQuiz(state, key), 3);
  assert.equal(state.quizAttempts.length, 1);
  assert.equal(state.quizAttempts[0].hintsUsed[0], true);
  assert.deepEqual(completeQuiz(state, key), state, "a completed attempt cannot be counted twice");
  const nextAttempt = restartQuiz(state);
  assert.equal(nextAttempt.quizSubmitted, false);
  assert.deepEqual(nextAttempt.quizAttempts, state.quizAttempts);
  assert.deepEqual(nextAttempt.answers, [-1, -1, -1, -1]);
});

test("legacy completed quiz data migrates without discarding answers or inventing a score date", () => {
  const storage = new MemoryStorage();
  const legacy = {
    version: 1, lessonId: "mcp-python-server", lastSequence: 4,
    firstSeenAt: "2026-10-25T10:00:00.000Z", updatedAt: "2026-10-25T10:05:00.000Z", draft: "", attempts: 1,
    testsPassed: true, passedBeforeSolution: true, solutionViewed: false, testResults: [true],
    answers, quizSubmitted: true, reflection: "Validate permissions and require confirmation before a payment action.",
    reflectionSubmitted: true, events: [{ type: "started", at: "2026-10-25T10:00:00.000Z" }, { type: "quiz-submitted", at: "2026-10-25T10:04:00.000Z" }],
  };
  storage.setItem("drills.lessons.progress.v1", JSON.stringify({ "mcp-python-server": legacy }));
  const resumed = readLessonState(storage, "mcp-python-server");
  assert.equal(resumed.version, 2);
  assert.deepEqual(resumed.answers, answers);
  assert.deepEqual(resumed.quizChecked, [true, true, true, true]);
  assert.equal(scoreLessonQuiz(resumed, [2, 3, 1, 2]), 4);
  assert.equal(resumed.quizAttempts[0].score, null, "migration retains raw evidence without guessing the historical score");
});
