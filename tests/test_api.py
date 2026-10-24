import os
from fastapi.testclient import TestClient

from api import main as api_main


def test_health_reports_service_and_generator_configuration(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    response = TestClient(api_main.app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "generator_configured": True}


def test_generate_rejects_short_job_posting():
    response = TestClient(api_main.app).post(
        "/api/drills",
        json={"job_description": "too short", "output_language": "fr"},
    )

    assert response.status_code == 422


def test_generate_requires_server_side_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = TestClient(api_main.app).post(
        "/api/drills",
        json={
            "job_description": "We need an AI agent engineer with Python and FastAPI experience.",
            "output_language": "en",
        },
    )

    assert response.status_code == 503


def test_generate_uses_specialist_pipeline_and_returns_browser_payload(monkeypatch):
    from src.ai_generator.pipeline_schemas import DynamicDrillSchema

    payload = {
        "output_language": "fr",
        "role_title": "Ingénieur IA",
        "role_summary": "Conçoit des systèmes Python avec des agents IA.",
        "required_skills": [
            {"name": "Python", "priority": "Core", "evidence": "Python est requis."},
            {"name": "FastAPI", "priority": "Important", "evidence": "Créer une API FastAPI."},
            {"name": "Agents IA", "priority": "Supporting", "evidence": "Construire des agents IA."},
        ],
        "roadmap": [
            {"title": "Étape 1", "skill": "Python", "objective": "Pratiquer Python.", "minutes": 30},
            {"title": "Étape 2", "skill": "FastAPI", "objective": "Créer une route API.", "minutes": 30},
            {"title": "Étape 3", "skill": "Agents IA", "objective": "Corriger un agent.", "minutes": 45},
        ],
        "drill_id": "api-drill-1",
        "family": "Debugging",
        "title": "Corriger un agent",
        "context": "Un agent traite mal les données reçues.",
        "mission": "Corrige la fonction afin de traiter les données correctement.",
        "broken_code": "def process(data):\n    return data[0]",
        "fixed_solution": "def process(data):\n    return data",
        "hidden_test_harness": "def test_process():\n    assert process([1, 2]) == [1, 2]",
        "multiple_choice": {
            "question": "Pourquoi tester les entrées ?",
            "options": ["A", "B", "C", "D"],
            "correct_answer_index": 0,
            "reasoning": "Les tests vérifient le comportement attendu.",
        },
        "model_answer_ideas": ["Validation", "Tests", "Cas limites"],
    }

    class FakeOrchestrator:
        def generate(self, job_description, output_language, learner_snapshot=None):
            assert "Python" in job_description
            assert output_language == "French"
            assert learner_snapshot == "Python: 3/4 quiz answers correct"
            return DynamicDrillSchema.model_validate(payload)

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(api_main, "DrillOrchestrator", FakeOrchestrator)

    response = TestClient(api_main.app).post(
        "/api/drills",
        json={
            "job_description": "We need an AI agent engineer with Python and FastAPI experience.",
            "output_language": "fr",
            "learner_snapshot": "Python: 3/4 quiz answers correct",
        },
    )

    assert response.status_code == 200
    assert response.json()["output_language"] == "fr"
    assert response.json()["drill_id"] == "api-drill-1"
