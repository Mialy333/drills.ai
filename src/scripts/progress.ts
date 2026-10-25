import { readApplicationState, saveApplicationState } from '../lib/application-state';
import { recordAnalysis } from '../lib/application-history';
import { locale, translator } from '../lib/locale';
const language=locale(document.documentElement.lang),say=translator(language);
const el=(id:string)=>document.getElementById('tracking-'+id)!;
let state=readApplicationState(sessionStorage,localStorage);
if(state?.result&&!state.history){state={...state,history:recordAnalysis([],state.posting,state.result,null)};saveApplicationState(state,sessionStorage,localStorage);}
let page=0;
const labels={analysed:say('Analysée','Assessed'),sent:say('Envoyée','Sent'),interview:say('Entretien','Interview'),offer:say('Offre reçue','Offer received'),rejected:say('Refus','Rejected')};
const text=(tag:string,value:string)=>{const node=document.createElement(tag);node.textContent=value;return node;};
function render(){
 const rows=state?.history??[];const sent=rows.filter(row=>row.sent_at).length;
 el('profile').textContent=state&&state.profile.trim().length>=50?say('Oui','Yes'):say('À compléter','Incomplete');
 el('analysed').textContent=String(rows.length);el('sent').textContent=String(sent);el('interviews').textContent=String(rows.filter(row=>row.status==='interview').length);
 const pending=rows.filter(row=>row.status==='analysed').length;
 el('next').textContent=pending?say(`${pending} offre(s) analysée(s) : prépare un envoi ou note ta décision.`,`${pending} assessed opening(s): prepare an application or record your decision.`):say('Choisis une offre pour avancer dans ta recherche.','Choose an opening to move your search forward.');
 const list=el('list');list.replaceChildren();
 for(const row of rows.slice(page*6,page*6+6)){
  const card=document.createElement('details');card.append(text('summary',`${row.role}${row.company?' · '+row.company:''} — ${labels[row.status]}`));
  card.append(text('p',row.eligibility_pending?say(`${row.eligibility_pending} condition(s) à confirmer`,`${row.eligibility_pending} condition(s) to confirm`):row.score===null?say('Périmètre à vérifier','Scope to review'):`${row.score} % · ${say('compétences documentées','documented skills')}`));
  card.append(text('p',row.analysed_at?say('Dernière analyse : ','Last assessed: ')+new Date(row.analysed_at).toLocaleDateString(language):say('Analyse antérieure importée','Earlier assessment imported')));
  if(row.sent_at)card.append(text('p',say('Envoi déclaré : ','Submission recorded: ')+new Date(row.sent_at).toLocaleDateString(language)));
  const company=document.createElement('input');company.value=row.company;company.maxLength=160;
  const notes=document.createElement('textarea');notes.value=row.notes;notes.maxLength=3000;notes.rows=3;
  const status=document.createElement('select');for(const [key,label] of Object.entries(labels)){const option=document.createElement('option');option.value=key;option.textContent=label;option.selected=key===row.status;status.append(option);}
  for(const [label,input] of [[say('Entreprise','Company'),company],[say('Statut','Status'),status],[say('Notes et prochaine action','Notes and next action'),notes]] as const){const wrapper=document.createElement('label');wrapper.append(document.createTextNode(label),input);card.append(wrapper);}
  const save=text('button',say('Enregistrer','Save')) as HTMLButtonElement;save.type='button';save.className='btn btn-secondary';
  save.addEventListener('click',()=>{
   const latest=readApplicationState(sessionStorage,localStorage);if(!latest)return;
   const nextStatus=status.value as typeof row.status;
   const history=(latest.history??[]).map(item=>item.id===row.id?{...item,company:company.value,notes:notes.value,status:nextStatus,sent_at:nextStatus==='analysed'?null:nextStatus==='sent'?(item.sent_at??new Date().toISOString()):item.sent_at}:item);
   const updated={...latest,history};
   if(saveApplicationState(updated,sessionStorage,localStorage)){state=updated;render();el('status').textContent=say('Suivi enregistré.','Tracker saved.');}else el('status').textContent=say('Enregistrement impossible. Copie tes notes avant de quitter.','Cannot save. Copy your notes before leaving.');
  });card.append(save);list.append(card);
 }
 if(!rows.length)list.append(text('p',say('Ton premier diagnostic apparaîtra ici.','Your first assessment will appear here.')));
 const pages=Math.max(1,Math.ceil(rows.length/6));el('page').textContent=`${page+1} / ${pages}`;
 (el('previous') as HTMLButtonElement).disabled=page===0;(el('next-page') as HTMLButtonElement).disabled=page>=pages-1;
}
el('previous').addEventListener('click',()=>{page--;render();});el('next-page').addEventListener('click',()=>{page++;render();});render();
