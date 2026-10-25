import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ApplicationResultSchema, applicationCv, applicationDraftChanged } from "../src/lib/application.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/application.json", import.meta.url), "utf8"));

test("backend result contract supports unknown scope without inventing a score", () => {
  assert.equal(ApplicationResultSchema.parse(fixture).score, 100);
  assert.equal(ApplicationResultSchema.parse({ ...fixture, score: null, decision: "review_scope", scope: "uncertain" }).score, null);
  assert.equal(ApplicationResultSchema.safeParse({ ...fixture, score: 140 }).success, false);
  assert.equal(ApplicationResultSchema.safeParse({ ...fixture, interview_questions: [] }).success, false);
});

test("CV export includes only drafted sections, not hidden scoring or reference material", () => {
  const output = applicationCv(ApplicationResultSchema.parse(fixture));
  assert.match(output, /Personal project/);
  assert.match(output, /Built a Python API/);
  assert.equal(output.includes("100"), false);
  assert.equal(output.includes("source_quotes"), false);
});

test("changing either source invalidates a previously generated application", () => {
  assert.equal(applicationDraftChanged("profile", "posting", "profile ", "posting"), false);
  assert.equal(applicationDraftChanged("profile", "posting", "new profile", "posting"), true);
  assert.equal(applicationDraftChanged("profile", "posting", "profile", "another posting"), true);
});
