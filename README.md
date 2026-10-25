# DRILLS.ai

DRILLS.ai helps career changers prepare a credible application for their first AI Agent Engineer internship, apprenticeship, or entry-level job. The hackathon category is **Impact → New Opportunities → Jobs**, with a build-in-public approach. The application supports candidates; it does not make hiring decisions or estimate their probability of getting hired.

## Candidate application MVP

Open `/fr/apply/` or `/en/apply/` (under the Astro `/drills.ai/` base path):

1. Paste a CV/profile or select a PDF of at most 4 MiB. The PDF is sent to OpenAI only after explicit consent. Review and correct the extracted text before analysis. A previously saved local profile can also be reused.
2. Paste the full target posting, confirm consent and click **Get my assessment**. One action extracts a selected CV, then analyses the posting. Selecting a file or checking consent alone does not start a paid request. URL fetching and live job feeds are not connected in this iteration.
3. Review the extracted requirements, exact source excerpts, evidence gaps and recommended next actions. Eligibility conditions are displayed separately from skill coverage.
4. Review and edit the CV sections and introduction pitch. The Tiptap CV editor supports toggled bold/italic/underline/strike, font family, size, color, paragraph alignment, lists, line height, undo/redo, formatting removal, and editable/removable links. Formatting follows the same browser retention setting as the dossier and is preserved in the print view; the .txt export stays plain text. Pasted and stored markup is filtered, and link protocols are restricted. Review the browser PDF preview before exporting. Add contact details locally, then confirm review to download plain text or print the CV to PDF. PDF layout and pagination depend on the browser; inspect the print preview. No ATS acceptance is promised.
5. Practise three authored interview cases with fixed criteria, ordered by posting keywords. They are not generated or known employer interview questions.

The home CTA opens this workflow. Home card 1 opens the profile step (`?step=profile`); card 2 opens the posting step (`?step=posting`). A saved/imported profile is reused automatically; editing it is optional. Switching interface language preserves the existing assessment, edited CV, formatting and pitch. It does not automatically translate or regenerate user drafts. The delete action clears this dossier and the older candidate profile from this browser.

### OpenAI integration

- `POST /api/application`: Responses API + Pydantic Structured Outputs. The model selects requirements and drafts text; application code checks that every cited excerpt exists in the supplied source and calculates the coverage score.
- `POST /api/profile-import`: Responses API PDF input, in-memory base64 transfer; no Files API upload or local PDF persistence. Extracted text must be reviewed by the user.
- Both use `store=False`, an SDK timeout, a bounded output and no automatic SDK retries. Configure `OPENAI_APPLICATION_MODEL` to select a compatible model; the default is the existing `OPENAI_MODEL` from `src/ai_generator/config.py`. Model/tool access depends on the project's credentials.
- The current agent/drill pipeline remains separate. This change does not claim to integrate Agents SDK, Realtime, Web Search or third-party job feeds.

The model selects enum-constrained IDs from numbered profile and posting excerpts instead of rewriting citations. The server resolves each ID to its original text before validation and display. References cannot mix the profile and posting pools. Source slices are bounded to 600 characters with overlap; they prove text provenance, not that a selected passage is relevant or demonstrates mastery. Citations tolerate Unicode composition, whitespace and typographic quotation marks, but not changed words or numbers. If evidence validation fails, the application makes at most one fresh correction request using the original inputs and a content-free error code. Both attempts share the endpoint’s 95-second deadline; a repair can increase API usage. Persistent failures return no score, preserve the browser profile and expose a safe error category. The browser allows up to 200 seconds for the combined PDF import and analysis, with cancellation available.

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

The former offline service worker is retired. An inline startup repair unregisters the DRILLS worker and deletes only `drills-` asset caches, then reloads once if needed. Profile and application storage is preserved. A retirement worker is still served at the old URL for existing installations.

