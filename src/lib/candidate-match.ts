import type { DynamicDrill } from "./contracts";
import type { CandidateProfile } from "./candidate-profile";

export type SkillEvidenceStatus = "matched" | "partial" | "not-found";

export interface SkillEvidenceResult {
  name: string;
  priority: DynamicDrill["required_skills"][number]["priority"];
  status: SkillEvidenceStatus;
  evidenceSource: string | null;
}

export interface CandidateMatchResult {
  score: number;
  skills: SkillEvidenceResult[];
  evidenceCount: number;
}

const STOP_WORDS = new Set(["and", "for", "with", "from", "the", "des", "les", "une", "pour", "dans", "avec", "sur", "aux", "and", "of", "to"]);
const PRIORITY_WEIGHT: Record<SkillEvidenceResult["priority"], number> = {
  Core: 3,
  Important: 2,
  Supporting: 1,
};

function tokens(value: string): string[] {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function matchCandidateToDrill(profile: CandidateProfile, drill: Pick<DynamicDrill, "required_skills">): CandidateMatchResult {
  const evidence = profile.experiences.map((experience) => `${experience.role}\n${experience.summary}`).join("\n");
  const normalizedEvidence = evidence.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const evidenceTokens = new Set(tokens(evidence));
  const skills = drill.required_skills.map((skill): SkillEvidenceResult => {
    const skillTokens = [...new Set(tokens(skill.name))];
    const exactPhrase = normalizedEvidence.includes(skill.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    const overlap = skillTokens.length ? skillTokens.filter((token) => evidenceTokens.has(token)).length / skillTokens.length : 0;
    const status: SkillEvidenceStatus = exactPhrase || overlap >= 0.6
      ? "matched"
      : overlap > 0 ? "partial" : "not-found";
    const source = status === "not-found"
      ? null
      : profile.experiences.find((experience) => tokens(`${experience.role} ${experience.summary}`).some((token) => skillTokens.includes(token)))?.role ?? null;
    return { name: skill.name, priority: skill.priority, status, evidenceSource: source };
  });
  const totalWeight = skills.reduce((sum, skill) => sum + PRIORITY_WEIGHT[skill.priority], 0);
  const earnedWeight = skills.reduce((sum, skill) => sum + PRIORITY_WEIGHT[skill.priority] * (skill.status === "matched" ? 1 : skill.status === "partial" ? 0.5 : 0), 0);
  return {
    score: totalWeight ? Math.round((earnedWeight / totalWeight) * 100) : 0,
    skills,
    evidenceCount: skills.filter((skill) => skill.status !== "not-found").length,
  };
}
