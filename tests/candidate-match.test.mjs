import test from "node:test";
import assert from "node:assert/strict";
import { createCandidateProfile } from "../src/lib/candidate-profile.ts";
import { matchCandidateToDrill } from "../src/lib/candidate-match.ts";

test("match score weights core skills and reports missing evidence without claiming absence", () => {
  const profile = createCandidateProfile({
    experiences: [{ role: "Developer", company: "RAG Specialist", period: "Python async, 2023–2025", summary: "Built async Python APIs with Git and documented deployment workflows." }],
    schools: ["Example School"],
  });
  assert.ok(profile);
  const result = matchCandidateToDrill(profile, { required_skills: [
    { name: "Python async", priority: "Core", evidence: "Posting says Python and asynchronous programming." },
    { name: "RAG", priority: "Important", evidence: "Posting asks for retrieval-augmented generation." },
    { name: "Git", priority: "Supporting", evidence: "Posting mentions Git." },
  ] });
  assert.equal(result.score, 67);
  assert.deepEqual(result.skills.map(({ status }) => status), ["matched", "not-found", "matched"]);
  assert.equal(result.skills[1].evidenceSource, null);
});

test("partial token overlap contributes half weight and school names do not create skill evidence", () => {
  const profile = createCandidateProfile({
    experiences: [{ role: "Developer", company: "Example Co", period: "2020–2024", summary: "Used Python to build small data tools." }],
    schools: ["Python Academy"],
  });
  assert.ok(profile);
  const result = matchCandidateToDrill(profile, { required_skills: [
    { name: "Python async", priority: "Core", evidence: "The job names Python async." },
    { name: "Tool integration", priority: "Important", evidence: "The job mentions tools." },
  ] });
  assert.equal(result.score, 30);
  assert.deepEqual(result.skills.map(({ status }) => status), ["partial", "not-found"]);
});
