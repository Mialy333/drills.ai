import { applicationUrl, profileWithEligibility } from '../lib/application-context';
import { recordAnalysis, type HistoryEntry } from "../lib/application-history";
import { locale, translator, cvHeading } from "../lib/locale";
import { fetchGithubProject } from "../lib/github-project";
import { createCvEditor, cleanCvHtml } from "../lib/cv-editor";
import { apiEndpoint } from "../lib/api-client";
import { applicationDraftChanged, ApplicationResultSchema, type ApplicationResult } from "../lib/application";
import { readApplicationState, saveApplicationState, clearApplicationState } from "../lib/application-state";
import { readCandidateProfile, deleteCandidateProfile } from "../lib/candidate-profile";

const language = locale(document.documentElement.lang);
const fr = language === "fr";
const say = translator(language);
const element = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const form = element<HTMLFormElement>("application-form");
const requestedStep = new URLSearchParams(location.search).get("step");
let profileMode = requestedStep === "profile";
let historyRows: HistoryEntry[] = [];
const fields = element<HTMLFieldSetElement>("application-inputs");
const profile = element<HTMLTextAreaElement>("application-profile");
const posting = element<HTMLTextAreaElement>("application-posting");
const postingUrl=element<HTMLInputElement>('application-posting-url');
let linkedPosting='';
const residence=element<HTMLInputElement>('application-residence');
const workCountry=element<HTMLInputElement>('application-work-country');
const workAuthorization=element<HTMLSelectElement>('application-work-authorization');
const candidateProfile=()=>profileWithEligibility(profile.value,residence.value,workCountry.value,workAuthorization.value);
function renderApplyLink(){
 const url=applicationUrl(postingUrl.value);const link=element<HTMLAnchorElement>('application-apply-link');link.hidden=!url;
 if(url)link.href=url;else link.removeAttribute('href');
 element('application-apply-note').textContent=url?say('Destination : ','Destination: ')+new URL(url).hostname:say('Ajoute le lien de candidature dans Opportunités pour retrouver le site où postuler.','Add the application link in Opportunities to return to the application website.');
}
const consent = element<HTMLInputElement>("application-consent");
const pdf = element<HTMLInputElement>("application-pdf");
const results = element<HTMLElement>("application-results");
const cv = element<HTMLTextAreaElement>("application-cv");
const pitch = element<HTMLTextAreaElement>("application-pitch");
const contact = element<HTMLTextAreaElement>("application-contact");
const reviewed = element<HTMLInputElement>("application-reviewed");
const cancel = element<HTMLButtonElement>("application-cancel");
const printButton = element<HTMLButtonElement>("application-print-button");
const download = element<HTMLButtonElement>("application-download");
const remember = element<HTMLInputElement>("application-remember");
const editor = element<HTMLDetailsElement>("application-profile-editor");
const cvEditor = createCvEditor(element("cv-rich-editor"), cv, element("cv-toolbar"));
let currentResult: ApplicationResult | null = null;
let controller: AbortController | null = null;

function profileSummary(): void {
  element("application-profile-summary").textContent = profile.value.trim().length >= 50
    ? say("Profil prêt : il sera réutilisé pour cette annonce. Tu peux le consulter ou le corriger ci-dessous.", "Profile ready: it will be reused for this posting. You can view or edit it below.")
    : say("Importe ton CV ou ouvre la saisie manuelle. Aucun texte supplémentaire n’est demandé après l’import.", "Import your CV or open manual entry. No additional text is required after import.");
}
function persist(): boolean {
  profileSummary();
  try {
    const saved = saveApplicationState({posting_url:postingUrl.value,residence:residence.value,work_country:workCountry.value,work_authorization:workAuthorization.value as "unknown"|"yes"|"restricted"|"sponsorship",history:historyRows, version: 1, expiresAt: Date.now() + (remember.checked ? 30 : 1) * 86400000,
      practice_text: readApplicationState(sessionStorage,localStorage)?.practice_text, contact: contact.value, profile: profile.value, posting: posting.value, result: currentResult, cv: cv.value, cv_html: cvEditor.html(), pitch: pitch.value,
      reviewed: reviewed.checked, remember: remember.checked}, sessionStorage, localStorage);
    if (!saved) status(say("Le stockage est indisponible. Garde cet onglet ouvert et exporte tes textes avant de quitter.", "Storage is unavailable. Keep this tab open and export your text before leaving."));
    return saved;
  } catch { status(say("Le stockage est indisponible : ce dossier restera uniquement dans la page ouverte.", "Storage is unavailable: this application will remain only in the open page.")); return false; }
}
let inputSnapshot: { profile: string; posting: string } | null = null;

