import { z } from "zod";

export const CANDIDATE_PROFILE_KEY = "drills.candidate-profile.v1";
export const CANDIDATE_PROFILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const CandidateProfileInputSchema = z.object({
  experiences: z.array(z.object({
    role: z.string().trim().min(2).max(120),
    company: z.string().trim().max(120),
    period: z.string().trim().max(80),
    summary: z.string().trim().min(20).max(2_000),
  }).strict()).min(1).max(3),
  schools: z.array(z.string().trim().min(2).max(120)).max(5),
}).strict();

export const CandidateProfileSchema = CandidateProfileInputSchema.extend({
  version: z.literal(1),
  savedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict();

export type CandidateProfileInput = z.infer<typeof CandidateProfileInputSchema>;
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export function createCandidateProfile(input: unknown, now = new Date()): CandidateProfile | null {
  const parsed = CandidateProfileInputSchema.safeParse(input);
  if (!parsed.success) return null;
  const savedAt = now.toISOString();
  return {
    ...parsed.data,
    version: 1,
    savedAt,
    expiresAt: new Date(now.getTime() + CANDIDATE_PROFILE_TTL_MS).toISOString(),
  };
}

export function readCandidateProfile(now = new Date()): CandidateProfile | null {
  try {
    const raw = localStorage.getItem(CANDIDATE_PROFILE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result = CandidateProfileSchema.safeParse(parsed);
    if (!result.success || Date.parse(result.data.expiresAt) <= now.getTime()) {
      localStorage.removeItem(CANDIDATE_PROFILE_KEY);
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export function writeCandidateProfile(input: unknown, now = new Date()): CandidateProfile | null {
  const profile = createCandidateProfile(input, now);
  if (!profile) return null;
  try {
    localStorage.setItem(CANDIDATE_PROFILE_KEY, JSON.stringify(profile));
    return profile;
  } catch {
    return null;
  }
}

export function deleteCandidateProfile(): boolean {
  try {
    localStorage.removeItem(CANDIDATE_PROFILE_KEY);
    return true;
  } catch {
    return false;
  }
}
