import { CompanionRequestSchema, DynamicDrillSchema, type CompanionRequest } from "../lib/contracts";
import { readLearnerProfile } from "../lib/learner";

type Turn = { role: "user" | "assistant"; content: string };

function learnerContext(lang: "fr" | "en"): CompanionRequest["learner"] {
  const profile = readLearnerProfile();
  let demonstratedSnapshot: string | undefined;

  try {
    const assessment: unknown = JSON.parse(localStorage.getItem("drills.assessment.v1") ?? "null");
    if (assessment && typeof assessment === "object" && "pillars" in assessment && assessment.pillars && typeof assessment.pillars === "object") {
      const entries = Object.entries(assessment.pillars).flatMap(([pillar, value]) => {
        if (!value || typeof value !== "object" || !("correct" in value) || !("total" in value)) return [];
        const { correct, total } = value as { correct: unknown; total: unknown };
        return typeof correct === "number" && typeof total === "number" ? [`${pillar}: ${correct}/${total}`] : [];
      });
      if (entries.length) demonstratedSnapshot = entries.join("; ");
    }
  } catch {
    // Mentoring remains available without saved quiz results.
  }

  if (!profile && !demonstratedSnapshot) return undefined;
  const goal = profile?.goal;
  const python = profile?.pythonExperience;
  const agents = profile?.agentExperience;
  const values = lang === "fr"
    ? {
        goal: { "career-change": "reconversion professionnelle", "target-role": "préparer un poste ciblé", "skill-building": "développer ses compétences" },
        python: { new: "débute en Python", some: "a déjà pratiqué Python", regular: "utilise Python régulièrement", professional: "utilise Python professionnellement" },
        agents: { new: "découvre les agents IA", learning: "apprend les agents IA", "built-projects": "a construit des projets avec des agents IA", professional: "travaille avec des agents IA" },
      }
    : {
        goal: { "career-change": "career transition", "target-role": "prepare for a target role", "skill-building": "build skills" },
        python: { new: "new to Python", some: "has some Python practice", regular: "uses Python regularly", professional: "uses Python professionally" },
        agents: { new: "new to AI agents", learning: "learning AI agents", "built-projects": "has built AI agent projects", professional: "works with AI agents" },
      };

  return {
    ...(goal ? { goal: values.goal[goal] } : {}),
    ...(python ? { python_experience: values.python[python] } : {}),
    ...(agents ? { agent_experience: values.agents[agents] } : {}),
    ...(profile ? { weekly_minutes: profile.weeklyMinutes } : {}),
    ...(demonstratedSnapshot ? { demonstrated_snapshot: demonstratedSnapshot } : {}),
  };
}

function activeRoadmap(lang: "fr" | "en"): CompanionRequest["roadmap"] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`DRILLS_DYNAMIC_JOB_DATA_${lang.toUpperCase()}`) ?? "null");
    const result = DynamicDrillSchema.safeParse(value);
    if (!result.success) return undefined;
    const drill = result.data;
    return {
      role_title: drill.role_title,
      role_summary: drill.role_summary,
      steps: drill.roadmap.map(({ title, skill, objective }) => ({ title, skill, objective })),
    };
  } catch {
    return undefined;
  }
}

function activeExercise(lang: "fr" | "en"): CompanionRequest["exercise"] {
  const article = document.querySelector<HTMLElement>("article.drill");
  if (!article) return undefined;
  const rawTitle = article.querySelector(".drill-head h1")?.textContent?.trim() ?? "";
  const rawContext = article.querySelector(".brief .prose")?.textContent?.trim() ?? "";
  const rawMission = article.querySelector(".brief .mission")?.textContent?.trim() ?? "";
  let title = rawTitle;
  let context = rawContext;
  let mission = rawMission;

  try {
    const value: unknown = JSON.parse(localStorage.getItem(`DRILLS_DYNAMIC_JOB_DATA_${lang.toUpperCase()}`) ?? "null");
    const result = DynamicDrillSchema.safeParse(value);
    if (result.success) {
      title = result.data.title;
      context = result.data.context;
      mission = result.data.mission;
    }
  } catch {
    // The visible exercise text is the safe fallback context.
  }

  const currentAnswer = [...article.querySelectorAll<HTMLTextAreaElement>("textarea[data-answer]")]
    .map((input) => input.value.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12_000);
  const latestFeedback = [...article.querySelectorAll<HTMLElement>("[data-feedback]")]
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .slice(-2)
    .join("\n")
    .slice(0, 2_000);

  if (!title && !context && !mission) return undefined;
  return { title, context, mission, current_answer: currentAnswer || undefined, latest_feedback: latestFeedback || undefined };
}

