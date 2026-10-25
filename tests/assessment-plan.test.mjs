import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { ASSESSMENT } from "../src/lib/assessment.ts";
import { DynamicDrillSchema } from "../src/lib/contracts.ts";
import { buildAssessmentPlan } from "../src/lib/assessment-plan.ts";

const perfectAnswers = () => ASSESSMENT.map((question) => question.answer);

test("each missed diagnostic question leads to a valid localized runnable exercise", () => {
  for (const lang of ["en", "fr"]) {
    for (const [index, question] of ASSESSMENT.entries()) {
      const answers = perfectAnswers();
      answers[index] = (question.answer + 1) % question.options[lang].length;
      const plan = buildAssessmentPlan(answers, lang);
      assert.equal(plan.focusId, question.id);
      assert.equal(plan.reviewIds[0], question.id);
      assert.equal(plan.steps.length, 3);
      assert.deepEqual(plan.steps.map((step) => step.action), ["exercise", "exercise", "diagnostic"]);
      assert.equal(DynamicDrillSchema.safeParse(plan.drill).success, true);
      assert.equal(plan.drill.output_language, lang);
      const result = spawnSync("python3", ["-c", plan.drill.fixed_solution + "\n" + plan.drill.hidden_test_harness], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      const broken = spawnSync("python3", ["-c", plan.drill.broken_code + "\n" + plan.drill.hidden_test_harness], { encoding: "utf8" });
      assert.notEqual(broken.status, 0, question.id + " starter unexpectedly passed its hidden checks");
    }
  }
});

test("the recommendation uses exact missed concepts, not only total score", () => {
  const mutableDefault = perfectAnswers();
  mutableDefault[0] = 1;
  const schemaBoundary = perfectAnswers();
  schemaBoundary[1] = 1;
  const first = buildAssessmentPlan(mutableDefault, "en");
  const second = buildAssessmentPlan(schemaBoundary, "en");
  assert.equal(first.reviewIds.length, second.reviewIds.length);
  assert.notEqual(first.focusId, second.focusId);
  assert.notEqual(first.drill.title, second.drill.title);
  assert.notEqual(first.drill.mission, second.drill.mission);
});

test("all-correct answers still produce a useful extension with honest evidence", () => {
  const plan = buildAssessmentPlan(perfectAnswers(), "fr");
  assert.equal(plan.reviewIds.length, 0);
  assert.equal(plan.correctIds.length, 8);
  assert.equal(plan.focusId, "retry-policy");
  assert.match(plan.steps[0].why, /répondu juste aux huit questions/);
});

test("profile information is labeled as self-reported and weekly availability is only shown when supplied", () => {
  const profile = { version: 1, goal: "career-change", pythonExperience: "new", agentExperience: "new", weeklyMinutes: 180, pace: "steady", updatedAt: "2026-10-25T10:00:00.000Z" };
  const answers = perfectAnswers();
  answers[0] = 1;
  const withProfile = buildAssessmentPlan(answers, "en", profile);
  const withoutProfile = buildAssessmentPlan(answers, "en");
  assert.match(withProfile.steps[0].why, /self-reported experience/);
  assert.match(withProfile.steps[0].why, /career transition/);
  assert.match(withProfile.scheduleNote, /180 minutes/);
  assert.equal(withoutProfile.scheduleNote, null);
});
