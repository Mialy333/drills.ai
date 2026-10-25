import { HistoryEntrySchema } from "./application-history.ts";
import { z } from "zod";
import { ApplicationResultSchema } from "./application.ts";

export const APPLICATION_KEY = "drills.application.v1";
export const ApplicationStateSchema = z.object({
  posting_url: z.string().max(2000).optional(),
  residence: z.string().max(100).optional(), work_country: z.string().max(100).optional(),
  work_authorization: z.enum(['unknown','yes','restricted','sponsorship']).optional(),
  history: z.array(HistoryEntrySchema).max(100).optional(),
  version: z.literal(1), expiresAt: z.number(),
  profile: z.string().max(16000), posting: z.string().max(20000),
  result: ApplicationResultSchema.nullable(),
  practice_text: z.string().max(6000).optional(), contact: z.string().max(500).optional(), cv: z.string().max(20000), cv_html: z.string().max(100000).optional(), pitch: z.string().max(4000),
  reviewed: z.boolean(), remember: z.boolean(),
}).strict();
export type ApplicationState = z.infer<typeof ApplicationStateSchema>;
export function readApplicationState(session: Storage, local: Storage, now = Date.now()): ApplicationState | null {
  for (const storage of [session, local]) {
    try {
      const result = ApplicationStateSchema.safeParse(JSON.parse(storage.getItem(APPLICATION_KEY) ?? "null"));
      if (result.success && result.data.expiresAt > now) return result.data;
      storage.removeItem(APPLICATION_KEY);
    } catch { /* A blocked storage must not prevent the other from being read. */ }
  }
  return null;
}
export function saveApplicationState(state: ApplicationState, session: Storage, local: Storage): boolean {
  const result = ApplicationStateSchema.safeParse(state);
  if (!result.success) return false;
  let saved = false;
  try { session.setItem(APPLICATION_KEY, JSON.stringify(result.data)); saved = true; } catch {}
  try {
    if (state.remember) { local.setItem(APPLICATION_KEY, JSON.stringify(result.data)); saved = true; }
    else local.removeItem(APPLICATION_KEY);
  } catch {}
  return saved;
}
export function clearApplicationState(session: Storage, local: Storage): void {
  for (const storage of [session, local]) { try { storage.removeItem(APPLICATION_KEY); } catch {} }
}
export function applicationSteps(state: ApplicationState | null): boolean[] {
  return [!!state && state.profile.trim().length >= 50, !!state?.result, !!state?.result && state.reviewed];
}
