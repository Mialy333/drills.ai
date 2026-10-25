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


class CompanionRequest(BaseModel):
    """Minimal context for a stateless, contextual learning-companion turn."""

    model_config = ConfigDict(extra="forbid")

    output_language: Literal["fr", "en"]
    message: str = Field(min_length=1, max_length=2_000)
    history: list[CoachTurn] = Field(default_factory=list, max_length=8)
    learner: CoachLearnerContext | None = None
    roadmap: CoachRoadmapContext | None = None
    exercise: CoachExerciseContext | None = None


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
    """Run the existing Analyst → Coach → Creator → Validator pipeline."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="The generator is not configured. Set OPENAI_API_KEY on the API service.",
        )

    try:
        # The orchestrator and OpenAI SDK are synchronous; run them off the
        # event loop so other requests (including /health) remain responsive.
        language_label = "French" if payload.output_language == "fr" else "English"
        result = await asyncio.to_thread(
            DrillOrchestrator().generate,
            job_description=payload.job_description,
            output_language=language_label,
            learner_snapshot=payload.learner_snapshot,
        )
        return result.model_copy(update={"output_language": payload.output_language})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except DrillPipelineError as exc:
        logger.warning("Drill pipeline rejected generated content: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="The generated exercise did not pass validation. Please try again.",
        ) from exc
    except Exception as exc:
        logger.exception("Drill generation failed")
        raise HTTPException(
            status_code=502,
            detail="Drill generation failed. Check the API service logs and try again.",
        ) from exc


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
