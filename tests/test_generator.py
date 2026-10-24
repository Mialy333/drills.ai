"""Offline regression tests for the legacy generator and specialist creator."""
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from src.ai_generator.agent import DrillGeneratorAgent
from src.ai_generator.agents.base import structured_completion
from src.ai_generator.agents.creator import DrillCreatorAgent
from src.ai_generator.pipeline_schemas import (
    DrillContent,
    MultipleChoiceQuestion,
    RequiredSkill,
    RoleAnalysis,
    RoadmapStep,
)
from src.ai_generator.schemas import DrillGeneratorSchema


@pytest.fixture
def legacy_drill() -> DrillGeneratorSchema:
    return DrillGeneratorSchema(
        drill_id="D-01",
        family="Debugging",
        title="Validate a request",
        context="A service accepts a malformed request payload.",
        mission="Reject malformed input before accessing its fields.",
        broken_code="def read_name(payload):\n    return payload['name']",
        fixed_solution=(
            "def read_name(payload):\n"
            "    if not isinstance(payload, dict) or 'name' not in payload:\n"
            "        raise ValueError('missing name')\n"
            "    return payload['name']"
        ),
        hidden_test_harness="assert read_name({'name': 'Ada'}) == 'Ada'",
        multiple_choice={
            "question": "Why validate input?",
            "options": ["Safety", "Decoration", "Latency", "Formatting"],
            "correct_answer_index": 0,
            "reasoning": "Validation rejects malformed values at the boundary.",
        },
        model_answer_ideas=["validation", "boundary", "errors"],
    )


@pytest.fixture
def role_analysis() -> RoleAnalysis:
    return RoleAnalysis(
        role_title="Python Engineer",
        role_summary="Builds and maintains Python services and APIs.",
        required_skills=[
            RequiredSkill(name="Python", priority="Core", evidence="Strong Python skills"),
            RequiredSkill(name="API design", priority="Important", evidence="Design robust APIs"),
            RequiredSkill(name="Testing", priority="Supporting", evidence="Write automated tests"),
        ],
    )


@pytest.fixture
def target_step() -> RoadmapStep:
    return RoadmapStep(
        title="Validate API input",
        skill="API design",
        objective="Reject malformed payloads with clear errors.",
        minutes=30,
    )


@pytest.fixture
def pipeline_drill() -> DrillContent:
    return DrillContent(
        drill_id="D-02",
        family="Debugging",
        title="Validate a request",
        context="A service accepts a malformed request payload.",
        mission="Reject malformed input before accessing its fields.",
        broken_code="def read_name(payload):\n    return payload['name']",
        fixed_solution=(
            "def read_name(payload):\n"
            "    if not isinstance(payload, dict) or 'name' not in payload:\n"
            "        raise ValueError('missing name')\n"
            "    return payload['name']"
        ),
        hidden_test_harness="assert read_name({'name': 'Ada'}) == 'Ada'",
        multiple_choice=MultipleChoiceQuestion(
            question="Why validate input?",
            options=["Safety", "Decoration", "Latency", "Formatting"],
            correct_answer_index=0,
            reasoning="Validation rejects malformed values at the boundary.",
        ),
        model_answer_ideas=["validation", "boundary", "errors"],
    )


def _completion(parsed=None, *, choices=True, refusal=None):
    message = SimpleNamespace(parsed=parsed, refusal=refusal)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)] if choices else [])


def test_legacy_generator_returns_first_parsed_choice(legacy_drill):
    client = Mock()
    client.beta.chat.completions.parse.return_value = _completion(legacy_drill)
    with patch("src.ai_generator.agent.OpenAI", return_value=client):
        agent = DrillGeneratorAgent()

    result = agent.generate_drill_from_job("Python engineer who builds APIs")

    assert result == legacy_drill
    client.beta.chat.completions.parse.assert_called_once()
    kwargs = client.beta.chat.completions.parse.call_args.kwargs
    assert kwargs["response_format"] is DrillGeneratorSchema
    assert "Python engineer who builds APIs" in kwargs["messages"][1]["content"]


def test_legacy_generator_rejects_empty_job_description():
    client = Mock()
    with patch("src.ai_generator.agent.OpenAI", return_value=client):
        agent = DrillGeneratorAgent()
    with pytest.raises(ValueError, match="must not be empty"):
        agent.generate_drill_from_job("  ")
    client.beta.chat.completions.parse.assert_not_called()


@pytest.mark.parametrize(
    ("completion", "message"),
    [
        (_completion(choices=False), "no choices"),
        (_completion(parsed=None), "did not return a parsed response"),
    ],
)
def test_legacy_generator_handles_empty_or_unparsed_response(completion, message):
    client = Mock()
    client.beta.chat.completions.parse.return_value = completion
    with patch("src.ai_generator.agent.OpenAI", return_value=client):
        agent = DrillGeneratorAgent()
    with pytest.raises(RuntimeError, match=message):
        agent.generate_drill_from_job("Python engineer")


def test_legacy_generator_wraps_provider_errors():
    client = Mock()
    client.beta.chat.completions.parse.side_effect = ValueError("offline mock failure")
    with patch("src.ai_generator.agent.OpenAI", return_value=client):
        agent = DrillGeneratorAgent()
    with pytest.raises(RuntimeError, match="Critical error mapping layout via OpenAI API"):
        agent.generate_drill_from_job("Python engineer")


def test_specialist_creator_uses_structured_completion_without_network(
    role_analysis, target_step, pipeline_drill
):
    client = Mock()
    with patch(
        "src.ai_generator.agents.creator.structured_completion",
        return_value=pipeline_drill,
    ) as complete:
        agent = DrillCreatorAgent(client=client, model="offline-test")
        result = agent.create_drill(role_analysis, target_step, output_language="French")

    assert result is pipeline_drill
    args = complete.call_args.args
    assert args[:3] == (client, "offline-test", DrillContent)
    assert "French" in args[4]
    assert "API design" in args[4]
    client.beta.chat.completions.parse.assert_not_called()


def test_structured_completion_returns_parsed_model():
    expected = SimpleNamespace(answer="ok")
    client = Mock()
    client.beta.chat.completions.parse.return_value = _completion(expected)

    result = structured_completion(client, "offline-test", DrillGeneratorSchema, "system", "user")

    assert result is expected
    client.beta.chat.completions.parse.assert_called_once_with(
        model="offline-test",
        messages=[{"role": "system", "content": "system"}, {"role": "user", "content": "user"}],
        response_format=DrillGeneratorSchema,
    )


@pytest.mark.parametrize(
    ("completion", "message"),
    [
        (_completion(choices=False), "no choices"),
        (_completion(parsed=None, refusal="request refused"), "request refused"),
    ],
)
def test_structured_completion_reports_missing_results(completion, message):
    client = Mock()
    client.beta.chat.completions.parse.return_value = completion
    with pytest.raises(RuntimeError, match=message):
        structured_completion(client, "offline-test", DrillGeneratorSchema, "system", "user")


def test_structured_completion_wraps_provider_errors():
    client = Mock()
    client.beta.chat.completions.parse.side_effect = ValueError("offline mock failure")
    with pytest.raises(RuntimeError, match="Structured generation failed"):
        structured_completion(client, "offline-test", DrillGeneratorSchema, "system", "user")
