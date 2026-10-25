# DRILLS.ai

DRILLS.ai helps career changers prepare an application for an internship, apprenticeship, or entry-level AI Agent Engineer role in France. Its first demo starts with a pasted job posting: candidates compare the posting with experience they choose to enter, then review an evidence summary and a focused Python exercise. It is not a general coding course or a job board. The Astro frontend is a static GitHub Pages site; generation is handled by the separate API service.

## Learner journey

1. Paste a France-based internship, apprenticeship, or entry-level job posting.
2. Enter an experience title and a short description of work or projects. Company, period, and school names are optional; a full CV is not required.
3. Review a local, keyword-based evidence comparison against the skills extracted from the posting. Core requirements carry more weight; a missing text match is not proof that the candidate lacks a skill, and the score is not a hiring probability.
4. Review the posting-grounded preparation steps and generate a focused Python exercise, then run its tests, answer the concept check, and explain the approach.
5. Use the optional technical diagnostic, reviewed MCP lesson, and learning companion as supporting practice. Save attempts and track progress in the browser.

The exercises should help learners build job-relevant ability, not predict interview questions or promise a hiring outcome.

This MVP does not search or rank live job listings, generate CVs or cover letters, contact recruiters, or submit applications. It does not claim a candidate is qualified from a keyword score. The first flow is deliberately a pasted-posting demo so the candidate can inspect what evidence the comparison used.

## Learning design and visual system

The first course is the reference for future structured lessons. Its content is reviewed, versioned, and bilingual in `src/lib/lessons.ts`; browser progress is validated separately from drill XP and stored locally. For this lesson, “complete” means that all eight function checks passed before viewing the solution, all four comprehension answers are correct, and a security reflection was saved. The browser checks exercise only the pure Python function; `tests/test_mcp_lesson.py` uses the official SDK for actual in-process tool discovery and invocation.

The interface uses a soft lavender and ivory palette with mint success and warm amber caution. Core tokens live in `src/styles/global.css`: `--bg: #faf9ff`, `--panel: #fffcfa`, `--raise: #ede7ff`, `--accent: #7664e8`, `--ink: #24213a`, and `--muted: #68657c`. Typography uses the system UI sans-serif stack, with monospace reserved for code; this avoids a remote font dependency. Body text is 16px at 1.6 line height, labels use 12px, and the title scales from 1.8rem to 2.75rem. Cards use a 24px radius and a low-contrast shadow.

`DrillsMascot.astro` is an original, inline SVG companion with welcome, thinking, encouragement, success, help, recommendation, and difficulty expressions. Its motion is disabled when `prefers-reduced-motion` is set. Progress visuals are tied to saved events: the practice chart plots recorded attempts and their actual scores, streaks use attempt dates and show an empty state until the first attempt, and course evidence keeps reading, attempts, passing checks, quiz results, reflection, and solution viewing distinct. Empty states explain when there is not enough data; course completion is not described as professional mastery.

## Multi-agent pipeline and FastAPI backend

The Python package in `src/ai_generator/` contains an experimental specialist pipeline:

1. `AnalystAgent` extracts evidence-grounded skills from a job posting.
2. `CoachAgent` turns the analysis into an ordered learning roadmap.
3. `DrillCreatorAgent` creates a synthetic Python exercise for the final roadmap step.
4. `ValidatorAgent` runs deterministic preflight checks and requests a separate model review.
5. `DrillOrchestrator` coordinates the stages and combines their outputs into the existing browser payload shape.

The specialist pipeline is exposed through `api/main.py`. During local development the static frontend calls `http://127.0.0.1:8000` directly; production builds use the public API origin supplied through `PUBLIC_DRILLS_API_URL`. Learners do not configure backend URLs or API keys. The OpenAI key stays in the API service environment. The API requires a valid server-side `OPENAI_API_KEY`. The legacy `DrillGeneratorAgent` remains for compatibility; new work should prefer the specialist pipeline.

