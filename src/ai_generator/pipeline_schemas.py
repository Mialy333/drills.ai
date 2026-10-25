"""Canonical typed contracts for the DRILLS.ai multi-agent pipeline.

Keep these contracts aligned with the browser's DynamicDrillSchema in
src/pages/[lang]/generate.astro. Schema validation does not prove that generated
Python code is correct; runtime checks must remain a separate quality gate.
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RequiredSkill(StrictSchema):
    name: str = Field(min_length=2, max_length=120)
    priority: Literal["Core", "Important", "Supporting"]
    evidence: str = Field(min_length=3, max_length=500)


class RoadmapStep(StrictSchema):
    title: str = Field(min_length=2, max_length=160)
    skill: str = Field(min_length=2, max_length=120)
    objective: str = Field(min_length=5, max_length=600)
    minutes: int = Field(ge=5, le=240)


class MultipleChoiceQuestion(StrictSchema):
    question: str = Field(min_length=5, max_length=600)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer_index: int = Field(ge=0, le=3)
    reasoning: str = Field(min_length=5, max_length=1000)


class RoleAnalysis(StrictSchema):
    role_title: str = Field(min_length=2, max_length=160)
    role_summary: str = Field(min_length=10, max_length=1200)
    required_skills: list[RequiredSkill] = Field(min_length=3, max_length=8)


class LearningRoadmap(StrictSchema):
    roadmap: list[RoadmapStep] = Field(min_length=3, max_length=6)


class DrillContent(StrictSchema):
    drill_id: str = Field(pattern=r"^[A-Za-z0-9_-]{2,40}$")
    family: Literal["Debugging", "Refactoring", "Code reading"]
    title: str = Field(min_length=3, max_length=160)
    context: str = Field(min_length=10, max_length=1600)
    mission: str = Field(min_length=10, max_length=1600)
    broken_code: str = Field(min_length=10, max_length=12000)
    fixed_solution: str = Field(min_length=10, max_length=12000)
    hidden_test_harness: str = Field(min_length=10, max_length=12000)
    multiple_choice: MultipleChoiceQuestion
    model_answer_ideas: list[str] = Field(min_length=3, max_length=5)


class DynamicDrillSchema(RoleAnalysis, LearningRoadmap, DrillContent):
    """Canonical payload expected by the existing browser generator."""

    output_language: Literal["fr", "en"] = "en"


class ValidationReport(StrictSchema):
    passed: bool
    errors: list[str]
    warnings: list[str]