function status(message: string): void { element("application-status").textContent = message; }
function resetResults(): void {
  results.hidden = true;
  currentResult = null;
  reviewed.checked = false;
  printButton.disabled = download.disabled = true;
  cvEditor.setText(""); pitch.value = "";
  inputSnapshot = null;
  for (const id of ["application-evidence", "application-print-text"]) element(id).replaceChildren();
}
function busy(value: boolean): void { fields.disabled = value; cancel.hidden = !value; form.setAttribute("aria-busy", String(value)); }
function text(tag: string, value: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

async function post(path: "/api/application" | "/api/profile-import", body: unknown, signal: AbortSignal): Promise<unknown> {
  const endpoint = apiEndpoint(path);
  if (!endpoint) throw new Error("unavailable");
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body), signal, cache: "no-store",
  });
  if (response.status === 429) throw new Error("limited");
  if (response.status === 503) throw new Error("unavailable");
  if (response.status === 422) throw new Error("invalid-input");
  if (response.status === 504) throw new DOMException("Timeout", "AbortError");
  if (response.status === 502) {
    const failure = await response.json().catch(() => null);
    const code = failure?.detail?.code;
    if (["evidence_validation", "model_incomplete", "model_unparsed"].includes(code)) throw new Error(code);
    throw new Error("validation");
  }
  if (!response.ok) throw new Error("failed");
  return response.json();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "evidence_validation") return say("Le CV est conservé, mais les citations de l’analyse n’ont pas pu être validées après une tentative de correction. Aucun score n’a été affiché. Tu peux relancer le diagnostic sans réimporter ton CV.", "Your CV is preserved, but analysis citations could not be validated after one repair attempt. No score was shown. You can retry without importing your CV again.");
  if (error instanceof Error && ["model_incomplete", "model_unparsed"].includes(error.message)) return say("L’IA n’a pas renvoyé une analyse complète exploitable. Ton profil et ton annonce sont conservés ; relance uniquement le diagnostic.", "AI did not return a complete usable analysis. Your profile and posting are preserved; retry the assessment only.");
  if (error instanceof Error && error.message === "invalid-pdf") return say("Choisis un PDF non vide de 4 Mio maximum.", "Choose a non-empty PDF of at most 4 MiB.");
  if (error instanceof Error && error.message === "unreadable-pdf") return say("Le texte du CV n’a pas pu être extrait correctement. Essaie un PDF avec du texte sélectionnable, ou utilise la saisie manuelle.", "CV text could not be extracted. Try a PDF with selectable text or use manual entry.");
  if (error instanceof TypeError) return say("Impossible de joindre le service. Vérifie que le serveur DRILLS est démarré, puis réessaie. Ton profil est conservé.", "Cannot reach the service. Check that the DRILLS server is running, then try again. Your profile is preserved.");
  if (error instanceof Error && error.message === "invalid-input") return say("Le document ou le texte envoyé n’est pas valide. Vérifie le PDF et colle l’annonce complète.", "The document or text is invalid. Check the PDF and paste the full posting.");
  if (error instanceof DOMException && error.name === "AbortError") return say("Préparation annulée ou délai dépassé. Tes champs sont conservés.", "Preparation cancelled or timed out. Your fields are preserved.");
  if (error instanceof Error && error.message === "limited") return say("Le service a atteint sa limite temporaire. Réessaie plus tard ; tes champs sont conservés.", "The service reached its temporary limit. Try later; your fields are preserved.");
  if (error instanceof Error && error.message === "unavailable") return say("La préparation IA n’est pas disponible pour le moment. Tes champs sont conservés.", "AI preparation is currently unavailable. Your fields are preserved.");
  return say("La préparation n’a pas abouti ou les sources n’ont pas pu être validées. Vérifie tes textes puis réessaie.", "Preparation failed or the sources could not be validated. Check your text and try again.");
}

