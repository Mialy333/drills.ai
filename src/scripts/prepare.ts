import { z } from 'zod';
import { apiEndpoint } from '../lib/api-client';
import { readApplicationState, saveApplicationState } from '../lib/application-state';
const fr=document.documentElement.lang==='fr';
const say=(f:string,e:string)=>fr?f:e;
const el=<T extends HTMLElement>(id:string)=>document.getElementById('practice-'+id) as T;
const field=el<HTMLTextAreaElement>('text');
const consent=el<HTMLInputElement>('consent');
const audio=el<HTMLAudioElement>('audio');
const record=el<HTMLButtonElement>('record');
const stop=el<HTMLButtonElement>('stop');
const transcribe=el<HTMLButtonElement>('transcribe');
const review=el<HTMLButtonElement>('review');
const draft=el<HTMLButtonElement>('use-draft');
const note=(message:string)=>{el('status').textContent=message;};
const state=()=>{try{return readApplicationState(sessionStorage,localStorage);}catch{return null;}};
const saved=state();field.value=saved?.practice_text ?? '';
el('context').textContent=saved?.result?say('Poste ciblé : ','Target role: ')+saved.result.role_title:say('Prépare ton profil et colle une annonce dans Ma candidature pour un retour personnalisé.','Add your profile and a posting in My application for tailored feedback.');
function persist(){const current=state();if(current){if(!saveApplicationState({...current,practice_text:field.value},sessionStorage,localStorage))note(say('Le texte ne peut pas être enregistré. Copie-le avant de quitter.','Text cannot be saved. Copy it before leaving.'));}}
const criterion=z.object({observation:z.string().min(5).max(700),next_action:z.string().min(5).max(500)});
const feedbackSchema=z.object({clarity:criterion,evidence:criterion,relevance:criterion,follow_up_question:z.string().min(10).max(500)});
let recorder:MediaRecorder|null=null, stream:MediaStream|null=null, blob:Blob|null=null, objectUrl='';
let clock:number|undefined, started=0, recording=false, pending=false, epoch=0;
let active:AbortController|null=null;
const supported=!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder!=='undefined';
function controls(){record.disabled=!supported||pending||recording||!!active;stop.hidden=!recording;transcribe.disabled=!blob||recording||!!active;review.disabled=recording||pending||!!active;draft.disabled=recording||!!active;}
function release(){stream?.getTracks().forEach(track=>track.stop());stream=null;window.clearInterval(clock);}
function clearAudio(){if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';blob=null;audio.removeAttribute('src');audio.hidden=true;}
function finish(){if(recorder?.state==='recording')recorder.stop();release();recording=false;controls();}
controls();
if(!supported)note(say('Micro non disponible dans ce navigateur. Tu peux écrire ou coller ton pitch.','Microphone unavailable in this browser. You can type or paste your pitch.'));
record.addEventListener('click',async()=>{
 if(record.disabled)return;
 pending=true;controls();const attempt=++epoch;
 try{
  const media=await navigator.mediaDevices.getUserMedia({audio:true});
  if(attempt!==epoch){media.getTracks().forEach(track=>track.stop());return;}
  stream=media;
  const mime=['audio/webm;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime)throw new Error('format');
  clearAudio();const chunks:BlobPart[]=[];let size=0;
  recorder=new MediaRecorder(media,{mimeType:mime});
  recorder.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);size+=event.data.size;if(size>8*1024*1024)finish();}};
  recorder.onstop=()=>{
   if(attempt!==epoch)return;
   release();recording=false;
   if(!size||size>8*1024*1024){note(say('Enregistrement vide ou trop volumineux. Essaie un pitch plus court.','Recording is empty or too large. Try a shorter pitch.'));controls();return;}
   blob=new Blob(chunks,{type:mime.split(';')[0]});objectUrl=URL.createObjectURL(blob);audio.src=objectUrl;audio.hidden=false;controls();
   note(say('Enregistrement prêt. Écoute-le, puis coche ton accord pour le transcrire.','Recording ready. Listen, then give consent to transcribe it.'));
  };
  recorder.onerror=()=>{finish();note(say('Enregistrement interrompu. Tu peux écrire ton pitch.','Recording interrupted. You can type your pitch.'));};
  recorder.start(1000);recording=true;started=Date.now();
  el('timer').textContent='0 / 90 s';
  clock=window.setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);el('timer').textContent=`${seconds} / 90 s`;if(seconds>=90)finish();},500);
  note(say('Enregistrement local en cours…','Recording locally…'));
 }catch{release();note(say('Micro refusé ou indisponible. Autorise-le dans le navigateur ou écris ton pitch.','Microphone denied or unavailable. Allow it in your browser or type your pitch.'));}
 finally{pending=false;controls();}
});
stop.addEventListener('click',finish);
async function call(path:'/api/interview/transcribe'|'/api/interview/feedback',payload:unknown):Promise<unknown>{
 const endpoint=apiEndpoint(path);if(!endpoint)throw new Error('unavailable');
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:active!.signal,cache:'no-store'});
 if(!response.ok)throw new Error(String(response.status));return response.json();
}
async function run(task:()=>Promise<void>,message:string){
 if(active||recording)return;
 if(!consent.checked){note(say('Coche ton accord avant l’envoi à OpenAI.','Give consent before sending to OpenAI.'));return;}
 const request=new AbortController();active=request;controls();note(message);const timer=window.setTimeout(()=>request.abort(),100000);
 try{await task();}catch(error){if(active===request)note(error instanceof Error && error.message==='429'?say('Limite temporaire atteinte. Ton texte est conservé ; réessaie plus tard.','Temporary limit reached. Your text is preserved; try later.'):say('Le service n’a pas abouti. Ton texte est conservé ; réessaie ou utilise la grille des cas ci-dessous.','The service did not complete. Your text is preserved; retry or use the case rubrics below.'));}
 finally{window.clearTimeout(timer);if(active===request)active=null;controls();}
}
transcribe.addEventListener('click',()=>{
 if(!blob)return;
 if(field.value.trim()&&!window.confirm(say('Remplacer le texte actuel par la transcription ?','Replace the current text with the transcript?')))return;
 const recordingBlob=blob;const current=epoch;
 void run(async()=>{
  const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(recordingBlob);});
  if(current!==epoch)return;
  const result=z.object({text:z.string().min(1).max(6000)}).parse(await call('/api/interview/transcribe',{audio_base64:encoded,media_type:recordingBlob.type,consent:true}));
  if(current!==epoch)return;
  field.value=result.text;el('feedback').replaceChildren();persist();note(say('Transcription prête. Corrige les noms et les chiffres, puis demande ton retour.','Transcript ready. Correct names and numbers, then request feedback.'));
 },say('Transcription avec OpenAI…','Transcribing with OpenAI…'));
});
review.addEventListener('click',()=>{
 const currentState=state();
 if(!currentState||currentState.profile.trim().length<50||currentState.posting.trim().length<50){note(say('Ajoute ton profil et une annonce dans Ma candidature avant ce retour.','Add your profile and a posting in My application before requesting feedback.'));return;}
 if(field.value.trim().length<50){note(say('Écris au moins 50 caractères pour obtenir un retour utile.','Write at least 50 characters for useful feedback.'));return;}
 const transcript=field.value;const current=epoch;el('feedback').replaceChildren();
 void run(async()=>{
  const feedback=feedbackSchema.parse(await call('/api/interview/feedback',{candidate_text:currentState.profile,job_description:currentState.posting,transcript,output_language:fr?'fr':'en',consent:true}));
  if(current!==epoch)return;
  if(transcript!==field.value){note(say('Le texte a changé. Relance le retour sur ta nouvelle version.','Text changed. Request feedback on your new version.'));return;}
  for(const [key,title] of [['clarity',say('Clarté du parcours','Clarity')],['evidence',say('Preuves concrètes','Concrete evidence')],['relevance',say('Lien avec le poste','Relevance to the role')]] as const){
   const card=document.createElement('section');const heading=document.createElement('h3');heading.textContent=title;
   const observation=document.createElement('p');observation.textContent=feedback[key].observation;
   const action=document.createElement('p');action.textContent=say('À essayer : ','Try: ')+feedback[key].next_action;card.append(heading,observation,action);el('feedback').append(card);
  }
  const question=document.createElement('p');question.textContent=say('Question de relance : ','Follow-up question: ')+feedback.follow_up_question;el('feedback').append(question);
  note(say('Retour prêt. Choisis une amélioration, puis refais ton pitch avec tes mots.','Feedback ready. Pick one improvement, then rehearse again in your own words.'));
 },say('Analyse du contenu de ton pitch…','Reviewing your pitch content…'));
});
field.addEventListener('input',()=>{el('feedback').replaceChildren();persist();});
draft.addEventListener('click',()=>{
 const prepared=state()?.pitch;if(!prepared){note(say('Prépare d’abord ta candidature pour obtenir un pitch.','Prepare your application first to get a pitch.'));return;}
 if(field.value.trim()&&!window.confirm(say('Remplacer ton texte par le pitch préparé ?','Replace your text with the prepared pitch?')))return;
 field.value=prepared;field.dispatchEvent(new Event('input'));note(say('Pitch repris. Adapte-le à ta manière de parler.','Draft loaded. Adapt it to how you speak.'));
});
function cleanup(){epoch++;active?.abort();active=null;finish();clearAudio();}
el('clear').addEventListener('click',()=>{cleanup();field.value='';el('feedback').replaceChildren();el('timer').textContent='';persist();controls();note(say('Entraînement effacé. Ton dossier reste intact.','Rehearsal cleared. Your application is unchanged.'));});
window.addEventListener('pagehide',cleanup);