The API currently runs the four specialist stages sequentially in one request. It is an MVP, not a durable job queue: long requests can fail if the hosting instance restarts, and the service should be rate-limited before public use. It does not execute generated Python code on the server.

### Contextual learning companion

The optional `/api/coach` endpoint powers the learning companion on the home, exercise, and course pages. It receives the learner's optional self-reported profile, diagnostic summary, roadmap, visible exercise instructions, current answer, and recent feedback. On the course page, submitted code is included only after the learner checks the explicit sharing option. It does not receive the reference solution or hidden tests. The endpoint is stateless; the short conversation history stays in the current browser page only. Course questions can be answered without an API key. The same server-side `OPENAI_API_KEY` is used if the learner asks the AI companion for help.

The public production build contains only the guided routes and the `dynamic-job` exercise shell; legacy catalog routes and the drill map are included in local development builds. This is a static-build visibility boundary, not access control. Progress and profile data stay in each browser's local storage.

### Validator checks and remaining quality gate

The deterministic preflight validates that both implementations and the test harness parse as Python, checks that the harness contains a real `assert` statement (not merely the word in a comment/string), checks that the broken and fixed implementations differ, and checks that the final roadmap skill came from the role analysis. Offline tests cover these rejection cases and ensure preflight failures skip the model review. These checks do **not** execute generated code or prove behavioural correctness.

The offline behavioral-contract tests in `tests/test_behavioral_contract.py` use fixed, trusted fixtures to prove that a discriminating harness fails on a known broken implementation and passes on its fixed version. They also demonstrate that a happy-path-only harness can pass both versions. These tests are examples of the expected contract, not a validator for arbitrary generated code; the test helper must never be fed model-generated source. A subprocess timeout is not a security sandbox.

Before publishing generated exercises, run the harness against both code samples in a strongly isolated, resource-limited sandbox and require the tests to fail against `broken_code` and pass against `fixed_solution`. The current validator reports this limitation as a warning; it does not execute untrusted code. Do not treat an LLM review or syntax parsing as a substitute for that runtime gate.

### Browser-side exercise runner

Learner code is evaluated in Pyodide in a Web Worker, with a timeout that terminates and recreates the worker if execution exceeds the limit. This keeps normal exercise execution off the main UI thread, but it is **not a security boundary for arbitrary generated code** and does not replace a hardened sandbox. Do not put API keys, private data, or privileged capabilities in the worker. Do not execute model-generated code on a server or publish a generated drill solely because its syntax parses or an LLM approves it. A production-grade runtime gate needs explicit resource limits and denied network/filesystem/process capabilities, ideally in a disposable isolated runtime.

## Where exercise content comes from

The job posting is the source of role-specific requirements. The generator should use only skills supported by the posting, then create a new, synthetic scenario and Python task. It must not rely on a creator's portfolio or private archives, and should not reproduce proprietary company code or interview questions.

Generated content needs quality checks before it is treated as learning material:

- Check the response against the structured schema and the requested language.
- Require a concrete task, an intentionally flawed implementation, a corrected solution, and tests that distinguish them.
- Run the tests against both implementations: they should fail for the flawed code and pass for the solution.
- Review the explanation and expected difficulty against the skill the posting actually names. Schema validity alone does not establish correctness.

A small, reviewed starter set of generic AI-agent Python exercises would also let new learners try the product before supplying an API key or job posting.

## Privacy and API key

There is no user account system. The candidate profile stores only experience titles and descriptions, optional company names and periods, and school names in the current browser for 30 days. The user can export or delete it from the posting page; expired or invalid data is removed when read. The profile is not sent to the model. Only the pasted job posting and output language are sent to the configured DRILLS.ai API for analysis and generation. Candidate matching runs locally in the browser and uses only the experience title and description; company, period, and school names are not used as skill evidence. The separate optional companion may receive the current page's recent conversation, diagnostic summary, and visible exercise context as described above. Do not log or persist submitted content unnecessarily. Generated content and learning progress remain in browser storage. No OpenAI key is requested from or stored in the learner's browser.

