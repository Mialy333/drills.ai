"""Offline tests for deterministic agent-pipeline validation."""
from unittest.mock import Mock

import pytest

from src.ai_generator.agents.validator import ValidatorAgent, validate_dynamic_drill
from src.ai_generator.pipeline_schemas import (
    DrillContent,
    LearningRoadmap,
    MultipleChoiceQuestion,
    RequiredSkill,
    RoleAnalysis,
    RoadmapStep,
)


@pytest.fixture
def analysis() -> RoleAnalysis:
    return RoleAnalysis(
        role_title="Python AI Engineer",
        role_summary="Builds Python services that integrate AI models.",
        required_skills=[
            RequiredSkill(name="Python", priority="Core", evidence="Strong Python skills"),
            RequiredSkill(name="API design", priority="Important", evidence="Design robust APIs"),
            RequiredSkill(name="Pydantic", priority="Supporting", evidence="Pydantic validation"),
        ],
    )


@pytest.fixture
def roadmap() -> LearningRoadmap:
    return LearningRoadmap(
        roadmap=[
            RoadmapStep(title="Review Python", skill="Python", objective="Handle exceptions safely.", minutes=30),
            RoadmapStep(title="Build an API", skill="API design", objective="Validate a request payload.", minutes=45),
            RoadmapStep(title="Validate data", skill="Pydantic", objective="Reject malformed model output.", minutes=60),
        ]
    )


@pytest.fixture
def drill() -> DrillContent:
    return DrillContent(
        drill_id="D-01",
        family="Debugging",
        title="Reject malformed output",
        context="An AI service accepts malformed structured output.",
        mission="Fix the validation flow and preserve a useful error.",
        broken_code="def validate(payload):\n    return payload['name']",
        fixed_solution=(
            "def validate(payload):\n"
            "    if not isinstance(payload, dict) or 'name' not in payload:\n"
            "        raise ValueError('missing name')\n"
            "    return payload['name']"
        ),
        hidden_test_harness=(
            "assert validate({'name': 'Ada'}) == 'Ada'\n"
            "try:\n"
            "    validate({})\n"
            "except ValueError:\n"
            "    pass\n"
            "else:\n"
            "    raise AssertionError('expected validation failure')"
        ),
        multiple_choice=MultipleChoiceQuestion(
            question="Why validate input at the boundary?",
            options=["To reject invalid data", "To increase latency", "To hide errors", "To remove types"],
            correct_answer_index=0,
            reasoning="Boundary validation rejects malformed input before downstream processing.",
        ),
        model_answer_ideas=["input validation", "clear errors", "trust boundary"],
    )


def test_valid_content_passes_static_preflight(analysis, roadmap, drill):
    report = validate_dynamic_drill(analysis, roadmap, drill)
    assert report.passed is True
    assert report.errors == []
    assert any("sandbox" in warning.lower() for warning in report.warnings)


def test_identical_broken_and_fixed_code_fails(analysis, roadmap, drill):
    drill.fixed_solution = drill.broken_code
    report = validate_dynamic_drill(analysis, roadmap, drill)
    assert report.passed is False
    assert any("identical" in error for error in report.errors)


def test_missing_test_assertions_fails(analysis, roadmap, drill):
    drill.hidden_test_harness = "print('hello')"
    report = validate_dynamic_drill(analysis, roadmap, drill)
    assert report.passed is False
    assert any("assertion" in error.lower() for error in report.errors)


@pytest.mark.parametrize(
    "harness",
    [
        "# assert validate({'name': 'Ada'}) == 'Ada'",
        "message = \"assert this is only a string\"",
        "print('assert')",
    ],
)
def test_assert_text_in_comment_or_string_is_not_a_test(harness, analysis, roadmap, drill):
    drill.hidden_test_harness = harness
    report = validate_dynamic_drill(analysis, roadmap, drill)
    assert report.passed is False
    assert any("real Python assert" in error for error in report.errors)


def test_invalid_harness_syntax_fails(analysis, roadmap, drill):
    drill.hidden_test_harness = "assert ("
    report = validate_dynamic_drill(analysis, roadmap, drill)
    assert report.passed is False
    assert any("not valid Python syntax" in error for error in report.errors)


@pytest.mark.parametrize("field", ["broken_code", "fixed_solution"])
def test_invalid_implementation_syntax_fails(field, analysis, roadmap, drill):
    setattr(drill, field, "def incomplete(:")
    report = validate_dynamic_drill(analysis, roadmap, drill)
    assert report.passed is False
    assert any(field in error and "syntax" in error.lower() for error in report.errors)


def test_roadmap_must_reference_analyzed_skill(analysis, roadmap, drill):
    roadmap.roadmap[-1].skill = "Kubernetes"
    report = validate_dynamic_drill(analysis, roadmap, drill)
    assert report.passed is False
    assert any("not found in the analysis" in error for error in report.errors)


def test_validator_skips_model_review_when_preflight_fails(analysis, roadmap, drill):
    client = Mock()
    drill.hidden_test_harness = "print('no assertions')"
    report = ValidatorAgent(client=client).validate(analysis, roadmap, drill)
    assert report.passed is False
    client.beta.chat.completions.parse.assert_not_called()
