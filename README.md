# DRILLS.ai

DRILLS.ai helps career changers prepare a credible application for their first AI Agent Engineer internship, apprenticeship, or entry-level job. The hackathon category is **Impact → New Opportunities → Jobs**, with a build-in-public approach. The application supports candidates; it does not make hiring decisions or estimate their probability of getting hired.

## Candidate application MVP

Open `/fr/apply/` or `/en/apply/` (under the Astro `/drills.ai/` base path):

1. Paste a CV/profile or select a PDF of at most 4 MiB. The PDF is sent to OpenAI only after explicit consent. Review and correct the extracted text before analysis. A previously saved local profile can also be reused.
2. Paste the full target posting, confirm consent and click **Get my assessment**. One action extracts a selected CV, then analyses the posting. Selecting a file or checking consent alone does not start a paid request. URL fetching and live job feeds are not connected in this iteration.
3. Review the extracted requirements, exact source excerpts, evidence gaps and recommended next actions. Eligibility conditions are displayed separately from skill coverage.
4. Review and edit the CV sections and introduction pitch. Add contact details locally, then confirm review to download plain text or print the CV to PDF. PDF layout and pagination depend on the browser; inspect the print preview. No ATS acceptance is promised.
5. Practise three authored interview cases with fixed criteria, ordered by posting keywords. They are not generated or known employer interview questions.

The home CTA opens this workflow. Home card 1 opens the profile step (`?step=profile`); card 2 opens the posting step (`?step=posting`). A saved/imported profile is reused automatically; editing it is optional. The delete action clears this dossier and the older candidate profile from this browser.

### OpenAI integration

- `POST /api/application`: Responses API + Pydantic Structured Outputs. The model selects requirements and drafts text; application code checks that every cited excerpt exists in the supplied source and calculates the coverage score.
- `POST /api/profile-import`: Responses API PDF input, in-memory base64 transfer; no Files API upload or local PDF persistence. Extracted text must be reviewed by the user.
- Both use `store=False`, an SDK timeout, a bounded output and no automatic SDK retries. Configure `OPENAI_APPLICATION_MODEL` to select a compatible model; the default is the existing `OPENAI_MODEL` from `src/ai_generator/config.py`. Model/tool access depends on the project's credentials.
- The current agent/drill pipeline remains separate. This change does not claim to integrate Agents SDK, Realtime, Web Search or third-party job feeds.

Exact quote validation is **not** semantic verification: negations, relevance, skill levels and generated paraphrases can still be misinterpreted. Review every result. Coverage includes only extracted skills, with priority weights 3/2/1 and evidence credit 1/0.5/0. A 60% threshold is a product heuristic, not a calibrated recruitment metric. Missing core evidence or unresolved eligibility conditions prompt further review even above 60%. Uncertain/out-of-scope roles receive no numeric score. Age, gender and nationality must not be used as scoring factors.

### Data and deployment boundary

Unlike the older exercise comparison, the new application workflow sends the approved profile and posting to the DRILLS API and OpenAI. Profile text, posting and drafts are saved in this tab’s session storage for navigation/reload (at most one day). An explicit checkbox enables local storage for 30 days after the last edit. PDFs and export contact details are not saved. The delete button removes both stores and the older candidate profile. There is no account database. Contact details entered for export stay in the browser. Downloaded files and printed PDFs remain on the user's device. `store=False` disables response storage, not all provider data processing/retention. Deployment-level logs and provider settings must also be reviewed.

New API responses carry `Cache-Control: no-store`; exception logging records the exception class, not CV content or provider error text. PDF validation checks size, base64 and the PDF header, not file safety or factual authenticity. The server does not execute uploaded or generated code in this workflow.

The new endpoints have per-IP request limits (application: 3/minute and 20/hour; import: 3/minute and 10/hour), plus two concurrent requests per process. These are **demo controls**, not authentication, a distributed limit or a guaranteed spend cap. The old drill endpoint is retired; the archived coach endpoint retains its existing limits. A public unrestricted launch still needs authenticated or otherwise restricted access, deployment-level quotas, budget monitoring and verified proxy/IP handling. No production deployment is performed by this branch.

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
npm run test:ui
```

Configure `OPENAI_API_KEY` only in the API environment or an ignored `.env`. Start `python -m uvicorn api.main:app --reload --port 8000` in one terminal and `npm run dev` in another. Visit `http://localhost:4321/drills.ai/fr/apply/`. For production builds, the public API origin must be supplied as `PUBLIC_DRILLS_API_URL`; it is not an API key.

The full-stack workflow runs frontend contracts, the public build and Python tests on `feat/hackathon-mvp`. Automated API tests mock OpenAI: they do not prove credential validity, model availability, live output quality or production readiness.

## Candidate progress and interview preparation

`/progress/` shows three milestones: profile ready, posting analysed, application reviewed. Review does not mean an application was sent or an interview obtained. `/prepare/` offers three bilingual authored cases with fixed assessment criteria: tool failures, untrusted content and agent evaluation. The API orders these cases by posting keywords; no exercise or interview question is generated. Each case includes a concept explanation, an example answer and technical references. These are practice cases, not verified employer questions or externally certified assessments.

Old `/generate/`, `/assess/`, and `/journal/` links redirect to the candidate workflow. Python drill and course routes are disabled in development and production. The archived learning code and its tests remain in the repository, but the public application does not load a Python runner. `POST /api/drills` returns HTTP 410 and does not invoke a model.

## Deployment

The Astro base path is `/drills.ai/`. GitHub Pages deployment uses `main`; this feature branch does not publish the site. The API is a separate service described in `render.yaml`. Set its secret `OPENAI_API_KEY` server-side and the frontend build variable `PUBLIC_DRILLS_API_URL` to its HTTPS origin (the deploy workflow reads repository variable `DRILLS_API_URL`). The public origin is not an API key.

## Relevant code

- `src/scripts/application.ts`: shared profile, PDF import, analysis and editable exports.
- `src/lib/application-state.ts`: validated session state and optional 30-day browser storage.
- `src/lib/interview-cases.json`: versioned bilingual authored cases and criteria.
- `src/ai_generator/application.py`: structured analysis, source checks, scoring and deterministic case selection.
- `api/main.py`: bounded API endpoints and retired exercise endpoint.
