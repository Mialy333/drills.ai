import assert from "node:assert/strict";
import test from "node:test";
import { ASSESSMENT } from "../src/lib/assessment.ts";
import {
  createRecommendationProvenance,
  createStoredRecommendationPlan,
  provenanceCopy,
  resolveStoredProvenance,
} from "../src/lib/recommendation-provenance.ts";

const signals = (overrides = {}) => ({ diagnostic: false, profile: false, analyzedPosting: false, ...overrides });

test("provenance selects the strongest source actually available", () => {
  const cases = [
    [signals(), "default"],
    [signals({ profile: true }), "profile"],
    [signals({ diagnostic: true }), "diagnostic"],
    [signals({ diagnostic: true, profile: true }), "diagnostic"],
    [signals({ analyzedPosting: true }), "job-posting"],
    [signals({ analyzedPosting: true, profile: true }), "job-posting"],
    [signals({ analyzedPosting: true, diagnostic: true }), "job-posting"],
    [signals({ diagnostic: true, profile: true, analyzedPosting: true }), "job-posting"],
  ];
  for (const [input, expected] of cases) assert.equal(createRecommendationProvenance(input).source, expected);
});

test("saved provenance is retained and prior diagnostic data migrates only with a matching drill", () => {
  const savedJobSource = createRecommendationProvenance(signals({ analyzedPosting: true }));
  const savedPlan = createStoredRecommendationPlan("role-drill", savedJobSource);
  assert.deepEqual(resolveStoredProvenance(savedPlan, "role-drill", null, false), savedJobSource);
  assert.equal(resolveStoredProvenance(savedPlan, "different-drill", null, false).migration, "legacy-unattributed");
  const contradictoryPlan = { ...savedPlan, provenance: { ...savedJobSource, source: "diagnostic" } };
  assert.equal(resolveStoredProvenance(contradictoryPlan, "role-drill", null, false).migration, "legacy-unattributed");

  const question = ASSESSMENT[2];
  const oldAssessment = { version: 1, answers: ASSESSMENT.map((item) => item.answer), focusQuestionId: question.id };
  const migratedDiagnostic = resolveStoredProvenance(null, `assess-${question.id}`, oldAssessment, true);
  assert.equal(migratedDiagnostic.source, "diagnostic");
  assert.equal(migratedDiagnostic.signals.profile, true);
  assert.equal(migratedDiagnostic.migration, null);

  const oldPosting = resolveStoredProvenance(null, "old-role-drill", { ...oldAssessment, focusQuestionId: "mutable-default" }, true);
  assert.equal(oldPosting.source, "default");
  assert.equal(oldPosting.migration, "legacy-unattributed");
});

test("localized provenance copy makes no job-posting claims for diagnostic, profile, default, or unattributed legacy data", () => {
  for (const lang of ["fr", "en"]) {
    for (const source of ["diagnostic", "profile", "default"]) {
      const copy = provenanceCopy(createRecommendationProvenance(signals({ [source === "diagnostic" ? "diagnostic" : source]: true })), lang);
      assert.doesNotMatch(`${copy.title} ${copy.description}`, /fond[ée] sur l.{0,4}annonce|grounded in the posting|skills requested by|comp[ée]tences demand[ée]es par|senior interviewer|recruteur senior/i);
    }
    const legacy = resolveStoredProvenance(null, "old-role-drill", null, false);
    const copy = provenanceCopy(legacy, lang);
    assert.match(`${copy.title} ${copy.description}`, /source/i);
    assert.doesNotMatch(`${copy.title} ${copy.description}`, /fond[ée] sur l.{0,4}annonce|grounded in the posting|skills requested by|comp[ée]tences demand[ée]es par|senior interviewer|recruteur senior/i);
  }
});

test("only a successfully analyzed posting receives posting-grounded wording", () => {
  for (const lang of ["fr", "en"]) {
    const copy = provenanceCopy(createRecommendationProvenance(signals({ analyzedPosting: true })), lang);
    assert.match(`${copy.title} ${copy.description}`, /annonce|posting/i);
  }
});
