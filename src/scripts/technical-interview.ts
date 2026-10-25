import { z } from 'zod';
import { apiEndpoint } from '../lib/api-client';
import { locale, translator } from '../lib/locale';
import catalog from '../lib/interview-cases.json';
const language=locale(document.documentElement.lang),say=translator(language);
const schema=z.object({case_id:z.string(),rubric_version:z.number(),criteria:z.array(z.object({
 criterion_index:z.number().int().min(0).max(3),status:z.enum(['met','partial','missing','incorrect']),
 answer_quote:z.string().nullable(),explanation:z.string().min(5).max(600),next_action:z.string().min(5).max(400),
})).length(4)});
const labels={met:say('Correct pour ce critère','Meets this criterion'),partial:say('À compléter','Partially addressed'),missing:say('Non abordé','Not addressed'),incorrect:say('À corriger','Needs correction')};
const node=(tag:string,value:string)=>{const element=document.createElement(tag);element.textContent=value;return element;};
for(const card of document.querySelectorAll<HTMLElement>('[data-interview-case]')){
 const item=catalog.cases.find(item=>item.id===card.dataset.interviewCase)!;
 const answer=card.querySelector<HTMLTextAreaElement>('textarea')!;
 const consent=card.querySelector<HTMLInputElement>('[data-technical-consent]')!;
 const review=card.querySelector<HTMLButtonElement>('[data-technical-review]')!;
 const cancel=card.querySelector<HTMLButtonElement>('[data-technical-cancel]')!;
 const status=card.querySelector<HTMLElement>('[data-technical-status]')!;
 const feedback=card.querySelector<HTMLElement>('[data-technical-feedback]')!;
 let active:AbortController|null=null,last:{answer:string,data:z.infer<typeof schema>}|null=null;
 function render(data:z.infer<typeof schema>){
  feedback.replaceChildren();
  const count=data.criteria.filter(row=>row.status==='met').length;
  feedback.append(node('h3',say(`${count} critère(s) sur 4 correctement abordé(s)`,`${count} of 4 criteria addressed correctly`)));
  for(const row of data.criteria){
   const section=document.createElement('details');section.className='technical-result';section.dataset.result=row.status;
   section.append(node('summary',`${labels[row.status]} · ${item[language].criteria[row.criterion_index]}`));
   if(row.answer_quote)section.append(node('blockquote',row.answer_quote));
   section.append(node('p',row.explanation),node('p',say('À essayer : ','Try: ')+row.next_action));feedback.append(section);
  }
  status.textContent=say('Retour prêt. Ouvre un critère pour comprendre, puis améliore ta réponse.','Feedback ready. Open a criterion to understand it, then improve your answer.');
 }
 function stop(){active?.abort();active=null;review.disabled=false;cancel.hidden=true;}
 answer.addEventListener('input',()=>{stop();feedback.replaceChildren();status.textContent=say('Réponse modifiée : relance la vérification quand tu es prête ou prêt.','Answer changed: review again when ready.');});
 cancel.addEventListener('click',()=>{stop();status.textContent=say('Vérification annulée. Ta réponse est conservée.','Review cancelled. Your answer is preserved.');});
 window.addEventListener('pagehide',stop);
 review.addEventListener('click',async()=>{
  if(active)return;
  const text=answer.value.trim();
  if(text.length<50){status.textContent=say('Explique ton raisonnement en au moins 50 caractères.','Explain your reasoning in at least 50 characters.');answer.focus();return;}
  if(!consent.checked){status.textContent=say('Coche ton accord avant d’envoyer ta réponse.','Give consent before sending your answer.');consent.focus();return;}
  if(last?.answer===text){render(last.data);return;}
  const controller=new AbortController();active=controller;review.disabled=true;cancel.hidden=false;feedback.replaceChildren();
  status.textContent=say('Comparaison avec les quatre critères…','Comparing with the four criteria…');
  const timeout=window.setTimeout(()=>controller.abort(),100_000);
  try{
   const endpoint=apiEndpoint('/api/interview/technical');if(!endpoint)throw new Error('unconfigured');
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({case_id:item.id,answer:text,output_language:language,consent:true}),signal:controller.signal});
   if(!response.ok)throw new Error(String(response.status));
   const data=schema.parse(await response.json());
   if(active!==controller||controller.signal.aborted)return;
   if(data.case_id!==item.id||data.rubric_version!==catalog.version||new Set(data.criteria.map(row=>row.criterion_index)).size!==4)throw new Error('invalid');
   for(const row of data.criteria){if(row.status==='missing'?row.answer_quote!==null:!row.answer_quote?.trim()||!text.includes(row.answer_quote))throw new Error('invalid');}
   data.criteria.sort((a,b)=>a.criterion_index-b.criterion_index);last={answer:text,data};render(data);
  }catch(error){
   if(active===controller)status.textContent=error instanceof Error&&error.message==='429'
    ?say('Trop de demandes rapprochées. Patiente avant de réessayer ; le corrigé reste accessible.','Too many requests. Wait before retrying; the example answer remains available.')
    :say('Le retour n’a pas pu être obtenu ou vérifié. Ta réponse est conservée : utilise le corrigé ci-dessous ou réessaie.','Feedback could not be retrieved or validated. Your answer is preserved: use the example below or retry.');
  }finally{window.clearTimeout(timeout);if(active===controller)stop();}
 });
}
