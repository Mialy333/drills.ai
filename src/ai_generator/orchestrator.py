"""Deterministic orchestration for the DRILLS.ai specialist agents."""
from openai import OpenAI

from src.ai_generator.agents import AnalystAgent, CoachAgent, DrillCreatorAgent, ValidatorAgent
from src.ai_generator.pipeline_schemas import DynamicDrillSchema


class DrillPipelineError(RuntimeError):
    """Raised when a stage fails or generated content does not pass preflight."""


class DrillOrchestrator:
    """Coordinates the specialist agents and returns the existing browser payload shape."""

    def __init__(
        self,
        client: OpenAI | None = None,
        analyst: AnalystAgent | None = None,
        coach: CoachAgent | None = None,
        creator: DrillCreatorAgent | None = None,
        validator: ValidatorAgent | None = None,
    ):
        self.client = client
        self.analyst = analyst or AnalystAgent(client=client)
        self.coach = coach or CoachAgent(client=client)
        self.creator = creator or DrillCreatorAgent(client=client)
        self.validator = validator or ValidatorAgent(client=client)

    def generate(
        self,
        job_description: str,
        output_language: str = "same as the job posting",
        learner_snapshot: str | None = None,
    ) -> DynamicDrillSchema:
        if not job_description.strip():
            raise ValueError("Job description must not be empty.")

        analysis = self.analyst.analyze(job_description, output_language)
        roadmap = self.coach.create_roadmap(analysis, output_language, learner_snapshot)
        final_step = roadmap.roadmap[-1]
        drill = self.creator.create_drill(analysis, final_step, output_language)
        report = self.validator.validate(analysis, roadmap, drill)

        if not report.passed:
            details = "; ".join(report.errors) or "No detailed reason was returned."
            raise DrillPipelineError(f"Generated drill did not pass validation: {details}")

        payload = {
            **analysis.model_dump(),
            **roadmap.model_dump(),
            **drill.model_dump(),
        }
        return DynamicDrillSchema.model_validate(payload)
