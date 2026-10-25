import { CompanionRequestSchema, DynamicDrillSchema, type CompanionRequest } from "../lib/contracts";
import { apiEndpoint } from "../lib/api-client";
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
  const retry = panel.querySelector<HTMLButtonElement>("[data-companion-retry]");
  if (!form || !input || !submit || !transcript || !status || !retry) return;

  const lang = document.body.dataset.lang === "fr" ? "fr" : "en";
  const endpoint = apiEndpoint("/api/coach");
  const copy = lang === "fr"
    ? {
        waiting: "Je prépare une réponse…",
        failed: "Le compagnon n’a pas répondu. Vérifie ta connexion et réessaie.",
        invalid: "La réponse n’a pas pu être vérifiée. Réessaie.",
        unavailable: "Le compagnon est momentanément indisponible. Réessaie plus tard.",
        rateLimited: "Trop de demandes rapprochées. Attends un instant puis réessaie.",
      }
    : {
        waiting: "Preparing a reply…",
        failed: "The companion did not respond. Check your connection and try again.",
        invalid: "The reply could not be validated. Please try again.",
        unavailable: "The companion is temporarily unavailable. Please try again later.",
        rateLimited: "Too many requests in a short time. Wait a moment, then try again.",
      };
  const history: Turn[] = [];
  let failedRequest: CompanionRequest | null = null;

  if (!endpoint) {
    input.disabled = true;
    submit.disabled = true;
    status.dataset.state = "error";
    status.textContent = copy.unavailable;
  }

  panel.querySelectorAll<HTMLButtonElement>("[data-companion-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.companionSuggestion ?? "";
      input.focus();
    });
  });

  async function send(request: CompanionRequest, isRetry: boolean): Promise<void> {
    if (!endpoint || submit.disabled) return;
    if (!isRetry) {
      appendMessage(transcript, "user", request.message);
      history.push({ role: "user", content: request.message });
      input.value = "";
    }
    submit.disabled = true;
    retry.disabled = true;
    retry.hidden = true;
    input.disabled = true;
    status.dataset.state = "busy";
    status.textContent = copy.waiting;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 429) throw new Error("rate-limited");
      if (!response.ok) throw new Error("request-failed");
      if (!body || typeof body !== "object" || !("reply" in body) || typeof body.reply !== "string" || !body.reply.trim()) {
        throw new Error("invalid-response");
      }
      appendMessage(transcript, "assistant", body.reply);
      history.push({ role: "assistant", content: body.reply });
      if (history.length > 8) history.splice(0, history.length - 8);
      failedRequest = null;
      status.textContent = "";
      delete status.dataset.state;
    } catch (error: unknown) {
      status.dataset.state = "error";
      status.textContent = error instanceof Error && error.message === "rate-limited"
        ? copy.rateLimited
        : error instanceof Error && error.message === "invalid-response"
          ? copy.invalid
          : copy.failed;
      failedRequest = request;
      retry.hidden = false;
    } finally {
      window.clearTimeout(timeout);
      submit.disabled = false;
      retry.disabled = false;
      input.disabled = !endpoint;
      if (endpoint) input.focus();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || !endpoint || submit.disabled) return;

    const parsed = CompanionRequestSchema.safeParse({
      output_language: lang,
      message,
      history: history.slice(-8),
      learner: learnerContext(lang),
      roadmap: activeRoadmap(lang),
      exercise: panel.dataset.scope === "exercise" ? activeExercise(lang) : undefined,
    });
    if (!parsed.success) {
      status.dataset.state = "error";
      status.textContent = copy.invalid;
      return;
    }
    void send(parsed.data, false);
  });

  retry.addEventListener("click", () => {
    if (failedRequest) void send(failedRequest, true);
  });
}

export function initializeCompanionPanels(): void {
  document.querySelectorAll<HTMLElement>("[data-companion]").forEach(initializePanel);
}
