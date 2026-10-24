"""FastAPI adapter for the existing DRILLS.ai specialist-agent pipeline.

The API keeps the OpenAI key server-side. The Astro frontend remains a static
GitHub Pages site and calls this service when a backend URL is configured.
"""
import asyncio
import logging
import os
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

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

app = FastAPI(
    title="DRILLS.ai API",
    description="Server-side API for generating job-grounded Python drills with specialist agents.",
    version="0.1.0",
)

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


@app.get("/health")
async def health() -> dict[str, str | bool]:
    """Small health check suitable for deployment-provider monitoring."""
    return {
        "status": "ok",
        "generator_configured": bool(os.getenv("OPENAI_API_KEY")),
    }


@app.post("/api/drills", response_model=DynamicDrillSchema)
async def generate_drill(request: DrillRequest) -> DynamicDrillSchema:
    """Run the existing Analyst → Coach → Creator → Validator pipeline."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="The generator is not configured. Set OPENAI_API_KEY on the API service.",
        )

    try:
        # The orchestrator and OpenAI SDK are synchronous; run them off the
        # event loop so other requests (including /health) remain responsive.
        return await asyncio.to_thread(
            DrillOrchestrator().generate,
            job_description=request.job_description,
            output_language=request.output_language,
            learner_snapshot=request.learner_snapshot,
        )
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
