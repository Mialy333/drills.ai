import { apiEndpoint } from "../lib/api-client";
import { applicationCv, applicationDraftChanged, ApplicationResultSchema, type ApplicationResult } from "../lib/application";
import { readApplicationState, saveApplicationState, clearApplicationState } from "../lib/application-state";
import { readCandidateProfile, deleteCandidateProfile } from "../lib/candidate-profile";

const fr = document.documentElement.lang === "fr";
const say = (french: string, english: string): string => fr ? french : english;
const element = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const form = element<HTMLFormElement>("application-form");
const profileMode = new URLSearchParams(location.search).get("step") === "profile";
const fields = element<HTMLFieldSetElement>("application-inputs");
const profile = element<HTMLTextAreaElement>("application-profile");
const posting = element<HTMLTextAreaElement>("application-posting");
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
    const saved = saveApplicationState({version: 1, expiresAt: Date.now() + (remember.checked ? 30 : 1) * 86400000,
      profile: profile.value, posting: posting.value, result: currentResult, cv: cv.value, pitch: pitch.value,
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
  cv.value = pitch.value = "";
  inputSnapshot = null;
  for (const id of ["application-evidence", "application-draft-sources", "application-print-text"]) element(id).replaceChildren();
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
  currentResult = result;
  element("application-result-title").textContent = result.role_title;
  element("application-scope").textContent = result.scope_reason;
  element("application-score").textContent = result.score === null
    ? say("Périmètre à vérifier — score non affiché", "Scope needs review — score not shown")
    : `${result.score} % · ${say("couverture documentée des compétences", "documented skill coverage")}`;
  element("application-decision").textContent = result.decision === "prepare"
    ? say("Prépare ta candidature en vérifiant les preuves et les conditions ci-dessous.", "Prepare your application, reviewing the evidence and conditions below.")
    : result.decision === "strengthen"
      ? say("Renforce ou précise les points ci-dessous. Tu peux quand même préparer ta candidature : ce bilan ne décide pas à ta place.", "Strengthen or clarify the points below. You can still prepare your application: this assessment does not decide for you.")
      : say("Vérifie le niveau et les missions : cette annonce n’est pas clairement dans le périmètre premier poste Agent Engineer.", "Review the level and duties: this posting is not clearly within the first Agent Engineer role scope.");
  const evidence = element("application-evidence");
  evidence.replaceChildren(...result.requirements.map((item) => {
    const card = document.createElement("article");
    card.dataset.evidence = item.status;
    const state = { documented: say("Documenté", "Documented"), partial: say("Partiel", "Partial"), not_documented: say("Non documenté", "Not documented") }[item.status];
    const priority = { core: say("Essentielle", "Core"), important: say("Importante", "Important"), supporting: say("Complémentaire", "Supporting") }[item.priority];
    const badge = text("span", state); badge.className = "evidence-badge";
    const meaning = { documented: say("Une preuve figure dans ton profil. Prépare un exemple pour l’entretien.", "Your profile contains evidence. Prepare an example for the interview."), partial: say("Ton profil couvre une partie du besoin. Précise ta contribution ou ajoute une preuve.", "Your profile covers part of this requirement. Clarify your contribution or add evidence."), not_documented: say("Aucune preuve suffisante dans les éléments fournis : cela ne signifie pas que tu ne sais pas le faire.", "No sufficient evidence in the supplied information: this does not mean you cannot do it.") }[item.status];
    card.append(badge, text("h3", item.name), text("p", meaning), text("small", `${item.kind === "eligibility" ? say("Condition à vérifier", "Condition to review") : say("Compétence", "Skill")} · ${priority}`), text("p", item.explanation));
    const quotes = document.createElement("details");
    quotes.append(text("summary", say("Voir les preuves citées", "View quoted evidence")), text("p", say("Dans l’annonce", "In the posting")), text("blockquote", item.posting_quote));
    quotes.append(text("p", say("Dans ton parcours", "In your experience")), text("blockquote", item.candidate_quote ?? say("Aucune preuve citée. Ajoute un exemple si tu en as un.", "No evidence cited. Add an example if you have one.")));
    const action = text("p", `${say("Prochaine action", "Next action")} : ${item.next_action}`); action.className = "evidence-action";
    card.append(quotes, action);
    return card;
  }));
  cv.value = applicationCv(result);
  pitch.value = result.pitch.text;
  element("application-draft-sources").replaceChildren(...[...result.cv_sections, result.pitch].map((section) => {
    const node = document.createElement("section");
    node.append(text("h3", section.heading), ...section.source_quotes.map((quote) => text("blockquote", quote)));
    return node;
  }));
  reviewed.checked = false;
  printButton.disabled = download.disabled = true;
  results.hidden = false;
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
  pdf.value = "";
  editor.open = true;
  persist();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (controller) return;
  if (!consent.checked) { consent.reportValidity(); status(say("Confirme l’envoi à l’IA avant de continuer.", "Confirm sharing with AI before continuing.")); return; }
  const file = pdf.files?.[0];
  const job = posting.value.trim();
  if (!profileMode && job.length < 50) {
    status(say("Colle le texte complet de l’annonce (50 caractères minimum).", "Paste the full posting (at least 50 characters).")); posting.focus(); return;
  }
  if (!file && profile.value.trim().length < 50) {
    element("application-profile-card").hidden = false; editor.open = true;
    status(say("Ajoute ton CV PDF ou renseigne ton profil une seule fois. Aucun profil exploitable n’est encore enregistré.", "Add your PDF CV or enter your profile once. No usable profile has been saved yet.")); profile.focus(); return;
  }
  void perform(async (signal) => {
    if (file) await extractProfile(file, signal);
    if (profileMode) {
      if (!persist()) return;
      const next = new URL(location.href); next.search = "?step=posting"; next.hash = "";
      location.assign(next.href); return;
    }
    const candidate = profile.value.trim();
    resetResults(); persist();
    status(say("Étape 2/2 · Comparaison de ton profil avec l’annonce et préparation de ta candidature…", "Step 2/2 · Comparing your profile with the posting and preparing your application…"));
    const raw = await post("/api/application", { candidate_text: candidate, job_description: job, output_language: fr ? "fr" : "en", consent: true }, signal);
    if (signal.aborted) return;
    const result = ApplicationResultSchema.parse(raw);
    if (result.output_language !== (fr ? "fr" : "en")) throw new Error("language");
    inputSnapshot = { profile: candidate, posting: job };
    render(result); persist();
    status(say("Diagnostic prêt. Vérifie les preuves et les textes proposés, notamment les informations extraites du CV.", "Assessment ready. Review the evidence and drafts, including the information extracted from your CV."));
    results.scrollIntoView?.({behavior: "smooth", block: "start"});
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
  pdf.value = "";
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

for (const input of [profile, posting]) input.addEventListener("input", () => {
  if (inputSnapshot && applicationDraftChanged(inputSnapshot.profile, inputSnapshot.posting, profile.value, posting.value)) {
    resetResults(); status(say("Les données ont changé. Relance la préparation pour un bilan à jour.", "Inputs changed. Run preparation again for an updated assessment."));
  }
  persist();
});
for (const input of [cv, pitch, contact]) input.addEventListener("input", () => {
  reviewed.checked = false; printButton.disabled = download.disabled = true;
  persist();
});
reviewed.addEventListener("change", () => { printButton.disabled = download.disabled = !reviewed.checked; persist(); });
remember.addEventListener("change", persist);
const cvText = (): string => [contact.value.trim(), cv.value.trim()].filter(Boolean).join("\n\n");
printButton.addEventListener("click", () => {
  if (!reviewed.checked || results.hidden) return;
  element("application-print-text").textContent = cvText();
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
  form.reset(); resetResults(); contact.value = "";
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
    profile.value = saved.profile; posting.value = saved.posting; remember.checked = saved.remember;
    editor.open = false;
    if (saved.result && saved.result.output_language === (fr ? "fr" : "en")) {
      inputSnapshot = {profile: saved.profile, posting: saved.posting};
      render(saved.result); cv.value = saved.cv; pitch.value = saved.pitch;
      reviewed.checked = saved.reviewed; printButton.disabled = download.disabled = !saved.reviewed;
    }
  } else {
    const legacy = readCandidateProfile();
    if (legacy) { profile.value = [legacy.experiences.map(item => `${item.role} · ${item.company} · ${item.period}\n${item.summary}`).join("\n\n"), legacy.schools.join("\n")].join("\n\n"); persist(); }
  }
} catch { /* Manual input and import remain available without storage. */ }
profileSummary();
pdf.addEventListener("change", () => {
  if (pdf.files?.length) status(say("CV sélectionné. Coche ton accord, puis clique sur le bouton principal : le CV sera lu avant de continuer.", "CV selected. Check your consent, then click the main button: your CV will be read before continuing."));
});
if (profileMode) {
  form.classList.add("application-single-step");
  element("application-posting-card").hidden = true; posting.required = false;
  element("application-submit").textContent = say("Enregistrer mon profil et choisir une annonce", "Save my profile and choose a posting");
  element("application-example").hidden = true;
  element("application-heading-title").textContent = say("Ton profil, une seule fois.", "Your profile, entered once.");
  results.hidden = true;
} else if (new URLSearchParams(location.search).get("step") === "posting") {
  element("application-heading-title").textContent = say("Quelle annonce veux-tu viser ?", "Which posting are you targeting?");
  if (profile.value.trim().length >= 50) {
    form.classList.add("application-single-step");
    element("application-profile-card").hidden = true;
    element("application-saved-profile").hidden = false;
  }
  posting.focus();
}