async function perform(task: (signal: AbortSignal) => Promise<void>, message: string): Promise<void> {
  if (controller) return;
  const active = new AbortController();
  controller = active;
  busy(true);
  status(message);
  const timeout = window.setTimeout(() => active.abort(), 200_000);
  try { await task(active.signal); }
  catch (error) { if (controller === active) status(errorMessage(error)); }
  finally {
    window.clearTimeout(timeout);
    if (controller === active) { controller = null; busy(false); }
  }
}

function render(result: ApplicationResult): void {
  currentResult = result; renderApplyLink();
  element("application-target-role").textContent=say("Ta candidature : ","Your application: ")+result.role_title;
  element("application-result-title").textContent = result.role_title;
  element("application-scope").textContent = result.scope_reason;
  const conditions=result.requirements.filter(item=>item.kind==='eligibility'&&item.status!=='documented');
  element("application-score").textContent = conditions.length
    ? say(`${conditions.length} condition(s) de candidature à confirmer`, `${conditions.length} application condition(s) to confirm`)
    : result.score === null
    ? say("Périmètre à vérifier — score non affiché", "Scope needs review — score not shown")
    : `${result.score} % · ${say("couverture documentée des compétences", "documented skill coverage")}`;
  element("application-decision").textContent = result.decision === "prepare"
    ? say("Prépare ta candidature en vérifiant les preuves et les conditions ci-dessous.", "Prepare your application, reviewing the evidence and conditions below.")
    : result.decision === "strengthen"
      ? say("Renforce ou précise les points ci-dessous. Tu peux quand même préparer ta candidature : ce bilan ne décide pas à ta place.", "Strengthen or clarify the points below. You can still prepare your application: this assessment does not decide for you.")
      : say("Vérifie le niveau et les missions : cette annonce n’est pas clairement dans le périmètre premier poste Agent Engineer.", "Review the level and duties: this posting is not clearly within the first Agent Engineer role scope.");
  const evidence = element("application-evidence");
  evidence.replaceChildren(...[...result.requirements].sort((a,b)=>Number(b.kind==='eligibility')-Number(a.kind==='eligibility')).map((item) => {
    const card = document.createElement("details"); card.className="evidence-card";
    card.dataset.evidence = item.status;
    const state = { documented: item.kind==='eligibility'?say("Déclaré dans ton profil", "Declared in your profile"):say("Documenté", "Documented"), partial: say("Partiel", "Partial"), not_documented: say("Non documenté", "Not documented") }[item.status];
    const priority = { core: say("Essentielle", "Core"), important: say("Importante", "Important"), supporting: say("Complémentaire", "Supporting") }[item.priority];
    const badge = text("span", state); badge.className = "evidence-badge";
    const meaning = { documented: say("Une preuve figure dans ton profil. Mets cette contribution en valeur dans ta candidature.", "Your profile contains evidence. Highlight this contribution in your application."), partial: say("Ton profil couvre une partie du besoin. Précise ta contribution ou ajoute une preuve.", "Your profile covers part of this requirement. Clarify your contribution or add evidence."), not_documented: say("Aucune preuve suffisante dans les éléments fournis : cela ne signifie pas que tu ne sais pas le faire.", "No sufficient evidence in the supplied information: this does not mean you cannot do it.") }[item.status];
    const summary=document.createElement('summary');summary.append(badge,document.createTextNode(' '+item.name));card.append(summary);
    card.append( text("p", meaning), text("small", `${item.kind === "eligibility" ? say("Condition à vérifier", "Condition to review") : say("Compétence", "Skill")} · ${priority}`), text("p", item.explanation));
    const action = text("p", `${say("Prochaine action", "Next action")} : ${item.next_action}`); action.className = "evidence-action";
    card.append(action);
    return card;
  }));
  cvEditor.setSections(result.cv_sections);
  element("cv-role-title").textContent = result.role_title;
  pitch.value = result.pitch.text;
  reviewed.checked = false;
  printButton.disabled = download.disabled = true;
  setStep("diagnostic");
  element("application-result-title").focus();
}

