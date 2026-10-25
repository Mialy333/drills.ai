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

// Persistence regressions: imported profiles must survive navigation without re-entry.
import { APPLICATION_KEY, readApplicationState, saveApplicationState, clearApplicationState, applicationSteps } from "../src/lib/application-state.ts";
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };
const state = { version: 1, expiresAt: 2000, profile: "Imported career evidence ".repeat(5), posting: "Target posting ".repeat(5), result: null, cv: "", pitch: "", reviewed: false, remember: false };
test("profile survives navigation in session storage and durable storage requires opt-in", () => {
  const session = storage(), local = storage();
  assert.equal(saveApplicationState(state, session, local), true);
  assert.equal(readApplicationState(session, local, 1000).profile, state.profile);
  assert.equal(local.getItem(APPLICATION_KEY), null);
  saveApplicationState({...state, remember: true}, session, local);
  assert.equal(readApplicationState(storage(), local, 1000).profile, state.profile);
  saveApplicationState(state, session, local);
  assert.equal(local.getItem(APPLICATION_KEY), null);
});
test("expiry and explicit deletion clear the dossier without fabricating progress", () => {
  const session = storage(), local = storage();
  saveApplicationState({...state, remember: true}, session, local);
  assert.equal(readApplicationState(session, local, 2001), null);
  assert.deepEqual(applicationSteps(null), [false,false,false]);
  assert.deepEqual(applicationSteps(state), [true,false,false]);
  assert.deepEqual(applicationSteps({...state, result: fixture, reviewed: true}), [true,true,true]);
  saveApplicationState({...state, remember: true}, session, local);
  clearApplicationState(session, local);
  assert.equal(readApplicationState(session, local, 1000), null);
});
