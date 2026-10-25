"""FastAPI adapter for the existing DRILLS.ai specialist-agent pipeline.

The API keeps the OpenAI key server-side. The Astro frontend remains a static
GitHub Pages site and calls this service using its configured public API origin.
"""
import asyncio
import logging
import os
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
    ProfileImportRequest, ImportedProfile,
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

app = FastAPI(
    title="DRILLS.ai API",
    description="Server-side API for generating job-grounded Python drills with specialist agents.",
    version="0.1.0",
)

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
    response = await call_next(request)
    if request.url.path in {"/api/application", "/api/profile-import"}:
        response.headers["Cache-Control"] = "no-store"
    return response


async def run_application_operation(operation):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="Application service is not configured.")
    if application_slots.locked():
        raise HTTPException(status_code=429, detail="Application service is busy. Please try again shortly.")
    async with application_slots:
        try:
            return await asyncio.wait_for(operation(), timeout=95)
        except (asyncio.TimeoutError, TimeoutError):
            raise HTTPException(status_code=504, detail="Preparation timed out. Your inputs have not been saved.") from None
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