## Run locally

```bash
npm ci
npm run dev       # http://localhost:4321/drills.ai/
npm run build     # static output in dist/
npm run preview   # preview the built site
```

Use `uv` to install the pinned MCP SDK and its Inspector CLI, then run the course integration and offline API tests with:

```bash
uv sync --dev
uv run pytest -q
```

The course test uses MCP Python SDK `2.3.0` to verify tool discovery and an in-process call. The remaining tests use mocked clients and do not require an `OPENAI_API_KEY` or make paid API calls. To inspect the server locally, run `uv run mcp dev src/learning/mcp_calculator.py`.

### Run the API locally

```bash
uv venv
uv pip install --python .venv/bin/python -r requirements-api.txt -r requirements-devday.txt
OPENAI_API_KEY="your-key" uv run --no-sync uvicorn api.main:app --reload --port 8000
```

Run the Astro frontend in another terminal with `npm run dev`. In development, it calls the API at `http://127.0.0.1:8000`; the API's CORS policy permits the local Astro origin. The generator and companion work without exposing an infrastructure setting in the UI. Keep the key in the API process environment or an ignored local `.env`; do not commit it.

### Deploy the API to Render

The `render.yaml` blueprint defines a separate Python web service. In Render, create a new Blueprint from this repository and set `OPENAI_API_KEY` as a secret environment variable when prompted. For GitHub Pages, set the repository variable `DRILLS_API_URL` to the API service's HTTPS origin. The deploy workflow passes it to Astro as `PUBLIC_DRILLS_API_URL` at build time. This origin is public configuration, not a secret; the OpenAI key must only exist in the API service environment. If the variable is absent, the static site shows a learner-friendly unavailable message and does not attempt a cross-origin request.

## Project structure

| Path | Purpose |
|---|---|
| `src/pages/[lang]/` | English and French pages, including diagnostic, generator, roadmap, and exercise routes |
| `src/lib/assessment.ts` | Diagnostic questions and scoring |
| `src/lib/candidate-profile.ts` | Validated candidate profile storage with a 30-day expiry and user export/deletion |
| `src/lib/candidate-match.ts` | Browser-only evidence comparison between entered experience and posting skills |
| `src/lib/drills.ts` | Public drill types, routes, and base-aware links |
| `src/scripts/app.ts` | Browser state, generated drill hydration, Pyodide execution, and progress |
| `src/scripts/companion.ts` | Context-limited browser client for the learning companion |
| `src/components/CompanionPanel.astro` | Shared companion UI for the learner path and exercises |
| `src/lib/contracts.ts` | Zod contracts for generated content, profiles, and companion requests |
| `src/lib/learner.ts` | Validated local learner profile storage and snapshots |
| `src/lib/lessons.ts` | Typed, bilingual, versioned course content |
| `src/lib/lesson-progress.ts` | Validated local course progress, resume state, and evidence |
| `src/learning/mcp_calculator.py` | Pinned-SDK MCP calculator lesson example |
| `src/pages/[lang]/learn/` | Bilingual course hub and interactive lesson routes |
| `src/scripts/py-worker.ts` | Worker-based Python exercise execution |
| `src/ai_generator/agents/` | Experimental specialist agents |
| `src/ai_generator/orchestrator.py` | Experimental sequential pipeline orchestration |
| `src/ai_generator/pipeline_schemas.py` | Typed contracts for agent inputs and outputs |
| `src/styles/global.css` | Shared responsive UI and theme styles |
| `public/` | Static assets and web app metadata |

Legacy drill routes and titles are available in local development but omitted from the public static build. The source data remains in the repository; this is not access control. The site is deployed from the `main` branch by `.github/workflows/deploy.yml`; changes on other branches do not update the live GitHub Pages site until they reach `main`.

## Deployment

GitHub Actions runs `npm ci` and `npm run build`, then publishes only `dist/` to GitHub Pages. The Astro base path is `/drills.ai/`.
