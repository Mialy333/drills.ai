# DRILLS.ai — User journey and UX/UI audit

Status: initial product audit, based on the current `devday-codex` source tree. This is a code-informed hypothesis, not a substitute for usability tests with learners.

## Product promise

Help people preparing for AI Agent Engineering roles identify skill gaps and practise job-relevant Python—not predict interview questions or promise hiring outcomes.

## Primary journey

**Arrive → understand value → try a useful first session → see evidence of progress → return.**

The first successful learning outcome should be possible without an account, an API key, or a pasted job description. A learner who has neither an API key nor a job posting should still be able to experience the product using a reviewed, bundled starter drill.

## Journey map and priorities

### P0 — First visit and first value

**Current implementation**
- Home page offers two entry points: an 8-question diagnostic and job-posting preparation.
- The generator asks learners to provide their own OpenAI API key and paste a complete job posting.
- Progress is stored in browser local storage; no account is required.

**Risks / friction**
- Asking for an API key before the first successful experience creates a large trust and setup barrier.
- Learners who are exploring a career path may not have a job posting yet.
- The promise and distinction between the diagnostic and job-posting paths may not be obvious quickly enough.
- Local-only storage is a product constraint that should be communicated without implying cross-device sync.

**Direction**
- Offer a “Try a sample drill” path before any key or job posting.
- Explain the outcome, expected time, and next step for each entry point.
- Keep “I’m exploring” and “I have a target role” as explicit, equally understandable paths.
- Explain privacy and storage in plain language at the point of decision.

**Acceptance criteria**
- A first-time visitor can reach a playable, reviewed sample drill in one obvious action without a key or job posting.
- The home page explains who the product is for, what the learner will do, and what they will leave with.
- All primary actions have clear labels and work on mobile and keyboard.
- No claim implies a measured skill level, guaranteed job readiness, or hiring outcome.

### P0 — Diagnostic

**Desired journey**
1. Understand the purpose and duration before starting.
2. Answer one question at a time with visible progress.
3. Move backward without losing answers.
4. Receive an honest skills snapshot with evidence and limitations.
5. Start a relevant next exercise or create a role-based roadmap.

**UX checks**
- Visible progress, estimated time, accessible answer controls, focus management, and validation.
- Clear distinction between a quiz signal and proven competency.
- Results should explain why a skill is suggested and provide one obvious next action.
- Refresh/back navigation should not silently discard completed answers where feasible.

### P0 — Job posting to roadmap

**Current implementation**
- The generator accepts a pasted job posting and an OpenAI API key, stores the key locally if the learner chooses, calls OpenAI from the browser, and displays skills, evidence, and roadmap steps.

**Risks / friction**
- The key requirement and direct data transfer to OpenAI may surprise new learners.
- A long pasted posting can be noisy or incomplete; errors need to tell the learner how to recover.
- It is unclear how to proceed when a learner has no key, does not want to save it, or the model request fails.
- Job descriptions may contain personal or confidential information.

**Direction**
- Separate “paste role” from “configure generation” and explain the key requirement before the learner invests effort.
- Never imply the key is sent to DRILLS.ai: in this static build it is used by the browser to call OpenAI directly.
- Make save-key an explicit opt-in; offer a session-only option and a clear remove-key action.
- Show validation requirements, privacy/data-flow disclosure, loading progress, retry guidance, and a safe way back.
- Do not retain or transmit pasted job descriptions for analytics.

**Acceptance criteria**
- Empty, too-short, unsupported, or failed submissions produce localized, actionable errors.
- Loading states prevent duplicate requests and are announced accessibly.
- The learner can recover from a failed generation without losing the pasted text.
- A learner can choose not to persist the API key.
- Roadmap skills include evidence from the posting; uncertain or unsupported claims are not presented as facts.

### P0 — Exercise and feedback loop

**Desired journey**
1. Understand the scenario, objective, expected time, and what to submit.
2. Read or edit code with useful affordances.
3. Run the exercise and understand failures.
4. Receive feedback that distinguishes syntax, test failures, and conceptual gaps.
5. Answer the concept check and explain the approach.
6. Save the attempt and see a clear next step.

**UX checks**
- Keep the task and success criteria visible while working.
- Use clear, distinct states: not started, running, passed, failed, and execution error.
- Preserve learner code across ordinary navigation or accidental refresh where feasible.
- Explain what a failed test means without immediately revealing the complete solution.
- Provide keyboard support, responsive editor layout, readable code, and screen-reader status announcements.
- A worker timeout is a responsiveness mechanism, not a security sandbox. Never imply arbitrary generated code is safely isolated.

