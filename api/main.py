"""FastAPI adapter for the existing DRILLS.ai specialist-agent pipeline.

The API keeps the OpenAI key server-side. The Astro frontend remains a static
GitHub Pages site and calls this service using its configured public API origin.
"""
from contextlib import asynccontextmanager
import asyncio
import logging
import os
from time import perf_counter
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.ai_generator.agents.mentor import MentorAgent
from src.ai_generator.orchestrator import DrillOrchestrator, DrillPipelineError
from src.ai_generator.pipeline_schemas import DynamicDrillSchema
from src.ai_generator.application import (
    ApplicationAgent, ApplicationRequest, ApplicationResult,
    ProfileImportRequest, ImportedProfile, ApplicationOutputError, EvidenceError,
)

logger = logging.getLogger(__name__)

DEFAULT_ORIGINS = (
    "https://mialy333.github.io,"
    "http://localhost:4321,"
    "http://127.0.0.1:4321,"
    "http://localhost:3000,"
    "http://127.0.0.1:3000"
)
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("DRILLS_CORS_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])

# MCP is opt-in to keep existing deployments working without its optional SDK.
mcp_app = None
if os.getenv("DRILLS_ENABLE_MCP", "").lower() == "true":
    from api.mcp_app import mcp_app

@asynccontextmanager
async def lifespan(app):
    if mcp_app is not None:
        async with mcp_app.router.lifespan_context(mcp_app):
            yield
    else:
        yield

app = FastAPI(
    lifespan=lifespan,
    title="DRILLS.ai API",
    description="Server-side API for generating job-grounded Python drills with specialist agents.",
    version="0.1.0",
)

if mcp_app is not None:
    app.mount("/mcp", mcp_app)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Shared across these two workflows in this process. This is a demo capacity
# guard, not a distributed quota or authentication boundary.
application_slots = asyncio.Semaphore(2)


@app.middleware("http")
async def private_application_responses(request: Request, call_next):
    started = perf_counter()
    response = await call_next(request)
    if request.url.path in {"/api/application", "/api/profile-import", "/api/interview/transcribe", "/api/interview/feedback", "/api/interview/technical"} or request.url.path.startswith("/mcp/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Server-Timing"] = f"application;dur={(perf_counter()-started)*1000:.0f}"
    return response


async def run_application_operation(operation):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="Application service is not configured.")
    if application_slots.locked():
        raise HTTPException(status_code=429, detail="Application service is busy. Please try again shortly.")
    async with application_slots:
        started = perf_counter()
        try:
            result = await asyncio.wait_for(operation(), timeout=95)
            logger.info("Application operation completed in %.2fs", perf_counter() - started)
            return result
        except (asyncio.TimeoutError, TimeoutError):
            raise HTTPException(status_code=504, detail="Preparation timed out. Your inputs have not been saved.") from None
        except ApplicationOutputError as exc:
            logger.warning("Application preparation rejected: %s", exc.code)
            code = "evidence_validation" if isinstance(exc, EvidenceError) else exc.code
            raise HTTPException(status_code=502, detail={"code": code}) from None
        except Exception as exc:
            # Never log a CV, prompt, provider response or exception message.
            logger.warning("Application preparation failed (%s)", type(exc).__name__)
            raise HTTPException(status_code=502, detail="Preparation failed validation or the AI service is unavailable. Please try again.") from None


@app.post("/api/application", response_model=ApplicationResult)
@limiter.limit("3/minute;20/hour")
async def prepare_application(request: Request, payload: ApplicationRequest) -> ApplicationResult:
    return await run_application_operation(lambda: ApplicationAgent().prepare(payload))


@app.post("/api/profile-import", response_model=ImportedProfile)
@limiter.limit("3/minute;10/hour")
async def import_candidate_pdf(request: Request, payload: ProfileImportRequest) -> ImportedProfile:
    return await run_application_operation(lambda: ApplicationAgent().import_pdf(payload))


class DrillRequest(BaseModel):
    """Validated request for the existing multi-agent generator."""

    model_config = ConfigDict(extra="forbid")

    job_description: str = Field(min_length=50, max_length=20_000)
    output_language: Literal["fr", "en"] = "fr"
    learner_snapshot: str | None = Field(default=None, max_length=4_000)


class CoachTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2_000)


class CoachLearnerContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal: str | None = Field(default=None, max_length=120)
    python_experience: str | None = Field(default=None, max_length=80)
    agent_experience: str | None = Field(default=None, max_length=80)
    weekly_minutes: int | None = Field(default=None, ge=30, le=2_400)
    demonstrated_snapshot: str | None = Field(default=None, max_length=1_000)


class CoachRoadmapStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(max_length=160)
    skill: str = Field(max_length=120)
    objective: str = Field(max_length=600)


class CoachRoadmapContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role_title: str = Field(max_length=160)
    role_summary: str = Field(max_length=1_200)
    steps: list[CoachRoadmapStep] = Field(max_length=6)


class CoachExerciseContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(max_length=160)
    context: str = Field(max_length=1_600)
    mission: str = Field(max_length=1_600)
    current_answer: str | None = Field(default=None, max_length=12_000)
    latest_feedback: str | None = Field(default=None, max_length=2_000)


class CoachQuizReview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(max_length=800)
    learner_answer: str = Field(max_length=500)
    revealed_feedback: str = Field(max_length=1_200)


class CoachLessonContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(max_length=160)
    objective: str = Field(max_length=600)
    sequence: str = Field(max_length=160)
    instructions: str = Field(max_length=2_000)
    code: str | None = Field(default=None, max_length=12_000)
    feedback: str | None = Field(default=None, max_length=2_000)
    quiz_review: CoachQuizReview | None = None


class CompanionRequest(BaseModel):
    """Minimal context for a stateless, contextual learning-companion turn."""

    model_config = ConfigDict(extra="forbid")

    output_language: Literal["fr", "en"]
    message: str = Field(min_length=1, max_length=2_000)
    history: list[CoachTurn] = Field(default_factory=list, max_length=8)
    learner: CoachLearnerContext | None = None
    roadmap: CoachRoadmapContext | None = None
    exercise: CoachExerciseContext | None = None
    lesson: CoachLessonContext | None = None


@app.get("/health")
async def health() -> dict[str, str | bool]:
    """Small health check suitable for deployment-provider monitoring."""
    return {
        "status": "ok",
        "generator_configured": bool(os.getenv("OPENAI_API_KEY")),
    }


@app.post("/api/drills", response_model=DynamicDrillSchema)
@limiter.limit("5/minute")
async def generate_drill(request: Request, payload: DrillRequest) -> DynamicDrillSchema:
    """Retired: the candidate MVP uses authored interview cases, not generated code."""
    raise HTTPException(status_code=410, detail="Generated drills are retired. Use the application and interview preparation pages.")


@app.post("/api/coach")
@limiter.limit("10/minute")
async def coach(request: Request, payload: CompanionRequest) -> dict[str, str]:
    """Return one contextual mentoring turn; no conversation is stored server-side."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="The learning companion is not configured on this API service.",
        )

    try:
        reply = await asyncio.to_thread(MentorAgent().respond, payload)
        return {"reply": reply}
    except Exception as exc:
        logger.exception("Learning companion request failed")
        raise HTTPException(
            status_code=502,
            detail="The learning companion could not respond. Please try again.",
        ) from exc


@app.get("/api/jobs")
@limiter.limit("10/minute")
async def discover_jobs(request: Request):
    from src.integrations.jobs import load_jobs
    return await load_jobs()


from src.ai_generator.interview import AudioRequest, Transcript, PitchRequest, PitchFeedback, transcribe_audio, review_pitch


@app.post("/api/interview/transcribe", response_model=Transcript)
@limiter.limit("3/minute;10/hour")
async def transcribe_pitch(request: Request, payload: AudioRequest):
    raise HTTPException(status_code=410, detail="Interview preparation is no longer part of this MVP.")


@app.post("/api/interview/feedback", response_model=PitchFeedback)
@limiter.limit("3/minute;20/hour")
async def pitch_feedback(request: Request, payload: PitchRequest):
    raise HTTPException(status_code=410, detail="Interview preparation is no longer part of this MVP.")


from src.ai_generator.technical_interview import TechnicalRequest, review_technical


@app.post("/api/interview/technical")
@limiter.limit("3/minute;20/hour")
async def technical_feedback(request: Request, payload: TechnicalRequest):
    raise HTTPException(status_code=410, detail="Interview preparation is no longer part of this MVP.")