The Astro base path is `/drills.ai/`. GitHub Pages deployment uses `main`; this feature branch does not publish the site. The API is a separate service described in `render.yaml`. Set its secret `OPENAI_API_KEY` server-side and the frontend build variable `PUBLIC_DRILLS_API_URL` to its HTTPS origin (the deploy workflow reads repository variable `DRILLS_API_URL`). The public origin is not an API key.

## Relevant code

- `src/scripts/application.ts`: shared profile, PDF import, analysis and editable exports.
- `src/lib/application-state.ts`: validated session state and optional 30-day browser storage.
- `src/lib/interview-cases.json`: versioned bilingual authored cases and criteria.
- `src/ai_generator/application.py`: structured analysis, source checks, scoring and deterministic case selection.
- `api/main.py`: bounded API endpoints and retired exercise endpoint.

### CV layout and public GitHub project import

The CV editor uses section headings, spaced paragraphs and a contact/target-role header, retained for printing. Contact details are stored with the dossier and survive language changes. Existing section labels are upgraded without replacing edited text.

From the profile step, add a public `https://github.com/owner/repository` URL. The browser reads GitHub's public repository metadata without a token. A preview, explicit personal contribution and confirmation are required before adding it to the profile. The next diagnosis uses these supplied facts; metadata is not proof of authorship or skill. Private repositories, rate limits and unavailable GitHub responses show a message without replacing the profile. No README or source-code analysis is performed. Greenhouse discovery is now available in the posting step.


### Live openings (Greenhouse)

`GET /api/jobs` reads published jobs from Anthropic, Databricks and Scale AI; no key or candidate data is needed. The app filters explicit internship/apprenticeship/junior engineering titles mentioning agents and excludes senior titles. This is a keyword shortlist, not a guarantee of Agent Engineer duties, eligibility, location suitability or profile matching. Listings include the source link and retrieval time. A user selects an opening to copy its full text into the existing diagnosis workflow. Replacing an existing posting requires confirmation.

Successful lists are cached for five minutes in the API process. Each source has a 12-second timeout; unavailable sources are reported separately from zero matches. The CV/pasted-posting workflow remains available if sources fail. No applications are submitted. Expired or filled roles can remain in the provider feed until the employer removes them; users should check the original listing.

Legacy plain CV drafts now receive section and bullet formatting on restore. The “Format this CV into sections” button reapplies layout to edited drafts, preserving their text but resetting custom inline formatting (Undo restores it).

### Oral pitch rehearsal — OpenAI audio + Responses

The interview page now offers a 90-second local microphone recording, playback, explicit transcription, editable transcript and a separate feedback request. Text input and the prepared pitch remain available when recording is unsupported or permission is denied. Supported browser containers: WebM/Opus and MP4 (Safari); max 8 MiB. Tracks are stopped on stop/clear/page exit. Audio stays in memory until explicit consent and Transcribe; it is not saved in the dossier. Provider retention rules still apply after upload.

`POST /api/interview/transcribe` uses the server's existing `OPENAI_API_KEY` and `OPENAI_TRANSCRIPTION_MODEL` (default `gpt-transcribe`). Availability depends on the API project. `POST /api/interview/feedback` uses `OPENAI_APPLICATION_MODEL` with structured Responses and `store=False`. It reviews text against a fixed clarity/evidence/relevance rubric and returns one follow-up question, not a voice/accent score or a hiring prediction. Feedback is AI-generated and should be reviewed. The authored technical cases remain unchanged.

The edited rehearsal text is saved with an existing candidate dossier and survives interface language changes; recording and feedback are not persisted. Both endpoints use the same bounded concurrency and timeouts as application preparation, with rate limits and no-store response headers. Tests cover consent, audio validation, API failure, microphone release and text fallback using mocked provider/browser APIs. Real Safari microphone capture and the user's transcription-model access must be checked on the user's device.

### Language, feedback latency and audio stabilization

