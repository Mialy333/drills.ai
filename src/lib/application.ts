import { z } from "zod";

const draftSection = z.object({
  heading: z.string().min(2).max(120),
  text: z.string().min(5).max(2_000),
  source_quotes: z.array(z.string().min(8).max(16_000)).min(1).max(8),
}).strict();

export const ApplicationResultSchema = z.object({
  role_title: z.string().min(2).max(160),
  scope: z.enum(["in_scope", "uncertain", "out_of_scope"]),
  scope_reason: z.string().min(10).max(500),
  requirements: z.array(z.object({
    name: z.string().min(2).max(160),
    kind: z.enum(["skill", "eligibility"]),
    priority: z.enum(["core", "important", "supporting"]),
    posting_quote: z.string().min(8).max(800),
    status: z.enum(["documented", "partial", "not_documented"]),
    candidate_quote: z.string().max(800).nullable(),
    explanation: z.string().min(10).max(800),
    next_action: z.string().min(10).max(500),
  }).strict()).min(1).max(12),
  cv_sections: z.array(draftSection).min(1).max(8),
  pitch: draftSection,
  interview_questions: z.array(z.object({
    question: z.string().min(10).max(500),
    looking_for: z.string().min(10).max(800),
  }).strict()).length(3),
  score: z.number().int().min(0).max(100).nullable(),
  decision: z.enum(["prepare", "strengthen", "review_scope"]),
  output_language: z.enum(["fr", "en"]),
}).strict();

export type ApplicationResult = z.infer<typeof ApplicationResultSchema>;

/** Plain text output only. Rendering uses textContent, never model-generated HTML. */
export function applicationCv(result: ApplicationResult): string {
  return result.cv_sections.map((section) => `${section.heading}\n${section.text}`).join("\n\n");
}

export function applicationDraftChanged(originalProfile: string, originalJob: string, profile: string, job: string): boolean {
  return originalProfile.trim() !== profile.trim() || originalJob.trim() !== job.trim();
}