async function extractProfile(file: File, signal: AbortSignal): Promise<void> {
  if ((!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") || file.size > 4 * 1024 * 1024 || file.size === 0) throw new Error("invalid-pdf");
  status(say("Étape 1/2 · Lecture de ton CV…", "Step 1/2 · Reading your CV…"));
  const encoded = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("file"));
    reader.readAsDataURL(file);
  });
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const raw = await post("/api/profile-import", { pdf_base64: encoded, consent: true }, signal);
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  if (!raw || typeof raw !== "object" || !("candidate_text" in raw) || typeof raw.candidate_text !== "string" || raw.candidate_text.trim().length < 50 || raw.candidate_text.length > 16000) throw new Error("unreadable-pdf");
  resetResults();
  profile.value = raw.candidate_text;
  pdf.value = ""; element("application-file-name").textContent=say("Aucun fichier sélectionné", "No file selected");
  editor.open = false;
  persist();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (controller) return;
  if(workAuthorization.value!=='unknown'&&!workCountry.value.trim()){setStep('profile');workCountry.closest('details')!.open=true;status(say('Précise le pays concerné par ton droit de travailler.','Specify the country covered by your right to work.'));workCountry.focus();return;}
  if(postingUrl.value.trim()&&!applicationUrl(postingUrl.value)){status(say('Le lien doit être une adresse HTTPS valide.','Enter a valid HTTPS link.'));return;}
  if (profileMode && !pdf.files?.length && profile.value.trim().length>=50) { if(persist()) setStep('posting'); return; }
  if (!consent.checked) { consent.reportValidity(); status(say("Confirme l’envoi à l’IA avant de continuer.", "Confirm sharing with AI before continuing.")); return; }
  const file = pdf.files?.[0];
  const job = posting.value.trim();
  if (!profileMode && job.length < 50) {
    status(say("Colle le texte complet de l’annonce (50 caractères minimum).", "Paste the full posting (at least 50 characters).")); posting.focus(); return;
  }
  if (!file && profile.value.trim().length < 50) {
    setStep('profile'); editor.open = true;
    status(say("Ajoute ton CV PDF ou renseigne ton profil une seule fois. Aucun profil exploitable n’est encore enregistré.", "Add your PDF CV or enter your profile once. No usable profile has been saved yet.")); profile.focus(); return;
  }
  void perform(async (signal) => {
    if (file) await extractProfile(file, signal);
    if (profileMode) {
      if (!persist()) return;
      setStep('posting'); status(say('Profil prêt. Choisis ou colle une annonce.', 'Profile ready. Choose or paste a posting.')); return;
    }
    const candidate = candidateProfile();
    if(candidate.length>16000){status(say('Raccourcis ton profil pour inclure tes conditions de candidature (16 000 caractères au total).','Shorten your profile to include eligibility details (16,000 characters total).'));return;}
    resetResults(); persist();
    status(say("Étape 2/2 · Comparaison de ton profil avec l’annonce et préparation de ta candidature…", "Step 2/2 · Comparing your profile with the posting and preparing your application…"));
    const raw = await post("/api/application", { candidate_text: candidate, job_description: job, output_language: fr ? "fr" : "en", consent: true }, signal);
    if (signal.aborted) return;
    const result = ApplicationResultSchema.parse(raw);
    if (result.output_language !== (fr ? "fr" : "en")) throw new Error("language");
    inputSnapshot = { profile: candidate, posting: job };
    historyRows=recordAnalysis(historyRows,job,result,undefined,applicationUrl(postingUrl.value)??undefined);
    render(result); persist();
    status(say("Diagnostic prêt. Vérifie les preuves et les textes proposés, notamment les informations extraites du CV.", "Assessment ready. Review the evidence and drafts, including the information extracted from your CV."));
    element("application-page").scrollIntoView?.({behavior:"smooth",block:"start"});
  }, say("Préparation de ton dossier…", "Preparing your application…"));
});

element("application-import").addEventListener("click", () => {
  if (!consent.checked) { consent.reportValidity(); status(say("Coche ton accord ci-dessous, puis clique sur « Extraire le texte du CV » ou « Obtenir mon diagnostic ».", "Check your consent below, then click Extract CV text or Get my assessment.")); return; }
  const file = pdf.files?.[0];
  if (!file) { status(say("Sélectionne un CV PDF à importer.", "Select a PDF CV to import.")); return; }
  void perform(async signal => {
    await extractProfile(file, signal);
    status(say("CV importé. Tu peux le relire, puis lancer ton diagnostic sans ressaisir ton parcours.", "CV imported. Review it, then start your assessment without re-entering your experience."));
  }, say("Lecture du CV…", "Reading CV…"));
});

