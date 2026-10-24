# DRILLS.ai

DRILLS.ai helps people moving into AI Agent Engineering identify skill gaps and practise the Python skills named in a role they want. It is a static Astro site for GitHub Pages; job-specific preparation is generated in the browser.

## Learner journey

1. Take a short diagnostic to get an initial skills snapshot.
2. Paste a job posting to map its technical requirements into a focused preparation roadmap.
3. Generate a Python exercise tied to those requirements, then run tests, answer a concept check, and explain the approach.
4. Save attempts and track progress in the browser.

The exercises should help learners build job-relevant ability, not predict interview questions or promise a hiring outcome.

## Agent pipeline (experimental, not yet wired into the browser)

The Python package in `src/ai_generator/` contains an experimental specialist pipeline:

1. `AnalystAgent` extracts evidence-grounded skills from a job posting.
2. `CoachAgent` turns the analysis into an ordered learning roadmap.
3. `DrillCreatorAgent` creates a synthetic Python exercise for the final roadmap step.
4. `ValidatorAgent` runs deterministic preflight checks and requests a separate model review.
5. `DrillOrchestrator` coordinates the stages and combines their outputs into the existing browser payload shape.

The orchestrator is not a web API and is not connected to the static browser generator yet. This avoids putting a server-side API key in the static site and keeps this first step isolated from the existing learner experience. The pipeline requires a valid `OPENAI_API_KEY` when instantiated with the default OpenAI client. The legacy `DrillGeneratorAgent` remains for compatibility; new work should prefer the specialist pipeline.

### Validator checks and remaining quality gate

The deterministic preflight validates that both implementations and the test harness parse as Python, checks that the harness contains a real `assert` statement (not merely the word in a comment/string), checks that the broken and fixed implementations differ, and checks that the final roadmap skill came from the role analysis. Offline tests cover these rejection cases and ensure preflight failures skip the model review. These checks do **not** execute generated code or prove behavioural correctness.

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

There is no account or application server. If a learner chooses to generate a roadmap, the pasted posting and their OpenAI API key are sent from their browser to OpenAI. The key is stored in that browser's local storage when they choose to save it; generated content and progress are also stored locally. Clearing site data removes them. Do not use a key on a shared device, and revoke it with the provider when it is no longer needed.

## Run locally

```bash
npm ci
npm run dev       # http://localhost:4321/drills.ai/
npm run build     # static output in dist/
npm run preview   # preview the built site
```

Python pipeline dependencies are listed in `requirements-devday.txt`. Install them in a virtual environment before running Python tests. Run the complete offline suite with:

```bash
python -m pytest -q
```

These tests use mocked clients and do not require an `OPENAI_API_KEY` or make paid API calls. The GitHub Actions workflow runs the same complete test command on Python 3.12.

## Project structure

| Path | Purpose |
|---|---|
| `src/pages/[lang]/` | English and French pages, including diagnostic, generator, roadmap, and exercise routes |
| `src/lib/assessment.ts` | Diagnostic questions and scoring |
| `src/lib/drills.ts` | Public drill types, routes, and base-aware links |
| `src/scripts/app.ts` | Browser state, generated drill hydration, Pyodide execution, and progress |
| `src/scripts/py-worker.ts` | Worker-based Python exercise execution |
| `src/ai_generator/agents/` | Experimental specialist agents |
| `src/ai_generator/orchestrator.py` | Experimental sequential pipeline orchestration |
| `src/ai_generator/pipeline_schemas.py` | Typed contracts for agent inputs and outputs |
| `src/styles/global.css` | Shared responsive UI and theme styles |
| `public/` | Static assets and web app metadata |

Personal archive material is excluded from the public source tree and build. The site is deployed from the `main` branch by `.github/workflows/deploy.yml`; changes on other branches do not update the live GitHub Pages site until they reach `main`.

## Deployment

GitHub Actions runs `npm ci` and `npm run build`, then publishes only `dist/` to GitHub Pages. The Astro base path is `/drills.ai/`.
