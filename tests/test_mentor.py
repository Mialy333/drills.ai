from types import SimpleNamespace
from unittest.mock import Mock

from api.main import CompanionRequest
from src.ai_generator.agents.mentor import MentorAgent


def test_mentor_sends_only_allowlisted_context_and_returns_text():
    client = Mock()
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="Check the input boundary first."))]
    )
    payload = CompanionRequest.model_validate(
        {
            "output_language": "en",
            "message": "Where should I start?",
            "learner": {"python_experience": "some"},
            "exercise": {
                "title": "Validate a request",
                "context": "An API accepts untrusted data.",
                "mission": "Validate the input before using it.",
                "current_answer": "def validate(payload): pass",
                "latest_feedback": "One test failed.",
            },
            "lesson": {
                "title": "Build an MCP server",
                "objective": "Implement a validated tool.",
                "sequence": "Practice",
                "instructions": "Return the calculated value.",
                "code": "def calculate_total(price, quantity): pass",
            },
            "history": [{"role": "user", "content": "What is a boundary?"}],
        }
    )

    reply = MentorAgent(client=client, model="offline-test").respond(payload)

    assert reply == "Check the input boundary first."
    kwargs = client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "offline-test"
    assert "progressive hint" in kwargs["messages"][0]["content"]
    assert "reference solution" in kwargs["messages"][0]["content"]
    context = kwargs["messages"][1]["content"]
    assert "current_answer" in context
    assert "fixed_solution" not in context
    assert "hidden_test_harness" not in context
    assert '"lesson"' in context
    assert "calculate_total" in context
    assert "reference solution" in kwargs["messages"][0]["content"]
    assert kwargs["messages"][-1] == {"role": "user", "content": "Where should I start?"}


def test_mentor_rejects_empty_provider_response():
    client = Mock()
    client.chat.completions.create.return_value = SimpleNamespace(choices=[])
    payload = CompanionRequest(output_language="fr", message="Explique-moi.")

    try:
        MentorAgent(client=client).respond(payload)
    except RuntimeError as error:
        assert "no response" in str(error)
    else:
        raise AssertionError("An empty provider response should be rejected.")
