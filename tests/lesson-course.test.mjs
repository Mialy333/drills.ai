import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { MCP_PYTHON_LESSON, lessonText } from "../src/lib/lessons.ts";

const source = readFileSync(new URL("../src/learning/mcp_calculator.py", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../src/pages/[lang]/learn/[lessonId].astro", import.meta.url), "utf8");
const functionSource = `import math\n${source.slice(source.indexOf("def calculate_total("), source.indexOf("\n\nif __name__"))}`;

test("pilot lesson is structured, bilingual, and has six guided sequences", () => {
  assert.equal(MCP_PYTHON_LESSON.id, "mcp-python-server");
  assert.equal(MCP_PYTHON_LESSON.sequences.length, 6);
  assert.equal(MCP_PYTHON_LESSON.questions.length, 4);
  assert.equal(MCP_PYTHON_LESSON.objectives.length, 3);
  for (const lang of ["fr", "en"]) {
    assert.ok(lessonText(MCP_PYTHON_LESSON.title, lang).length > 10);
    assert.ok(MCP_PYTHON_LESSON.sequences.every((sequence) => lessonText(sequence.explanation, lang).length > 30));
    assert.ok(MCP_PYTHON_LESSON.questions.every((question) => question.id && question.options.length === 4 && lessonText(question.feedback, lang) && lessonText(question.incorrectFeedback, lang) && lessonText(question.hint, lang)));
  }
  assert.notDeepEqual(MCP_PYTHON_LESSON.questions.map((question) => question.answer), [0, 0, 0, 0]);
  assert.equal((MCP_PYTHON_LESSON.checksCode.match(/def test_/g) ?? []).length, 8);
});

test("starter fails behavior checks and the canonical function passes all eight", () => {
  const runner = (candidate) => spawnSync("python3", ["-c", `${candidate}\n${MCP_PYTHON_LESSON.checksCode}\noutcomes = []\nfor name, fn in list(globals().items()):\n    if name.startswith('test_') and callable(fn):\n        try: fn(); outcomes.append(True)\n        except Exception: outcomes.append(False)\nprint(sum(outcomes), len(outcomes))`], { encoding: "utf8" });
  const broken = runner(`import math\n${MCP_PYTHON_LESSON.starterCode.trimEnd()}`);
  const fixed = runner(functionSource);
  assert.equal(broken.status, 0, broken.stderr);
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.match(broken.stdout, /[0-7] 8/);
  assert.match(fixed.stdout, /8 8/);
});

test("lesson claims match the browser runtime boundary and the official MCP version", () => {
  assert.match(MCP_PYTHON_LESSON.sequences[2].takeaway.en, /does not run the MCP SDK or a network server/);
  assert.match(MCP_PYTHON_LESSON.sequences[1].takeaway.en, /v2\.3\.0/);
  assert.match(source, /from mcp\.server import MCPServer/);
  assert.match(source, /@mcp\.tool\(\)/);
  assert.doesNotMatch(source, /FastMCP/);
});

test("quiz is sequential, accessible, and keeps feedback and score on the lesson", () => {
  const source = pageSource;
  assert.match(source, /QuizQuestion/);
  assert.match(source, /QuizProgress/);
  assert.match(source, /QuizSummary/);
  assert.match(source, /completeQuiz\(state/);
  assert.match(source, /submitQuizAnswer\(state/);
  assert.match(source, /quizChecked\[index\]/);
  assert.match(source, /data-quiz-hint-button/);
  assert.match(source, /reviewingCompletedQuiz/);
  assert.match(source, /scoreLabel/);
  assert.doesNotMatch(readFileSync(new URL("../src/pages/[lang]/progress.astro", import.meta.url), "utf8"), /data-course-quiz-result/);
  const questionComponent = readFileSync(new URL("../src/components/QuizQuestion.astro", import.meta.url), "utf8");
  assert.match(questionComponent, /type="radio"/);
  assert.match(questionComponent, /aria-controls/);
});

test("original companion mascot provides seven accessible expression states", () => {
  const mascot = readFileSync(new URL("../src/components/DrillsMascot.astro", import.meta.url), "utf8");
  for (const mood of ["welcome", "thinking", "encouragement", "success", "help", "recommendation", "difficulty"]) {
    assert.match(mascot, new RegExp(`mascot-face-${mood}`));
  }
  assert.match(mascot, /prefers-reduced-motion/);
  assert.match(mascot, /aria-hidden/);
});

test("lesson completion wording is limited to what browser checks demonstrate", () => {
  assert.match(pageSource, /Leçon terminée : les huit vérifications de ta fonction passent/);
  assert.match(pageSource, /Lesson complete: your function passes all eight checks/);
  assert.doesNotMatch(pageSource, /You built your first MCP tool|tu as construit ton premier outil MCP/i);
});