function backendUrl(): string | null {
  try {
    const raw = localStorage.getItem("DRILLS_API_BASE_URL")?.trim().replace(/\/+$/, "");
    if (!raw) return null;
    const parsed = new URL(raw);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return null;
    if (location.protocol === "https:" && parsed.protocol !== "https:" && !local) return null;
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function appendMessage(transcript: HTMLElement, role: Turn["role"] | "guide", text: string): void {
  const message = document.createElement("p");
  message.className = `companion-message companion-message-${role}`;
  message.textContent = text;
  transcript.append(message);
  message.scrollIntoView({ block: "nearest" });
}

function initializePanel(panel: HTMLElement): void {
  const form = panel.querySelector<HTMLFormElement>("[data-companion-form]");
  const input = panel.querySelector<HTMLTextAreaElement>("[data-companion-input]");
  const submit = panel.querySelector<HTMLButtonElement>("[data-companion-submit]");
  const transcript = panel.querySelector<HTMLElement>("[data-companion-transcript]");
  const status = panel.querySelector<HTMLElement>("[data-companion-status]");
  const setup = panel.querySelector<HTMLElement>("[data-companion-setup]");
  if (!form || !input || !submit || !transcript || !status || !setup) return;

  const lang = document.body.dataset.lang === "fr" ? "fr" : "en";
  const url = backendUrl();
  const copy = lang === "fr"
    ? { waiting: "Réflexion…", failed: "Le compagnon n'a pas pu répondre. Réessaie dans un instant.", invalid: "Le service a renvoyé une réponse invalide.", unavailable: "Configure le service API pour activer le compagnon." }
    : { waiting: "Thinking…", failed: "The companion could not respond. Try again in a moment.", invalid: "The service returned an invalid response.", unavailable: "Configure the API service to enable the companion." };
  const history: Turn[] = [];

  if (!url) {
    input.disabled = true;
    submit.disabled = true;
    setup.hidden = false;
    status.textContent = copy.unavailable;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!url || !message || submit.disabled) return;

    const article = panel.dataset.scope === "exercise" ? activeExercise(lang) : undefined;
    const priorHistory = history.slice(-8);
    const request = CompanionRequestSchema.safeParse({
      output_language: lang,
      message,
      history: priorHistory,
      learner: learnerContext(lang),
      roadmap: activeRoadmap(lang),
      exercise: article,
    });
    if (!request.success) {
      status.textContent = copy.invalid;
      return;
    }

    appendMessage(transcript, "user", message);
    history.push({ role: "user", content: message });
    input.value = "";
    submit.disabled = true;
    input.disabled = true;
    status.textContent = copy.waiting;
    try {
      const response = await fetch(`${url}/api/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(request.data),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!body || typeof body !== "object" || !("reply" in body) || typeof body.reply !== "string" || !body.reply.trim()) {
        throw new Error("invalid response");
      }
      appendMessage(transcript, "assistant", body.reply);
      history.push({ role: "assistant", content: body.reply });
      if (history.length > 8) history.splice(0, history.length - 8);
      status.textContent = "";
    } catch (error: unknown) {
      status.textContent = error instanceof Error && error.message === "invalid response" ? copy.invalid : copy.failed;
    } finally {
      submit.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });
}

export function initializeCompanionPanels(): void {
  document.querySelectorAll<HTMLElement>("[data-companion]").forEach(initializePanel);
}
