import test from "node:test";
import assert from "node:assert/strict";
import { CANDIDATE_PROFILE_KEY, CANDIDATE_PROFILE_TTL_MS, createCandidateProfile, deleteCandidateProfile, readCandidateProfile, writeCandidateProfile } from "../src/lib/candidate-profile.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const input = {
  experiences: [{ role: "Operations analyst", company: "Example Co", period: "2021–2024", summary: "Automated recurring reporting with Python and reviewed API data quality." }],
  schools: ["Example School"],
};

test("candidate profile expires thirty days after it is saved", () => {
  const now = new Date("2026-10-25T12:00:00.000Z");
  const profile = createCandidateProfile(input, now);
  assert.ok(profile);
  assert.deepEqual(Object.keys(profile).sort(), ["experiences", "expiresAt", "savedAt", "schools", "version"]);
  assert.equal(Date.parse(profile.expiresAt) - now.getTime(), CANDIDATE_PROFILE_TTL_MS);
});

test("expired profile is removed on read and user deletion removes saved data", () => {
  globalThis.localStorage = memoryStorage();
  const now = new Date("2026-10-25T12:00:00.000Z");
  assert.ok(writeCandidateProfile(input, now));
  assert.ok(readCandidateProfile(new Date(now.getTime() + CANDIDATE_PROFILE_TTL_MS - 1)));
  assert.equal(readCandidateProfile(new Date(now.getTime() + CANDIDATE_PROFILE_TTL_MS)), null);
  assert.equal(localStorage.getItem(CANDIDATE_PROFILE_KEY), null);
  assert.ok(writeCandidateProfile(input, now));
  assert.equal(deleteCandidateProfile(), true);
  assert.equal(localStorage.getItem(CANDIDATE_PROFILE_KEY), null);
  delete globalThis.localStorage;
});

test("candidate profile rejects missing work evidence", () => {
  assert.equal(createCandidateProfile({ ...input, experiences: [{ ...input.experiences[0], summary: "too short" }] }), null);
});
