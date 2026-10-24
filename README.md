# DRILLS.ai

DRILLS.ai helps people moving into AI Agent Engineering identify skill gaps and practise the Python skills named in a role they want. It is a static Astro site for GitHub Pages; job-specific preparation is generated in the browser.

## Learner journey

1. Take a short diagnostic to get an initial skills snapshot.
2. Paste a job posting to map its technical requirements into a focused preparation roadmap.
3. Generate a Python exercise tied to those requirements, then run tests, answer a concept check, and explain the approach.
4. Save attempts and track progress in the browser.

The exercises should help learners build job-relevant ability, not predict interview questions or promise a hiring outcome.

## Where exercise content comes from

The job posting is the source of role-specific requirements. The generator should use only skills supported by the posting, then create a new, synthetic scenario and Python task. It must not rely on a creator's portfolio or private archives, and should not reproduce proprietary company code or interview questions.

Generated content needs quality checks before it is treated as learning material:

- Check the response against the structured schema and the requested language.
- Require a concrete task, an intentionally flawed implementation, a corrected solution, and tests that distinguish them.
- Run the tests against both implementations: they should fail for the flawed code and pass for the solution.
- Review the explanation and expected difficulty against the skill the posting actually names. Schema validity alone does not establish correctness.

The current client-side generator validates the structured response and creates a targeted exercise. Automated execution of generated tests against both code samples is a quality gate to add before expanding the exercise catalog. A small, reviewed starter set of generic AI-agent Python exercises would also let new learners try the product before supplying an API key or job posting.

## Privacy and API key

There is no account or application server. If a learner chooses to generate a roadmap, the pasted posting and their OpenAI API key are sent from their browser to OpenAI. The key is stored in that browser's local storage when they choose to save it; generated content and progress are also stored locally. Clearing site data removes them. Do not use a key on a shared device, and revoke it with the provider when it is no longer needed.

## Run locally

```bash
npm ci
npm run dev       # http://localhost:4321/drills.ai/
npm run build     # static output in dist/
npm run preview   # preview the built site
```

## Project structure

| Path | Purpose |
|---|---|
| `src/pages/[lang]/` | English and French pages, including diagnostic, generator, roadmap, and exercise routes |
| `src/lib/assessment.ts` | Diagnostic questions and scoring |
| `src/lib/drills.ts` | Public drill types, routes, and base-aware links |
| `src/scripts/app.ts` | Browser state, generated drill hydration, Pyodide execution, and progress |
| `src/scripts/py-worker.ts` | Isolated Python test execution |
| `src/styles/global.css` | Shared responsive UI and theme styles |
| `public/` | Static assets and web app metadata |

Personal archive material is excluded from the public source tree and build. The site is deployed from the `main` branch by `.github/workflows/deploy.yml`; changes on other branches do not update the live GitHub Pages site until they reach `main`.

## Deployment

GitHub Actions runs `npm ci` and `npm run build`, then publishes only `dist/` to GitHub Pages. The Astro base path is `/drills.ai/`.
