import asyncio
import base64
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from pydantic import ValidationError
from src.ai_generator.interview import AudioRequest, PitchRequest, PitchFeedback, transcribe_audio, review_pitch
from src.ai_generator.application import ApplicationOutputError


def audio(**changes):
    return AudioRequest(**(dict(audio_base64=base64.b64encode(b'\x1a\x45\xdf\xa3'+b'a'*20).decode(),media_type='audio/webm',consent=True)|changes))

@pytest.mark.parametrize('changes',[{'consent':False},{'audio_base64':'not-an-audio-file'},{'audio_base64':base64.b64encode(b'plain-text-not-audio').decode()},{'media_type':'text/html'}])
def test_audio_rejects_invalid_payload(changes):
    with pytest.raises(ValidationError): audio(**changes)


def test_transcription_uses_server_model_and_returns_text(monkeypatch):
    monkeypatch.setenv('OPENAI_TRANSCRIPTION_MODEL','gpt-transcribe')
    create=AsyncMock(return_value=SimpleNamespace(text='I built an agent and wrote integration tests.'))
    client=SimpleNamespace(audio=SimpleNamespace(transcriptions=SimpleNamespace(create=create)))
    result=asyncio.run(transcribe_audio(audio(),client))
    assert result.text.startswith('I built')
    assert create.call_args.kwargs['model']=='gpt-transcribe'
    assert create.call_args.kwargs['file'][0]=='pitch.webm'


def test_mismatched_container_is_rejected_before_provider_call():
    with pytest.raises(ApplicationOutputError): asyncio.run(transcribe_audio(audio(media_type='audio/mp4')))


def test_feedback_uses_fixed_rubric_and_no_response_storage():
    criterion={'observation':'A concrete contribution is present.','next_action':'Explain your test approach with an example.'}
    feedback=PitchFeedback(clarity=criterion,evidence=criterion,relevance=criterion,follow_up_question='What did you test when the API failed?')
    parse=AsyncMock(return_value=SimpleNamespace(output_parsed=feedback))
    client=SimpleNamespace(responses=SimpleNamespace(parse=parse))
    payload=PitchRequest(candidate_text='I built an API with validation and automated tests in a personal project.',job_description='Agent Engineer internship building tools, API calls and automated evaluations.',transcript='I built an API with validation and I want to apply those skills to your agent workflow.',consent=True,output_language='en')
    assert asyncio.run(review_pitch(payload,client))==feedback
    assert parse.call_args.kwargs['store'] is False
    assert parse.call_args.kwargs['text_format'] is PitchFeedback
    assert 'untrusted data' in parse.call_args.kwargs['instructions']


def test_feedback_endpoint_requires_consent_and_private_cache(monkeypatch):
    from fastapi.testclient import TestClient
    from api.main import app
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    response=TestClient(app).post('/api/interview/transcribe',json=audio().model_dump())
    assert response.status_code==503
    assert response.headers['cache-control']=='no-store'
    response=TestClient(app).post('/api/interview/transcribe',json=audio().model_dump()|{'consent':False})
    assert response.status_code==422
