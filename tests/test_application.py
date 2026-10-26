import asyncio
import base64
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api import main as api_main
from src.ai_generator.application import (
    ApplicationAgent, ApplicationAnalysis, ApplicationRequest, ApplicationResult,
    ProfileImportRequest, ImportedProfile, validate_analysis,
)

PROFILE = "2025: I built a Python API with FastAPI and wrote pytest tests. I have not used LangGraph."
POSTING = "AI Agent Engineer internship. Python and REST APIs are essential. LangGraph is a bonus. Six-month internship."


@pytest.fixture
def payload():
    return ApplicationRequest(candidate_text=PROFILE, job_description=POSTING, output_language="en", consent=True)


@pytest.fixture
def result():
    return ApplicationResult.model_validate_json((Path(__file__).parent / "fixtures/application.json").read_text())


@pytest.fixture
def analysis(result):
    return ApplicationAnalysis.model_validate(result.model_dump(exclude={"score", "decision", "output_language", "interview_questions"}))


def test_score_is_calculated_from_evidence_and_weights(analysis, payload):
    missing = analysis.requirements[0].model_copy(update={
        "name": "LangGraph", "priority": "important", "posting_quote": "LangGraph is a bonus",
        "candidate_quote": None, "status": "not_documented",
    })
    analysis.requirements.append(missing)
    result = validate_analysis(analysis, payload)
    assert result.score == 60
    assert result.decision == "prepare"  # Missing desirable skill does not block applying.
    analysis.requirements[0].status = "partial"
    assert validate_analysis(analysis, payload).score == 30


def test_core_gap_and_eligibility_are_not_hidden_by_total(analysis, payload):
    condition = analysis.requirements[0].model_copy(update={
        "name": "Availability", "kind": "eligibility", "posting_quote": "Six-month internship",
        "candidate_quote": None, "status": "not_documented",
    })
    analysis.requirements.append(condition)
    result = validate_analysis(analysis, payload)
    assert result.score == 100
    assert result.decision == "strengthen"


@pytest.mark.parametrize("scope", ["uncertain", "out_of_scope"])
def test_out_of_scope_does_not_display_a_score(analysis, payload, scope):
    analysis.scope = scope
    result = validate_analysis(analysis, payload)
    assert result.score is None
    assert result.decision == "review_scope"


@pytest.mark.parametrize("target", ["posting", "candidate", "cv", "pitch", "duplicate", "contradiction"])
def test_fabricated_or_inconsistent_evidence_is_rejected(analysis, payload, target):
    if target == "posting":
        analysis.requirements[0].posting_quote = "A fabricated job requirement"
    elif target == "candidate":
        analysis.requirements[0].candidate_quote = "Ten years of Kubernetes production experience"
    elif target == "cv":
        analysis.cv_sections[0].source_quotes = ["A fictional university degree"]
    elif target == "pitch":
        analysis.pitch.source_quotes = ["Increased revenue by 900 percent"]
    elif target == "duplicate":
        analysis.requirements.append(analysis.requirements[0].model_copy())
    else:
        analysis.requirements[0].status = "not_documented"
    with pytest.raises(ValueError):
        validate_analysis(analysis, payload)


def test_responses_api_uses_schema_no_storage_and_only_approved_inputs(analysis, payload, monkeypatch):
    parse = AsyncMock(return_value=SimpleNamespace(output_parsed=as_selection(analysis)))
    monkeypatch.setenv("OPENAI_APPLICATION_MODEL", "test-model")
    agent = ApplicationAgent(SimpleNamespace(responses=SimpleNamespace(parse=parse)))
    result = asyncio.run(agent.prepare(payload))
    assert result.score == 100
    args = parse.call_args.kwargs
    assert args["store"] is False
    assert args["model"] == "test-model"
    assert issubclass(args["text_format"], ApplicationAnalysis)
    assert set(json.loads(args["input"])) == {"profile_excerpts", "job_excerpts", "output_language"}


def test_refusal_does_not_become_a_successful_application(payload):
    client = SimpleNamespace(responses=SimpleNamespace(parse=AsyncMock(return_value=SimpleNamespace(output_parsed=None))))
    with pytest.raises(ValueError):
        asyncio.run(ApplicationAgent(client).prepare(payload))


@pytest.mark.parametrize("data", ["not-base64!", base64.b64encode(b"<html>fake.pdf</html>").decode(), base64.b64encode(b"%PDF-" + b"x" * (4 * 1024 * 1024)).decode()])
def test_pdf_validation_rejects_bad_format_and_oversize(data):
    with pytest.raises(ValidationError):
        ProfileImportRequest(pdf_base64=data, consent=True)


