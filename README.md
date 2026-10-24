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

The specialist pipeline is exposed through `api/main.py`. The static generator can call this backend by setting a backend URL on the generator page; the OpenAI key then stays in the backend environment. If no backend URL is configured, the existing browser-side OpenAI-key flow remains available as a fallback. The API requires a valid server-side `OPENAI_API_KEY`. The legacy `DrillGeneratorAgent` remains for compatibility; new work should prefer the specialist pipeline.

The API currently runs the four specialist stages sequentially in one request. It is an MVP, not a durable job queue: long requests can fail if the hosting instance restarts, and the service should be rate-limited before public use. It does not execute generated Python code on the server.

### Contextual learning companion

The optional `/api/coach` endpoint powers the learning companion on the home and exercise pages. It receives the learner's optional self-reported profile, diagnostic summary, roadmap, visible exercise instructions, current answer, and recent feedback. It does not receive the reference solution or hidden tests. The endpoint is stateless; the short conversation history stays in the current browser page only. The same server-side `OPENAI_API_KEY` is used as the drill generator. Configure the backend URL on the generator page to enable both backend features.

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

There is no user account system. When a backend URL is configured, the pasted job posting and optional quiz snapshot are sent to the DRILLS.ai API, which forwards the request to OpenAI using a server-side secret. Do not log or persist job postings unnecessarily. Without a backend URL, the fallback sends the posting and the learner's API key directly from the browser to OpenAI; that key is stored in local storage if saved. Generated content and progress remain in browser storage. Avoid using a personal API key on shared devices and revoke exposed keys promptly.

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
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-api.txt -r requirements-devday.txt
export OPENAI_API_KEY="your-key"
uvicorn api.main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/docs` to inspect the API and `http://127.0.0.1:8000/health` to check its configuration. In the generator page, enter `http://127.0.0.1:8000` in the FastAPI backend URL field. Keep the key in your local environment; do not commit it to Git.

### Deploy the API to Render

The `render.yaml` blueprint defines a separate Python web service. In Render, create a new Blueprint from this repository and set `OPENAI_API_KEY` as a secret environment variable when prompted. After the service is live, copy its HTTPS URL into the generator page's FastAPI backend URL field. The Astro site can remain on GitHub Pages. The API URL is saved in the browser's local storage; it is not a secret.

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
