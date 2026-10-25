import { deleteCandidateProfile } from '../lib/candidate-profile';
import { clearApplicationState, readApplicationState } from '../lib/application-state';
import { locale, translator } from '../lib/locale';
const say=translator(locale(document.documentElement.lang));
try{
 if(new URL(location.href).searchParams.get('reset')==='1'){
  clearApplicationState(sessionStorage,localStorage);deleteCandidateProfile();
  const url=new URL(location.href);url.searchParams.delete('reset');history.replaceState(null,'',url);
  document.getElementById('home-resume-note')!.textContent=say('Dossier effacé sur ce navigateur. Tu peux recommencer.','Application cleared in this browser. You can start again.');
 }
 const saved=readApplicationState(sessionStorage,localStorage);
 if(saved&&saved.profile.trim().length>=50){
  const link=document.getElementById('home-start') as HTMLAnchorElement;
  const url=new URL(link.href);url.searchParams.set('step',saved.result?(saved.reviewed?'documents':'diagnostic'):'posting');link.href=url.href;
  link.textContent=say('Reprendre ma candidature →','Resume my application →');
  document.getElementById('home-edit-profile')!.hidden=false;
  document.getElementById('home-resume-note')!.textContent=say('Ton profil est déjà prêt sur ce navigateur. Reprends là où tu en étais.','Your profile is ready in this browser. Continue where you left off.');
 }
}catch{/* Start remains available when storage is blocked. */}