def test_pdf_import_is_in_memory_and_not_stored():
    parse = AsyncMock(return_value=SimpleNamespace(output_parsed=ImportedProfile(candidate_text=PROFILE)))
    request = ProfileImportRequest(pdf_base64=base64.b64encode(b"%PDF-test fixture").decode(), consent=True)
    imported = asyncio.run(ApplicationAgent(SimpleNamespace(responses=SimpleNamespace(parse=parse))).import_pdf(request))
    assert imported.candidate_text == PROFILE
    assert parse.call_args.kwargs["store"] is False
    content = parse.call_args.kwargs["input"][0]["content"][0]
    assert content["type"] == "input_file"
    assert content["filename"] == "candidate.pdf"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api_main.limiter, "enabled", False)
    monkeypatch.setenv("OPENAI_API_KEY", "offline-test-key")
    return TestClient(api_main.app)


def test_api_requires_explicit_consent(client, payload):
    for consent in [False, None]:
        body = payload.model_dump()
        body["consent"] = consent
        assert client.post("/api/application", json=body).status_code == 422


def test_api_requires_server_key(client, payload, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY")
    assert client.post("/api/application", json=payload.model_dump()).status_code == 503


def test_api_returns_private_response_and_sanitizes_errors(client, payload, result, monkeypatch, caplog):
    prepare = AsyncMock(return_value=result)
    monkeypatch.setattr(api_main.ApplicationAgent, "prepare", prepare)
    response = client.post("/api/application", json=payload.model_dump())
    assert response.status_code == 200
    assert response.json()["score"] == 100
    assert response.headers["cache-control"] == "no-store"
    prepare.side_effect = RuntimeError("private-candidate-data-DO-NOT-LOG")
    response = client.post("/api/application", json=payload.model_dump())
    assert response.status_code == 502
    assert "private-candidate-data" not in response.text + caplog.text


def test_pdf_endpoint_requires_consent_and_returns_extraction(client, monkeypatch):
    monkeypatch.setattr(api_main.ApplicationAgent, "import_pdf", AsyncMock(return_value=ImportedProfile(candidate_text=PROFILE)))
    body = {"pdf_base64": base64.b64encode(b"%PDF-fixture").decode(), "consent": True}
    response = client.post("/api/profile-import", json=body)
    assert response.status_code == 200
    assert response.json()["candidate_text"] == PROFILE
    body["consent"] = False
    assert client.post("/api/profile-import", json=body).status_code == 422


def test_application_rate_limit_blocks_fourth_call(client, payload, result, monkeypatch):
    monkeypatch.setattr(api_main.limiter, "enabled", True)
    api_main.limiter.reset()
    monkeypatch.setattr(api_main.ApplicationAgent, "prepare", AsyncMock(return_value=result))
    try:
        codes = [client.post("/api/application", json=payload.model_dump()).status_code for _ in range(4)]
        assert codes == [200, 200, 200, 429]
    finally:
        api_main.limiter.reset()


def test_interview_cases_are_fixed_bilingual_catalog_not_model_output():
    from src.ai_generator.application import select_interview_cases
    assert "interview_questions" not in ApplicationAnalysis.model_fields
    api_cases = select_interview_cases("API tool workflow retry MCP", "en")
    eval_cases = select_interview_cases("evaluation test quality monitor", "en")
    assert api_cases[0].question == "A tool fails: what should your agent do?"
    assert eval_cases[0].question == "How would you demonstrate that your agent improved?"
    from src.ai_generator.technical_interview import load_catalog
    titles = {case['en']['title'] for case in load_catalog()['cases']}
    assert len(api_cases) == len(eval_cases) == 3
    assert {case.question for case in api_cases + eval_cases} <= titles
    assert len(select_interview_cases("sécurité RAG", "fr")) == 3
    assert "frontières de confiance" in select_interview_cases("sécurité RAG", "fr")[0].looking_for


def test_typographic_apostrophes_are_accepted_but_changed_facts_are_not():
    from src.ai_generator.application import _quote_exists
    assert _quote_exists("J'ai conçu une API", "J’ai conçu une API")
    assert _quote_exists("évaluation des agents", "e\u0301valuation des agents")
    assert not _quote_exists("10 years of experience", "2 years of experience")
    assert not _quote_exists("I deployed a production agent", "I did not deploy any production agent")


def test_invalid_quotes_get_one_repair_then_validate_original_sources(analysis, payload):
    analysis = as_selection(analysis)
    invalid = analysis.model_copy(deep=True)
    invalid.pitch.source_quotes = ["A fabricated private achievement"]
    parse = AsyncMock(side_effect=[SimpleNamespace(output_parsed=invalid), SimpleNamespace(output_parsed=analysis)])
    result = asyncio.run(ApplicationAgent(SimpleNamespace(responses=SimpleNamespace(parse=parse))).prepare(payload))
    assert result.score == 100
    assert parse.await_count == 2
    assert "draft_quote:" in parse.call_args.kwargs["instructions"]
    assert "A fabricated private achievement" not in parse.call_args.kwargs["instructions"]
    assert json.loads(parse.call_args.kwargs["input"])["profile_excerpts"]["profile_0"] == PROFILE


def test_persistent_invalid_quotes_never_create_a_score_or_retry_loop(analysis, payload):
    from src.ai_generator.application import EvidenceError
    analysis = as_selection(analysis)
    analysis.requirements[0].candidate_quote = "Invented skill that is absent from the CV"
    parse = AsyncMock(return_value=SimpleNamespace(output_parsed=analysis))
    with pytest.raises(EvidenceError, match="candidate_quote:0"):
        asyncio.run(ApplicationAgent(SimpleNamespace(responses=SimpleNamespace(parse=parse))).prepare(payload))
    assert parse.await_count == 2


def test_evidence_failure_has_safe_api_code(client, payload, monkeypatch, caplog):
    from src.ai_generator.application import EvidenceError
    monkeypatch.setattr(api_main.ApplicationAgent, "prepare", AsyncMock(side_effect=EvidenceError("draft_quote:2")))
    response = client.post("/api/application", json=payload.model_dump())
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "evidence_validation"
    assert "draft_quote:2" in caplog.text
    assert PROFILE not in caplog.text + response.text


def as_selection(analysis):
    selected = analysis.model_copy(deep=True)
    for requirement in selected.requirements:
        requirement.posting_quote = "job_0"
        requirement.candidate_quote = None if requirement.status == "not_documented" else "profile_0"
    for section in [*selected.cv_sections, selected.pitch]:
        section.source_quotes = ["profile_0"]
    return selected


def test_reference_schema_and_resolution_preserve_original_quotes(analysis, payload):
    from src.ai_generator.application import source_excerpts, selection_schema, resolve_selection
    profile = source_excerpts(PROFILE, "profile")
    posting = source_excerpts(POSTING, "job")
    schema = selection_schema(profile, posting)
    selected = schema.model_validate(as_selection(analysis).model_dump())
    resolved = resolve_selection(selected, profile, posting)
    assert resolved.requirements[0].candidate_quote == PROFILE
    assert resolved.pitch.source_quotes == [PROFILE]
    assert validate_analysis(resolved, payload).score == 100
    bad = selected.model_dump()
    bad["pitch"]["source_quotes"] = ["job_0"]
    with pytest.raises(ValidationError):
        schema.model_validate(bad)
    bad["pitch"]["source_quotes"] = ["profile_999"]
    with pytest.raises(ValidationError):
        schema.model_validate(bad)


def test_source_slices_keep_original_text_and_fit_public_quote_limits():
    from src.ai_generator.application import source_excerpts
    text = "L’expérience réelle : je n’ai pas déployé cet agent. " * 200
    excerpts = source_excerpts(text, "profile")
    assert len(excerpts) > 1
    assert all(8 <= len(value) <= 600 and value in text for value in excerpts.values())
    assert any("je n’ai pas déployé" in value for value in excerpts.values())


def test_fast_assessment_excludes_drafts_and_preserves_score_and_evidence(analysis, payload):
    from src.ai_generator.application import selection_schema, source_excerpts
    selected = as_selection(analysis)
    schema = selection_schema(source_excerpts(PROFILE,"profile"),source_excerpts(POSTING,"job"),assessment_only=True)
    assessment = schema.model_validate(selected.model_dump(include={'role_title','scope','scope_reason','requirements'}))
    parse = AsyncMock(return_value=SimpleNamespace(output_parsed=assessment))
    result = asyncio.run(ApplicationAgent(SimpleNamespace(responses=SimpleNamespace(parse=parse))).assess(payload))
    assert result.score == 100 and result.drafts_pending is True
    assert result.cv_sections == [] and result.pitch is None
    assert result.requirements[0].candidate_quote == PROFILE
    schema = parse.call_args.kwargs['text_format'].model_fields
    assert 'cv_sections' not in schema and 'pitch' not in schema
    assert parse.await_count == 1
    assert parse.call_args.kwargs['store'] is False


def test_lazy_drafts_keep_assessment_and_reject_fabricated_sources(analysis, payload):
    from src.ai_generator.application import AssessmentAnalysis, ApplicationDraftRequest, ApplicationDrafts, EvidenceError
    assessment = AssessmentAnalysis.model_validate(analysis.model_dump(include={'role_title','scope','scope_reason','requirements'}))
    request = ApplicationDraftRequest(**payload.model_dump(), assessment=assessment)
    selected = as_selection(analysis)
    drafts = ApplicationDrafts(cv_sections=selected.cv_sections, pitch=selected.pitch)
    parse = AsyncMock(return_value=SimpleNamespace(output_parsed=drafts))
    agent = ApplicationAgent(SimpleNamespace(responses=SimpleNamespace(parse=parse)))
    result = asyncio.run(agent.draft(request))
    assert result.requirements == assessment.requirements and result.score == 100
    assert result.pitch.source_quotes == [PROFILE]
    assert set(parse.call_args.kwargs['text_format'].model_fields) == {'cv_sections','pitch'}
    drafts.pitch.source_quotes = ['invented_profile_id']
    parse.reset_mock()
    with pytest.raises(EvidenceError):
        asyncio.run(agent.draft(request))
    assert parse.await_count == 2
    request.assessment.requirements[0].candidate_quote = 'A fabricated qualification not in this CV'
    parse.reset_mock()
    with pytest.raises(EvidenceError):
        asyncio.run(agent.draft(request))
    assert parse.await_count == 0


def test_split_endpoints_require_consent_and_keep_private_responses(client, payload, analysis, result, monkeypatch):
    from src.ai_generator.application import AssessmentResult
    brief = AssessmentResult(**result.model_dump(exclude={'cv_sections','pitch'}))
    monkeypatch.setattr(api_main.ApplicationAgent, 'assess', AsyncMock(return_value=brief))
    monkeypatch.setattr(api_main.ApplicationAgent, 'draft', AsyncMock(return_value=result))
    body = payload.model_dump()
    response = client.post('/api/assessment', json=body)
    assert response.status_code == 200 and response.json()['drafts_pending']
    assert response.headers['cache-control'] == 'no-store'
    body['assessment'] = analysis.model_dump(include={'role_title','scope','scope_reason','requirements'})
    response = client.post('/api/application-drafts', json=body)
    assert response.status_code == 200 and response.json()['score'] == 100
    assert response.headers['cache-control'] == 'no-store'
    body['consent'] = False
    assert client.post('/api/application-drafts',json=body).status_code == 422
    del body['assessment']
    assert client.post('/api/assessment',json=body).status_code == 422


def text_pdf(text):
    import io
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
    writer=PdfWriter()
    page=writer.add_blank_page(width=595,height=842)
    font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
    page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
    stream=DecodedStreamObject();stream.set_data(('BT /F1 12 Tf 40 780 Td ('+text.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')+') Tj ET').encode())
    page[NameObject('/Contents')]=writer._add_object(stream)
    output=io.BytesIO();writer.write(output);return output.getvalue()


def test_text_pdf_import_avoids_model_and_keeps_original_facts():
    parse=AsyncMock()
    request=ProfileImportRequest(pdf_base64=base64.b64encode(text_pdf(PROFILE)).decode(),consent=True)
    imported=asyncio.run(ApplicationAgent(SimpleNamespace(responses=SimpleNamespace(parse=parse))).import_pdf(request))
    assert imported.candidate_text == PROFILE
    assert parse.await_count == 0


def test_blank_or_invalid_pdf_uses_model_fallback():
    from src.ai_generator.pdf_text import extract_pdf_text
    assert asyncio.run(extract_pdf_text(b'%PDF-invalid')) is None
    assert asyncio.run(extract_pdf_text(text_pdf('Too short'))) is None


def test_pdf_worker_is_killed_on_timeout(monkeypatch):
    from src.ai_generator import pdf_text
    class Worker:
        returncode = None
        killed = False
        async def communicate(self, data):
            raise asyncio.TimeoutError()
        def kill(self):
            self.killed = True
        async def wait(self):
            self.returncode = -9
    worker=Worker()
    monkeypatch.setattr(pdf_text.asyncio,'create_subprocess_exec',AsyncMock(return_value=worker))
    assert asyncio.run(pdf_text.extract_pdf_text(b'%PDF-test')) is None
    assert worker.killed
