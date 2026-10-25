# DRILLS.ai

DRILLS.ai helps career changers prepare for AI Agent Engineering through guided Python practice. The Astro frontend is a static GitHub Pages site. Learners can start with a sample exercise, take a short diagnostic, and build a role-specific roadmap from a job posting.

## Learner journey

1. Take a short diagnostic to get an initial skills snapshot.
2. Paste a job posting to map its technical requirements into a focused preparation roadmap.
3. Generate a Python exercise tied to those requirements, then run tests, answer a concept check, and explain the approach.
4. Ask the contextual learning companion for progressive hints and explanations.
5. Save attempts and track progress in the browser.

The exercises should help learners build job-relevant ability, not predict interview questions or promise a hiring outcome.

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

The optional `/api/coach` endpoint powers the learning companion on the home and exercise pages. It receives the learner's optional self-reported profile, diagnostic summary, roadmap, visible exercise instructions, current answer, and recent feedback. It does not receive the reference solution or hidden tests. The endpoint is stateless; the short conversation history stays in the current browser page only. The same server-side `OPENAI_API_KEY` is used as the drill generator.

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

There is no user account system. The pasted job posting and optional quiz snapshot are sent to the configured DRILLS.ai API, which forwards the request to OpenAI using a server-side secret. Companion messages include the current page's recent conversation and only the visible exercise context. Do not log or persist this content unnecessarily. Generated content and learner progress remain in browser storage. No OpenAI key is requested from or stored in the learner's browser.

## Run locally

```bash
npm ci
npm run dev       # http://localhost:4321/drills.ai/
npm run build     # static output in dist/
npm run preview   # preview the built site
```

Python test dependencies are listed in `requirements-devday.txt`. Install them in a virtual environment before running Python tests. Run the complete offline suite with:

```bash
python -m pytest -q
```

These tests use mocked clients and do not require an `OPENAI_API_KEY` or make paid API calls.

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
| `src/lib/drills.ts` | Public drill types, routes, and base-aware links |
| `src/scripts/app.ts` | Browser state, generated drill hydration, Pyodide execution, and progress |
| `src/scripts/companion.ts` | Context-limited browser client for the learning companion |
| `src/components/CompanionPanel.astro` | Shared companion UI for the learner path and exercises |
| `src/lib/contracts.ts` | Zod contracts for generated content, profiles, and companion requests |
| `src/lib/learner.ts` | Validated local learner profile storage and snapshots |
| `src/scripts/py-worker.ts` | Worker-based Python exercise execution |
| `src/ai_generator/agents/` | Experimental specialist agents |
| `src/ai_generator/orchestrator.py` | Experimental sequential pipeline orchestration |
| `src/ai_generator/pipeline_schemas.py` | Typed contracts for agent inputs and outputs |
| `src/styles/global.css` | Shared responsive UI and theme styles |
| `public/` | Static assets and web app metadata |

Legacy drill routes and titles are available in local development but omitted from the public static build. The source data remains in the repository; this is not access control. The site is deployed from the `main` branch by `.github/workflows/deploy.yml`; changes on other branches do not update the live GitHub Pages site until they reach `main`.

## Deployment

GitHub Actions runs `npm ci` and `npm run build`, then publishes only `dist/` to GitHub Pages. The Astro base path is `/drills.ai/`.