**Acceptance criteria**
- A failed run shows a useful, non-technical recovery message as well as actionable technical detail.
- Running, success, failure, and timeout states are distinguishable without relying on color alone.
- The learner can retry and continue to the concept check or explanation.
- Generated exercises are not published as behaviorally validated until a hardened runtime verifies the harness against both broken and fixed implementations.

### P1 — Progress, journal, and return visit

**Desired journey**
- See completed attempts, concepts practised, and a credible next action.
- Resume the latest relevant exercise.
- Understand what is stored locally and how to clear it.

**UX checks**
- Empty states should teach the first action instead of displaying a blank dashboard.
- Progress metrics must be derived from real saved events, not decorative gamification.
- “Continue” should lead to an existing, valid route; stale or malformed local storage must not break the page.
- Journal export/import should explain file format and validation before importing.

**Acceptance criteria**
- New learners see one primary CTA and a brief explanation of what will be recorded.
- Existing learners can resume a valid latest attempt.
- Corrupted local storage falls back gracefully.
- Progress and streak labels have clear definitions.

### P1 — Navigation, localization, and visual system

**Audit scope**
- English/French parity: navigation, errors, loading, empty states, diagnostic, generator, exercise, journal, and progress.
- Base-aware links for GitHub Pages.
- Desktop, tablet, and narrow mobile layouts.
- Keyboard focus, contrast, reduced motion, semantic headings, labels, and live-region announcements.
- Theme switching and persisted preferences.
- Consistency of buttons, form fields, cards, badges, status messages, and spacing.

**Visual direction**
- Preserve the recognizable DRILLS.ai technical/pixel identity, but use pixel type as an accent rather than making every paragraph and control look like a terminal.
- Establish a consistent type scale, spacing scale, content width, and hierarchy.
- Give the main action a consistent visual treatment and reduce competing neon/glow effects where they impair readability.
- Use a restrained set of status colors, always paired with text/icons.
- Prioritize legibility and clarity over adding decorative effects.

## Initial prioritized backlog

| Priority | Work item | Done when |
|---|---|---|
| P0 | Add a curated sample drill that works offline | First useful exercise requires no API key, account, or job posting |
| P0 | Improve home-page value proposition and entry-point clarity | New users understand audience, outcome, and first action quickly |
| P0 | Audit diagnostic end-to-end | Progress, answer retention, results, and next action are clear |
| P0 | Harden generator form UX | Key/data flow disclosed; validation, loading, retry, and errors are usable |
| P0 | Make exercise feedback states consistent | Running/pass/fail/timeout/error are accessible and actionable |
| P0 | Connect specialist pipeline behind an explicit adapter | Contract tests use fakes; browser never imports Python/OpenAI server secrets |
| P0 | Keep runtime safety gate separate | No untrusted generated code is executed in ordinary application process |
| P1 | Improve progress/journal empty and recovery states | First-time and returning users both have clear actions |
| P1 | Responsive/accessibility pass | Keyboard and mobile journeys work; automated checks cover critical regressions |
| P1 | Instrument privacy-respecting funnel events | Only consented, non-sensitive event data; never collect API keys or job-posting text |
| P2 | Competitive UX benchmark | Compare documented public flows against a defined rubric; do not copy branding or unsupported claims |

## Measurement plan

Establish a baseline before setting numerical targets:
- Home → sample drill click-through.
- Sample drill start → first run.
- First run → successful completion.
- Diagnostic start → completion.
- Generator start → valid roadmap (separately from API-key setup failures).
- Exercise completion → second exercise within 7 days.
- Error rate by stage and device class.

Do not collect source code, API keys, or pasted job descriptions in product analytics. Because the current product is static and local-first, first test whether local-only aggregate measurements are sufficient before adding any analytics provider.

## Usability test plan

Run five short moderated sessions with people at different stages (curious beginner, career changer, Python learner, target-role applicant, returning learner). Ask them to:
1. Explain what DRILLS.ai does from the home page.
2. Start learning without an API key.
3. Find out what a diagnostic result does and does not mean.
4. Paste a sample job description and explain what data leaves the browser.
5. Recover from a simulated generation or code-run error.
6. Find their previous attempt and decide what to do next.

Observe completion, hesitation, errors, and misunderstood language. Do not coach them through the interface. Fix repeated blockers before adding more features.

## Competitive anxiety guardrail

Review competitors on a fixed cadence and score only relevant dimensions: time-to-first-value, exercise quality, feedback clarity, progress continuity, accessibility, privacy, and mobile usability. Prioritize a demonstrated learner problem over a competitor feature. Do not expand scope merely because another product launched something new.
