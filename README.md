# DRILLS.ai

DRILLS.ai helps career changers prepare a credible application for their first AI Agent Engineer internship, apprenticeship, or entry-level job. The hackathon category is **Impact → New Opportunities → Jobs**, with a build-in-public approach. The application supports candidates; it does not make hiring decisions or estimate their probability of getting hired.

## Candidate application MVP

Open `/fr/apply/` or `/en/apply/` (under the Astro `/drills.ai/` base path):

1. Paste a CV/profile or import a PDF of at most 4 MiB. The PDF is sent to OpenAI only after explicit consent. Review and correct the extracted text before analysis. A previously saved local profile can also be reused.
2. Paste the full target posting. URL fetching and live job feeds are not connected in this iteration.
3. Review the extracted requirements, exact source excerpts, evidence gaps and recommended next actions. Eligibility conditions are displayed separately from skill coverage.
4. Review and edit the CV sections and introduction pitch. Add contact details locally, then confirm review to download plain text or print the CV to PDF. PDF layout and pagination depend on the browser; inspect the print preview. No ATS acceptance is promised.
5. Practise three posting-specific interview questions. They are generated practice material, not known employer interview questions.

The home CTA opens this workflow. The older `/generate/` exercise preparation path, diagnostic, MCP course, journal and progress screens remain available. No existing browser profile is deleted by clearing the new application page.

### OpenAI integration

- `POST /api/application`: Responses API + Pydantic Structured Outputs. The model selects requirements and drafts text; application code checks that every cited excerpt exists in the supplied source and calculates the coverage score.
- `POST /api/profile-import`: Responses API PDF input, in-memory base64 transfer; no Files API upload or local PDF persistence. Extracted text must be reviewed by the user.
- Both use `store=False`, an SDK timeout, a bounded output and no automatic SDK retries. Configure `OPENAI_APPLICATION_MODEL` to select a compatible model; the default is the existing `OPENAI_MODEL` from `src/ai_generator/config.py`. Model/tool access depends on the project's credentials.
- The current agent/drill pipeline remains separate. This change does not claim to integrate Agents SDK, Realtime, Web Search or third-party job feeds.

Exact quote validation is **not** semantic verification: negations, relevance, skill levels and generated paraphrases can still be misinterpreted. Review every result. Coverage includes only extracted skills, with priority weights 3/2/1 and evidence credit 1/0.5/0. A 60% threshold is a product heuristic, not a calibrated recruitment metric. Missing core evidence or unresolved eligibility conditions prompt further review even above 60%. Uncertain/out-of-scope roles receive no numeric score. Age, gender and nationality must not be used as scoring factors.

### Data and deployment boundary

Unlike the older exercise comparison, the new application workflow sends the approved profile and posting to the DRILLS API and OpenAI. It does not automatically save profiles, PDFs or generated applications in browser storage or a database; the current page holds them until navigation/reload/clear. Contact details entered for export stay in the browser. Downloaded files and printed PDFs remain on the user's device. `store=False` disables response storage, not all provider data processing/retention. Deployment-level logs and provider settings must also be reviewed.

New API responses carry `Cache-Control: no-store`; exception logging records the exception class, not CV content or provider error text. PDF validation checks size, base64 and the PDF header, not file safety or factual authenticity. The server does not execute uploaded or generated code in this workflow.

The new endpoints have per-IP request limits (application: 3/minute and 20/hour; import: 3/minute and 10/hour), plus two concurrent requests per process. These are **demo controls**, not authentication, a distributed limit or a guaranteed spend cap. The older drill/coach routes retain their existing limits. A public unrestricted launch still needs authenticated or otherwise restricted access, deployment-level quotas, budget monitoring and verified proxy/IP handling. No production deployment is performed by this branch.

### Hackathon roadmap retained

| Capability | Current state | Next integration |
| --- | --- | --- |
| Candidate application, evidence, editable CV/pitch | Implemented; mock-backed tests | Live credential and hosted smoke test |
| PDF profile extraction | Implemented; mock-backed tests | Validate real candidate PDF with consent |
| Portfolio evidence | Manual text input | Selected GitHub repositories, read-only |
| Opportunity discovery | Pasted posting | OpenAI Web Search with citations; Greenhouse/Ashby feeds |
| French job feeds | Not connected | France Travail access request; La bonne alternance commercial terms review |
| Persistent accounts and applications | Not connected | Supabase Auth, Postgres and private Storage with tested access policies |
| Voice interview | Not connected | OpenAI Realtime after core workflow validation |
| Agent observability | Minimal server diagnostics | Agents SDK traces or Langfuse, with personal data excluded |
| Networking and reminders | Not connected | Reviewed contact drafts and opt-in transactional notifications |

The fictional example button fills only inputs; it does not simulate a successful AI result. Build-in-public screenshots should use that fictional profile or anonymised data. Report completed functionality separately from roadmap items.

## Local verification

Python 3.12 is the CI/runtime baseline (the project also allows newer versions). Use an isolated environment in this checkout:

```bash
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements-devday.txt -r requirements-api.txt
python -m pytest -q
npm ci
npm run test:contracts
npm run build
```

Configure `OPENAI_API_KEY` only in the API environment or an ignored `.env`. Start `python -m uvicorn api.main:app --reload --port 8000` in one terminal and `npm run dev` in another. Visit `http://localhost:4321/drills.ai/fr/apply/`. For production builds, the public API origin must be supplied as `PUBLIC_DRILLS_API_URL`; it is not an API key.

The full-stack workflow runs frontend contracts, the public build and Python tests on `feat/hackathon-mvp`. Automated API tests mock OpenAI: they do not prove credential validity, model availability, live output quality or production readiness.

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

There is no user account system. The candidate profile stores only experience titles and descriptions, optional company names and periods, and school names in the current browser for 30 days. The user can export or delete it from the posting page; expired or invalid data is removed when read. On the legacy `/generate/` route, the profile is not sent to the model; that route sends the posting and output language. On the new `/apply/` route, the approved profile is also sent to OpenAI, as described above. Candidate matching runs locally in the browser and uses only the experience title and description; company, period, and school names are not used as skill evidence. The separate optional companion may receive the current page's recent conversation, diagnostic summary, and visible exercise context as described above. Do not log or persist submitted content unnecessarily. Generated content and learning progress remain in browser storage. No OpenAI key is requested from or stored in the learner's browser.

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