Public MVP routes use explicit FR/EN UI strings. Shared locale helpers now normalize language and localize known CV section headings, including restored drafts and citation-section labels. GitHub metadata notices are in the interface language; repository descriptions, job postings, direct quotes and user-edited prose stay in their original language. The PDF chooser has its own localized button instead of the browser-dependent native label. A shared server instruction enforces the requested language for all generated prose in application and interview feedback; this is a generation instruction, not an independent language detector.

Pitch feedback requests concise observations/actions with an 1,800-token budget instead of the generic 7,000-token cap. Identical repeat requests reuse the most recent in-page result (profile, posting, text and language must all match). The model is unchanged unless `OPENAI_FEEDBACK_MODEL` is explicitly set. Request elapsed time is shown and private API responses expose `Server-Timing`; no live latency benchmark has been claimed.

Recording now prefers supported MP4, uses a continuous 128 kbps recording rather than one-second chunks, requests disabled automatic noise/gain processing, and normally releases microphone tracks after the final recorder event. Browser settings may override capture constraints. These mitigations need a real-device Safari audio check; tests cannot establish sound quality.

MCP assessment: direct GitHub/Greenhouse reads remain appropriate for the deterministic MVP. A later DRILLS MCP server could expose narrow, authenticated tools such as search_jobs, get_job and get_interview_rubric to ChatGPT. MCP is an interface, not a job database or a replacement for provider APIs; no MCP deployment or ChatGPT connection has been added by this change.

### Live MVP architecture and MCP access

The original `DrillOrchestrator` coordinates AnalystAgent, CoachAgent, DrillCreatorAgent and ValidatorAgent for the former exercise product. `/api/drills` returns 410: that four-agent path is not the live MVP. The live candidate journey uses `ApplicationAgent` for profile/posting analysis and drafts, plus the pitch-review workflow. Exact-quote checks and the weighted coverage score are deterministic Python guardrails. Do not describe the current diagnosis as four autonomous agents collaborating.

The job feed now reads Greenhouse plus Ashby boards `mistral.ai` and `dust`, includes only publicly listed jobs, deduplicates source URLs and offers a location-text filter. These additional boards may have zero positions passing the strict junior/agent filter. No alternate senior roles or fictional listings are substituted.

An optional real MCP server exposes four tools:

- `search_jobs`: public listings and source health, optionally filtered by location.
- `get_job`: one full posting from the returned IDs, never an arbitrary URL fetch.
- `get_interview_rubric`: the fixed authored cases in FR or EN.
- `score_documented_match`: with explicit consent, validate caller-supplied exact CV/posting citations and calculate the same coverage rules as the web app. The caller/model selects requirements and assesses relevance; the server does not independently verify those semantic judgments or claim a hiring probability.

No MCP tool reads browser dossiers, writes external data, submits applications or triggers a paid OpenAI call. Scoring receives caller-supplied text transiently; it is not saved. Public tools do not access authenticated user accounts. If account-backed storage is added, implement OAuth and per-user authorization before exposing it.

Local launch (the existing virtualenv already includes MCP through requirements-devday):

```sh
python -m pip install -r requirements-mcp.txt
DRILLS_ENABLE_MCP=true python -m uvicorn api.main:app --reload --port 8000
```

MCP URL locally: `http://localhost:8000/mcp/`. ChatGPT needs a reachable deployed HTTPS endpoint, not this localhost URL. The Render blueprint now targets `feat/hackathon-mvp`, installs `requirements-mcp.txt` and enables MCP. Its public hostname is automatically allowed by the MCP transport; other hosting requires `DRILLS_MCP_HOSTS`. After deploying, configure the ChatGPT connection with `https://YOUR-API-HOST/mcp/` and verify tool discovery. This repository change does not itself create the hosting account, deploy the service, configure its OpenAI key, or connect ChatGPT.

The existing GitHub Pages workflow can be dispatched on the MVP branch once repository variable `DRILLS_API_URL` points to the deployed backend. No merge into main is required for that manual workflow. Validate both /health and MCP initialization before recording the demo.