element("application-example").addEventListener("click", () => {
  pdf.value = ""; element("application-file-name").textContent=say("Aucun fichier sélectionné", "No file selected");
  resetResults();
  profile.value = fr
    ? "PROFIL FICTIF — EXEMPLE DE DÉMONSTRATION\n2020–2024 : analyste opérations. J’ai documenté les étapes de traitement des demandes clients et coordonné la résolution d’incidents.\n2025 : formation en développement web, projets JavaScript et API REST.\nProjet personnel : j’ai construit une API Python avec FastAPI, validé les entrées avec Pydantic et écrit des tests pytest. J’ai ajouté un appel OpenAI pour classer des demandes. Je n’ai pas encore déployé ce projet ni utilisé LangGraph."
    : "FICTIONAL PROFILE — DEMONSTRATION EXAMPLE\n2020–2024: operations analyst. I documented customer request workflows and coordinated incident resolution.\n2025: web development training, JavaScript projects and REST APIs.\nPersonal project: I built a Python API with FastAPI, validated inputs with Pydantic and wrote pytest tests. I added an OpenAI call to classify requests. I have not deployed this project or used LangGraph yet.";
  posting.value = fr
    ? "ANNONCE FICTIVE — EXEMPLE DE DÉMONSTRATION\nStage AI Agent Engineer à Paris. Missions : construire un agent qui classe les demandes et appelle une API métier, tester les erreurs et documenter le workflow. Python et API REST indispensables ; tests automatisés importants. LangGraph est un plus. Stage de six mois, disponibilité à confirmer."
    : "FICTIONAL POSTING — DEMONSTRATION EXAMPLE\nAI Agent Engineer internship in Paris. Build an agent that classifies requests and calls a business API, test failure cases and document the workflow. Python and REST APIs are essential; automated tests are important. LangGraph is a bonus. Six-month internship; availability to be confirmed.";
  consent.checked = false;
  editor.open = true;
  persist();
  status(say("Exemple fictif chargé. Une analyse réelle via OpenAI sera effectuée après ton accord.", "Fictional example loaded. A real OpenAI analysis will run after your consent."));
});

