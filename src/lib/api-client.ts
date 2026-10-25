const configuredApiBase = (import.meta.env.PUBLIC_DRILLS_API_URL ?? "").trim().replace(/\/+$/, "");

/** Resolve the app endpoint without asking learners to configure the service. */
export function apiEndpoint(path: "/api/interview/transcribe" | "/api/interview/feedback" | "/api/jobs" | "/api/coach" | "/api/drills" | "/api/application" | "/api/profile-import"): string | null {
  if (import.meta.env.DEV) {
    return `http://127.0.0.1:8000${path}`;
  }
  if (!configuredApiBase) return null;

  try {
    const base = new URL(configuredApiBase);
    const local = base.hostname === "localhost" || base.hostname === "127.0.0.1";
    if (base.protocol !== "https:" && !(base.protocol === "http:" && local)) return null;
    if (window.location.protocol === "https:" && base.protocol !== "https:" && !local) return null;
    return `${base.origin}${base.pathname.replace(/\/+$/, "")}${path}`;
  } catch {
    return null;
  }
}
