import { LearnerProfileSchema, type LearnerProfile } from "./contracts";

export const LEARNER_PROFILE_KEY = "drills.learner-profile.v1";
export const ASSESSMENT_KEY = "drills.assessment.v1";

export function readLearnerProfile(): LearnerProfile | null {
  try {
    const raw = localStorage.getItem(LEARNER_PROFILE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result = LearnerProfileSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function writeLearnerProfile(profile: LearnerProfile): boolean {
  const result = LearnerProfileSchema.safeParse(profile);
  if (!result.success) return false;
  try {
    localStorage.setItem(LEARNER_PROFILE_KEY, JSON.stringify(result.data));
    return true;
  } catch {
    return false;
  }
}

export function profileSnapshot(profile: LearnerProfile, lang: "fr" | "en"): string {
  const values = lang === "fr"
    ? {
        goal: { "career-change": "reconversion professionnelle", "target-role": "préparation d'un poste ciblé", "skill-building": "développement de compétences" },
        python: { new: "débute en Python", some: "a déjà pratiqué Python", regular: "utilise Python régulièrement", professional: "utilise Python professionnellement" },
        agent: { new: "découvre les agents IA", learning: "apprend les agents IA", "built-projects": "a construit des projets avec des agents IA", professional: "travaille avec des agents IA" },
        pace: { steady: "rythme régulier", focused: "rythme intensif" },
      }
    : {
        goal: { "career-change": "career transition", "target-role": "prepare for a target role", "skill-building": "build technical skills" },
        python: { new: "new to Python", some: "has some Python practice", regular: "uses Python regularly", professional: "uses Python professionally" },
        agent: { new: "new to AI agents", learning: "learning AI agents", "built-projects": "has built AI agent projects", professional: "works with AI agents" },
        pace: { steady: "steady pace", focused: "focused pace" },
      };
  const hours = Math.round(profile.weeklyMinutes / 60);
  return lang === "fr"
    ? `Autoévaluation (non démontrée) : ${values.goal[profile.goal]} ; ${values.python[profile.pythonExperience]} ; ${values.agent[profile.agentExperience]} ; environ ${hours} h par semaine ; ${values.pace[profile.pace]}.`
    : `Self-reported, not demonstrated: ${values.goal[profile.goal]}; ${values.python[profile.pythonExperience]}; ${values.agent[profile.agentExperience]}; about ${hours} hours per week; ${values.pace[profile.pace]}.`;
}
