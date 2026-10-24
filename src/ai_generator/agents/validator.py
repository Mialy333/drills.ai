"""Preflight checks and model review for generated learning content."""
from openai import OpenAI

from src.ai_generator.agents.base import structured_completion
from src.ai_generator.config import OPENAI_MODEL
from src.ai_generator.pipeline_schemas import (
    DrillContent,
    LearningRoadmap,
    RoleAnalysis,
    ValidationReport,
)


def validate_dynamic_drill(
    analysis: RoleAnalysis,
    roadmap: LearningRoadmap,
    drill: DrillContent,
) -> ValidationReport:
    """Run deterministic checks without executing model-generated Python code."""
    errors: list[str] = []
    warnings: list[str] = []

    analyzed_skills = {skill.name.casefold() for skill in analysis.required_skills}
    if not any(step.skill.casefold() in analyzed_skills for step in roadmap.roadmap):
        errors.append("No roadmap step refers to a skill extracted from the job posting.")

    final_step = roadmap.roadmap[-1] if roadmap.roadmap else None
    if final_step and final_step.skill.casefold() not in analyzed_skills:
        errors.append("The final roadmap step targets a skill not found in the analysis.")

    if "assert" not in drill.hidden_test_harness and "pytest" not in drill.hidden_test_harness:
        errors.append("The test harness does not appear to contain Python assertions or pytest tests.")

    if drill.broken_code.strip() == drill.fixed_solution.strip():
        errors.append("The broken code and fixed solution are identical.")

    if not errors:
        warnings.append(
            "Static checks passed only. Execute the test harness in an isolated sandbox against both code samples before publication."
        )
    return ValidationReport(passed=not errors, errors=errors, warnings=warnings)


class ValidatorAgent:
    """Runs deterministic preflight checks and an LLM review; neither replaces sandbox tests."""

    def __init__(self, client: OpenAI | None = None, model: str = OPENAI_MODEL):
        self.client = client or OpenAI()
        self.model = model

    def validate(
        self,
        analysis: RoleAnalysis,
        roadmap: LearningRoadmap,
        drill: DrillContent,
    ) -> ValidationReport:
        preflight = validate_dynamic_drill(analysis, roadmap, drill)
        if not preflight.passed:
            return preflight

        prompt = (
            "Review this generated exercise for relevance to the job analysis, internal consistency, "
            "clarity, and whether the described tests plausibly distinguish the flawed implementation "
            "from the solution. Do not claim to execute code. If uncertain about runtime correctness, "
            "include a warning. Set passed=false for concrete issues that require regeneration. "
            "Return concise actionable errors and warnings.\n\n"
            f"ANALYSIS:\n{analysis.model_dump_json(indent=2)}\n\n"
            f"ROADMAP:\n{roadmap.model_dump_json(indent=2)}\n\n"
            f"DRILL:\n{drill.model_dump_json(indent=2)}"
        )
        review = structured_completion(
            self.client,
            self.model,
            ValidationReport,
            "You are a skeptical quality reviewer for educational Python code. Never claim tests ran unless tool evidence is provided.",
            prompt,
        )
        errors = [*preflight.errors, *review.errors]
        return ValidationReport(
            passed=preflight.passed and review.passed and not review.errors,
            errors=errors,
            warnings=[*preflight.warnings, *review.warnings],
        )
