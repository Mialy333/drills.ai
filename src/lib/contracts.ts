import { z } from "zod";

/** Browser mirror of `DynamicDrillSchema` in the FastAPI response contract. */
export const MultipleChoiceSchema = z.object({
  question: z.string().min(5).max(600),
  options: z.array(z.string()).length(4),
  correct_answer_index: z.number().int().min(0).max(3),
  reasoning: z.string().min(5).max(1000),
}).strict();

export const RequiredSkillSchema = z.object({
  name: z.string().min(2).max(120),
  priority: z.enum(["Core", "Important", "Supporting"]),
  evidence: z.string().min(3).max(500),
}).strict();

export const RoadmapStepSchema = z.object({
  title: z.string().min(2).max(160),
  skill: z.string().min(2).max(120),
  objective: z.string().min(5).max(600),
  minutes: z.number().int().min(5).max(240),
}).strict();

export const DynamicDrillSchema = z.object({
  output_language: z.enum(["fr", "en"]),
  role_title: z.string().min(2).max(160),
  role_summary: z.string().min(10).max(1200),
  required_skills: z.array(RequiredSkillSchema).min(3).max(8),
  roadmap: z.array(RoadmapStepSchema).min(3).max(6),
  drill_id: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/),
  family: z.enum(["Debugging", "Refactoring", "Code reading"]),
  title: z.string().min(3).max(160),
  context: z.string().min(10).max(1600),
  mission: z.string().min(10).max(1600),
  broken_code: z.string().min(10).max(12000),
  fixed_solution: z.string().min(10).max(12000),
  hidden_test_harness: z.string().min(10).max(12000),
  multiple_choice: MultipleChoiceSchema,
  model_answer_ideas: z.array(z.string()).min(3).max(5),
}).strict();

export type DynamicDrill = z.infer<typeof DynamicDrillSchema>;

export const LearnerProfileSchema = z.object({
  version: z.literal(1),
  goal: z.enum(["career-change", "target-role", "skill-building"]),
  pythonExperience: z.enum(["new", "some", "regular", "professional"]),
  agentExperience: z.enum(["new", "learning", "built-projects", "professional"]),
  weeklyMinutes: z.number().int().min(30).max(2400),
  pace: z.enum(["steady", "focused"]),
  updatedAt: z.string().datetime(),
}).strict();

export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;

export const CompanionRequestSchema = z.object({
  output_language: z.enum(["fr", "en"]),
  message: z.string().trim().min(1).max(2000),
  learner: z.object({
    goal: z.string().max(120).optional(),
    python_experience: z.string().max(80).optional(),
    agent_experience: z.string().max(80).optional(),
    weekly_minutes: z.number().int().min(30).max(2400).optional(),
    demonstrated_snapshot: z.string().max(1000).optional(),
  }).strict().optional(),
  roadmap: z.object({
    role_title: z.string().max(160),
    role_summary: z.string().max(1200),
    steps: z.array(z.object({
      title: z.string().max(160),
      skill: z.string().max(120),
      objective: z.string().max(600),
    }).strict()).max(6),
  }).strict().optional(),
  exercise: z.object({
    title: z.string().max(160),
    context: z.string().max(1600),
    mission: z.string().max(1600),
    current_answer: z.string().max(12000).optional(),
    latest_feedback: z.string().max(2000).optional(),
  }).strict().optional(),
}).strict();

export type CompanionRequest = z.infer<typeof CompanionRequestSchema>;
