import { z } from "zod";
import { ASSESSMENT } from "./assessment.ts";
import type { Lang } from "./drills.ts";

export type RecommendationSource = "diagnostic" | "profile" | "job-posting" | "default";

export const RecommendationProvenanceSchema = z.object({
  version: z.literal(1),
  source: z.enum(["diagnostic", "profile", "job-posting", "default"]),
  signals: z.object({
    diagnostic: z.boolean(),
    profile: z.boolean(),
    analyzedPosting: z.boolean(),
  }).strict(),
  migration: z.enum(["legacy-unattributed"]).nullable(),
}).strict();

export type RecommendationProvenance = z.infer<typeof RecommendationProvenanceSchema>;

export const StoredRecommendationPlanSchema = z.object({
  version: z.literal(1),
  drillId: z.string().min(1).max(160),
  provenance: RecommendationProvenanceSchema,
}).strict();

export function createStoredRecommendationPlan(drillId: string, provenance: RecommendationProvenance) {
  return StoredRecommendationPlanSchema.parse({ version: 1, drillId, provenance });
}

export function createRecommendationProvenance(signals: RecommendationProvenance["signals"]): RecommendationProvenance {
  const source: RecommendationSource = signals.analyzedPosting
    ? "job-posting"
    : signals.diagnostic
      ? "diagnostic"
      : signals.profile
        ? "profile"
        : "default";
  return { version: 1, source, signals, migration: null };
}

/** Preserve a trusted saved source; migrate only old diagnostic payloads with a matching assessment record. */
export function resolveStoredProvenance(
  saved: unknown,
  drillId: string,
  assessmentSnapshot: unknown,
  hasProfile: boolean,
): RecommendationProvenance {
  const parsed = StoredRecommendationPlanSchema.safeParse(saved);
  if (parsed.success && parsed.data.drillId === drillId && isConsistent(parsed.data.provenance)) return parsed.data.provenance;

  if (assessmentSnapshot && typeof assessmentSnapshot === "object") {
    const snapshot = assessmentSnapshot as { answers?: unknown; focusQuestionId?: unknown };
    const knownQuestion = ASSESSMENT.some(({ id }) => id === snapshot.focusQuestionId);
    if (
      knownQuestion && drillId === `assess-${snapshot.focusQuestionId}` &&
      Array.isArray(snapshot.answers) && snapshot.answers.length === ASSESSMENT.length &&
      snapshot.answers.every((answer) => Number.isInteger(answer))
    ) {
      return createRecommendationProvenance({ diagnostic: true, profile: hasProfile, analyzedPosting: false });
    }
  }

  return {
    ...createRecommendationProvenance({ diagnostic: false, profile: false, analyzedPosting: false }),
    migration: "legacy-unattributed",
  };
}

function isConsistent(provenance: RecommendationProvenance): boolean {
  const expected = provenance.signals.analyzedPosting
    ? "job-posting"
    : provenance.signals.diagnostic
      ? "diagnostic"
      : provenance.signals.profile
        ? "profile"
        : "default";
  return provenance.source === expected && (provenance.migration === null || expected === "default");
}

export function provenanceCopy(provenance: RecommendationProvenance, lang: Lang) {
  const copy = {
    fr: {
      diagnostic: ["RECOMMANDATIONS // ISSUES DU DIAGNOSTIC", "Ces priorités reflètent uniquement tes réponses au diagnostic."],
      profile: ["PARCOURS // PROFIL DÉCLARÉ", "Ce parcours tient compte des informations que tu as déclarées. Elles ne constituent pas une mesure de tes compétences."],
      "job-posting": ["PLAN DE PRÉPARATION // ANNONCE ANALYSÉE", "Les compétences et les étapes ci-dessous proviennent de l’analyse de l’annonce fournie."],
      default: ["PARCOURS DE PRATIQUE // POINT DE DÉPART", "Voici un exercice de départ. Aucune annonce ni résultat de diagnostic n’a été enregistré pour ce parcours."],
    },
    en: {
      diagnostic: ["RECOMMENDATIONS // FROM YOUR DIAGNOSTIC", "These priorities reflect only your diagnostic answers."],
      profile: ["LEARNING PATH // SELF-REPORTED PROFILE", "This path uses information you provided about yourself. It is not a measurement of your skills."],
      "job-posting": ["PREPARATION PLAN // POSTING ANALYZED", "The skills and steps below come from the analysis of the job posting you provided."],
      default: ["PRACTICE PATH // STARTING POINT", "Here is a starting exercise. No job posting or diagnostic result is recorded for this path."],
    },
  } as const;
  const [title, description] = copy[lang][provenance.source];
  if (provenance.migration === "legacy-unattributed") {
    return lang === "fr"
      ? { title: "EXERCICE ENREGISTRÉ // SOURCE NON ENREGISTRÉE", description: "Cet exercice vient de données enregistrées auparavant ; leur source ne peut pas être vérifiée." }
      : { title: "SAVED EXERCISE // SOURCE NOT RECORDED", description: "This exercise comes from previously saved data; its source cannot be verified." };
  }
  return { title, description };
}