for (const input of [profile, posting, residence, workCountry, workAuthorization]) input.addEventListener("input", () => {
  if(input===posting&&linkedPosting&&linkedPosting!==posting.value.trim()){postingUrl.value='';linkedPosting='';renderApplyLink();}
  if (inputSnapshot && applicationDraftChanged(inputSnapshot.profile, inputSnapshot.posting, candidateProfile(), posting.value)) {
    resetResults(); status(say("Les données ont changé. Relance la préparation pour un bilan à jour.", "Inputs changed. Run preparation again for an updated assessment."));
  }
  persist();
});
contact.addEventListener("input",()=>{element("cv-contact-preview").textContent=contact.value;});
for (const input of [cv, pitch, contact]) input.addEventListener("input", () => {
  reviewed.checked = false; printButton.disabled = download.disabled = true;
  persist();
});
reviewed.addEventListener("change", () => { printButton.disabled = download.disabled = !reviewed.checked; persist(); });
remember.addEventListener("change", persist);
const cvText = (): string => [contact.value.trim(), cv.value.trim()].filter(Boolean).join("\n\n");
printButton.addEventListener("click", () => {
  if (!reviewed.checked || results.hidden) return;
  const print = element("application-print-text");
  print.replaceChildren();
  if (contact.value.trim()) { const header=text("header",contact.value.trim()); header.className="cv-contact-header"; print.append(header); }
  if (currentResult) { const role=text("h2",currentResult.role_title); role.className="cv-role-title"; print.append(role); }
  print.append(cleanCvHtml(cvEditor.html()));
  document.body.classList.add("application-print");
  window.print();
});
window.addEventListener("afterprint", () => document.body.classList.remove("application-print"));
download.addEventListener("click", () => {
  if (!reviewed.checked || results.hidden) return;
  const url = URL.createObjectURL(new Blob([`${cvText()}\n\n--- PITCH ---\n\n${pitch.value}`], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "drills-candidature.txt"; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
cancel.addEventListener("click", () => controller?.abort());
element("application-clear").addEventListener("click", () => {
  controller?.abort(); controller = null; busy(false);
  form.reset(); linkedPosting='';resetResults(); historyRows=[]; setStep("profile"); contact.value = ""; element("cv-contact-preview").textContent="";
  try { clearApplicationState(sessionStorage, localStorage); } catch {}
  deleteCandidateProfile();
  profileSummary();
  element("application-profile-card").hidden = false;
  element("application-saved-profile").hidden = true;
  status(say("Dossier et profil candidat effacés de ce navigateur. Les fichiers exportés restent sur ton appareil.", "Application and candidate profile deleted from this browser. Exported files remain on your device."));
});

// One profile shared by the application and progress pages, with opt-in durable storage.
try {
  const saved = readApplicationState(sessionStorage, localStorage);
  if (saved) {
    historyRows=saved.history ?? (saved.result ? recordAnalysis([],saved.posting,saved.result,null) : []);
    postingUrl.value=saved.posting_url??'';linkedPosting=postingUrl.value?saved.posting.trim():'';residence.value=saved.residence??'';workCountry.value=saved.work_country??'';workAuthorization.value=saved.work_authorization??'unknown';
    contact.value = saved.contact ?? ""; element("cv-contact-preview").textContent=contact.value;
    profile.value = saved.profile; posting.value = saved.posting; remember.checked = saved.remember;
    editor.open = false;
    if (saved.result) {
      inputSnapshot = {profile: candidateProfile(), posting: saved.posting};
      render(saved.result); if (saved.cv_html) cvEditor.setHtml(saved.cv_html, saved.result.cv_sections.map(section=>section.heading)); else { cvEditor.setText(saved.cv); cvEditor.reformat(saved.result.cv_sections.map(section=>section.heading), false); } pitch.value = saved.pitch;
      reviewed.checked = saved.reviewed; printButton.disabled = download.disabled = !saved.reviewed;
      if (saved.result.output_language !== (fr ? "fr" : "en")) status(say("Ton dossier et tes modifications sont conservés. Les textes restent dans leur langue d’origine ; changer la langue de l’interface ne les traduit pas.", "Your application and edits are preserved. Drafts remain in their original language; changing the interface language does not translate them."));
    }
  } else {
    const legacy = readCandidateProfile();
    if (legacy) { profile.value = [legacy.experiences.map(item => `${item.role} · ${item.company} · ${item.period}\n${item.summary}`).join("\n\n"), legacy.schools.join("\n")].join("\n\n"); persist(); }
  }
} catch { /* Manual input and import remain available without storage. */ }
profileSummary();
element("application-pick-pdf").addEventListener("click",()=>pdf.click());
pdf.addEventListener("change", () => {
  element("application-file-name").textContent=pdf.files?.[0]?.name ?? say("Aucun fichier sélectionné", "No file selected");
  if (pdf.files?.length) status(say("CV sélectionné. Coche ton accord, puis clique sur le bouton principal : le CV sera lu avant de continuer.", "CV selected. Check your consent, then click the main button: your CV will be read before continuing."));
});
function setStep(step:string, updateUrl=true):void {
  if(!['profile','posting','diagnostic','documents'].includes(step))step='profile';
  if((step==='diagnostic'||step==='documents')&&!currentResult)step='posting';
  profileMode=step==='profile';
  form.hidden=step==='diagnostic'||step==='documents';
  form.classList.add('application-single-step');
  element('application-profile-card').hidden=!profileMode;
  element('application-posting-card').hidden=step!=='posting';
  element('application-reset-actions').hidden=step==='documents';
  posting.required=!profileMode;
  element('application-example').hidden=!profileMode;
  element('application-submit').hidden=step==='posting'&&!element('jobs-browser').hidden;
  element('application-consent-panel').hidden=step==='posting'&&!element('jobs-browser').hidden;
  element('application-submit').textContent=profileMode?say('Suivant : les opportunités →','Next: opportunities →'):say('Analyser cette annonce','Assess this posting');
  element('application-saved-profile').hidden=profile.value.trim().length<50;
  results.hidden=form.hidden===false;
  element('application-diagnostic-panel').hidden=step!=='diagnostic';
  element('application-documents-panel').hidden=step!=='documents';
  const titles:Record<string,string>={profile:say('Ton profil, ton CV, tes projets.','Your profile, CV and projects.'),posting:say('Trouve ta prochaine opportunité.','Find your next opportunity.'),diagnostic:say('Ton diagnostic pour cette offre.','Your assessment for this role.'),documents:say('Prépare ta candidature.','Prepare your application.')};
  element('application-heading-title').textContent=titles[step];
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-application-step]')){
    button.setAttribute('aria-current',button.dataset.applicationStep===step?'step':'false');
    button.disabled=['diagnostic','documents'].includes(button.dataset.applicationStep!)&&!currentResult;
  }
  if(updateUrl){const url=new URL(location.href);url.searchParams.set('step',step);history.replaceState(null,'',url);}
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-application-step]'))button.addEventListener('click',()=>{if(controller)return;setStep(button.dataset.applicationStep!);element('application-heading-title').scrollIntoView?.({block:'start'});});
window.addEventListener('popstate',()=>setStep(new URLSearchParams(location.search).get('step')??'profile',false));
setStep(requestedStep??(currentResult?'diagnostic':'profile'),false);

const githubStatus=element('github-status');
const githubReview=element('github-review');
const githubPreview=element<HTMLTextAreaElement>('github-preview');
const githubContribution=element<HTMLTextAreaElement>('github-contribution');
let githubController: AbortController | null = null;
element('github-load').addEventListener('click',async()=>{
  if(githubController) return;
  const active=new AbortController(); githubController=active;
  const timer=window.setTimeout(()=>active.abort(),12000);
  const button=element<HTMLButtonElement>('github-load'); button.disabled=true; githubReview.hidden=true;
  githubStatus.textContent=say('Lecture du dépôt public…','Reading public repository…');
  try {
    const project=await fetchGithubProject(element<HTMLInputElement>('github-url').value,active.signal,fr?'fr':'en');
    if(active.signal.aborted) return;
    githubPreview.value=project; githubContribution.value=''; githubReview.hidden=false;
    githubStatus.textContent=say('Vérifie les informations puis décris ta contribution. Rien n’a encore été ajouté.','Review the information and describe your contribution. Nothing has been added yet.');
  } catch(error) {
    const code=error instanceof Error?error.message:'';
    githubStatus.textContent=code==='github-url'?say('Utilise le lien https://github.com/propriétaire/dépôt.','Use https://github.com/owner/repository.'):
      code==='github-limit'?say('Limite GitHub atteinte. Réessaie plus tard ou décris le projet manuellement.','GitHub rate limit reached. Try later or describe the project manually.'):
      code==='github-missing'?say('Dépôt introuvable ou privé. Utilise un dépôt public.','Repository not found or private. Use a public repository.'):
      say('GitHub ne répond pas. Ton profil est conservé ; tu peux ajouter le projet manuellement.','GitHub is unavailable. Your profile is preserved; you can add the project manually.');
  } finally {window.clearTimeout(timer);githubController=null;button.disabled=false;}
});
element('github-add').addEventListener('click',()=>{
  const contribution=githubContribution.value.trim();
  if(contribution.length<20) {githubStatus.textContent=say('Décris ta contribution en au moins 20 caractères.','Describe your contribution in at least 20 characters.');return;}
  const addition=githubPreview.value.trim()+'\n'+say('Ma contribution : ','My contribution: ')+contribution;
  const combined=[profile.value.trim(),addition].filter(Boolean).join('\n\n');
  if(combined.length>16000) {githubStatus.textContent=say('Le profil dépasse 16 000 caractères. Raccourcis le texte avant l’ajout.','Profile exceeds 16,000 characters. Shorten it before adding.');return;}
  profile.value=combined;profile.dispatchEvent(new Event('input',{bubbles:true}));editor.open=true;githubReview.hidden=true;
  githubStatus.textContent=say('Projet ajouté. Relance le diagnostic pour prendre en compte cette preuve.','Project added. Run the assessment again to include this evidence.');
});
element('application-clear').addEventListener('click',()=>{githubController?.abort();githubPreview.value='';githubContribution.value='';element<HTMLInputElement>('github-url').value='';githubReview.hidden=true;githubStatus.textContent='';});

element('cv-reformat').addEventListener('click',()=>{
  if(currentResult) cvEditor.reformat(currentResult.cv_sections.map(section=>section.heading));
});

let availableJobs:any[]=[];let jobsPage=0;
function showPosting(value:boolean):void{
 element('jobs-browser').hidden=value;element('jobs-posting-editor').hidden=!value;
 element('application-submit').hidden=!value&&!profileMode;
 element('application-consent-panel').hidden=!value&&!profileMode;
}
function renderJobs():void{
 const target=element('jobs-results');target.replaceChildren();
 const query=element<HTMLInputElement>('jobs-location').value.trim().toLocaleLowerCase();
 const jobs=availableJobs.filter(job=>!query||String(job.location).toLocaleLowerCase().includes(query));
 const pages=Math.max(1,Math.ceil(jobs.length/4));jobsPage=Math.min(jobsPage,pages-1);
 element('jobs-page').textContent=`${jobsPage+1} / ${pages}`;
 element<HTMLButtonElement>('jobs-previous').disabled=jobsPage===0;
 element<HTMLButtonElement>('jobs-next').disabled=jobsPage===pages-1;
 if(!jobs.length)element('jobs-status').textContent=say('Aucune offre pour ce lieu. Tu peux coller ton annonce.','No openings for this location. You can paste your own posting.');
 for(const job of jobs.slice(jobsPage*4,jobsPage*4+4)){
  if(typeof job.description!=='string'||job.description.length>20000)continue;
  let url:URL;try{url=new URL(job.url);if(url.protocol!=='https:')continue;}catch{continue;}
  const card=document.createElement('article');card.className='application-card';
  const link=text('a',say('Voir l’annonce','View posting')) as HTMLAnchorElement;link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
  const choose=text('button',say('Choisir cette offre →','Choose this opening →')) as HTMLButtonElement;choose.type='button';choose.className='btn btn-secondary';
  choose.addEventListener('click',()=>{
   if(posting.value.trim()&&posting.value!==job.description&&!window.confirm(say('Remplacer l’annonce actuelle ?','Replace the current posting?')))return;
   posting.value=job.description;posting.dispatchEvent(new Event('input',{bubbles:true}));postingUrl.value=url.href;linkedPosting=posting.value.trim();persist();renderApplyLink();showPosting(true);
   element('application-heading-title').scrollIntoView?.({block:'start'});posting.focus();
   status(say('Offre sélectionnée. Vérifie le texte et lance ton diagnostic.','Opening selected. Review the text and start your assessment.'));
  });
  card.append(text('h3',job.title),text('p',job.company+' · '+job.location),link,document.createElement('br'),choose);target.append(card);
 }
}
element('jobs-show-list').addEventListener('click',()=>showPosting(false));
element('jobs-show-posting').addEventListener('click',()=>showPosting(true));
element('jobs-previous').addEventListener('click',()=>{jobsPage--;renderJobs();});
element('jobs-next').addEventListener('click',()=>{jobsPage++;renderJobs();});
element('jobs-location').addEventListener('input',()=>{jobsPage=0;renderJobs();});
showPosting(!!posting.value.trim());
element('jobs-load').addEventListener('click',async()=>{
 const button=element<HTMLButtonElement>('jobs-load');if(button.disabled)return;
 const message=element('jobs-status');const endpoint=apiEndpoint('/api/jobs');
 if(!endpoint){message.textContent=say('Recherche indisponible. Colle ton annonce.','Search unavailable. Paste your posting.');return;}
 button.disabled=true;message.textContent=say('Recherche en cours…','Searching…');
 const active=new AbortController();const timer=window.setTimeout(()=>active.abort(),20000);
 try{
  const response=await fetch(endpoint,{signal:active.signal});if(!response.ok)throw new Error('jobs');
  const data=await response.json();if(!Array.isArray(data.jobs))throw new Error('jobs');
  availableJobs=data.jobs;jobsPage=0;message.textContent=say(`${availableJobs.length} offres à explorer.`,`${availableJobs.length} openings to explore.`);
  if(data.unavailable_sources?.length)message.textContent+=' '+say('Certaines offres sont temporairement indisponibles.','Some openings are temporarily unavailable.');
  renderJobs();
 }catch{message.textContent=say('Recherche indisponible. Ton dossier est conservé ; colle une annonce pour continuer.','Search unavailable. Your application is preserved; paste a posting to continue.');}
 finally{window.clearTimeout(timer);button.disabled=false;}
});

postingUrl.addEventListener('input',()=>{
 linkedPosting=posting.value.trim();renderApplyLink();
 historyRows=historyRows.map(row=>row.posting.trim()===posting.value.trim()?{...row,posting_url:applicationUrl(postingUrl.value)??''}:row);
 persist();
});
