import { z } from 'zod';
import type { ApplicationResult } from './application.ts';
export const HistoryEntrySchema=z.object({
 id:z.string(), posting:z.string().max(20000), role:z.string().max(160), company:z.string().max(160).default(''),
 score:z.number().nullable(), eligibility_pending:z.number().int().nonnegative(),
 analysed_at:z.string().nullable(), analyses:z.number().int().positive(),
 status:z.enum(['analysed','sent','interview','offer','rejected']), sent_at:z.string().nullable(),
 notes:z.string().max(3000).default(''),
});
export type HistoryEntry=z.infer<typeof HistoryEntrySchema>;
export function recordAnalysis(entries:HistoryEntry[],posting:string,result:ApplicationResult,at:string|null=new Date().toISOString()):HistoryEntry[]{
 const existing=entries.find(entry=>entry.posting.trim()===posting.trim());
 const row:HistoryEntry={id:existing?.id??globalThis.crypto.randomUUID(),posting,role:result.role_title,company:existing?.company??'',score:result.score,
 eligibility_pending:result.requirements.filter(item=>item.kind==='eligibility'&&item.status!=='documented').length,
 analysed_at:at,analyses:(existing?.analyses??0)+1,status:existing?.status??'analysed',sent_at:existing?.sent_at??null,notes:existing?.notes??''};
 return [row,...entries.filter(entry=>entry.id!==row.id)].slice(0,100);
}
