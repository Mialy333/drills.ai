import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from pydantic import ValidationError
from src.ai_generator.technical_interview import TechnicalRequest, TechnicalFeedback, review_technical
from src.ai_generator.application import ApplicationOutputError

ANSWER='I separate reads from writes, retry stock calls with a limit and check the reservation status before creating it again.'

def payload(**changes):
    return TechnicalRequest(**(dict(case_id='tool-failure',answer=ANSWER,output_language='fr',consent=True)|changes))

def feedback():
    return dict(criteria=[dict(criterion_index=i,status='partial',answer_quote='I separate reads from writes',explanation='La distinction est présente, mais reste à préciser.',next_action='Explique ce que tu fais après une erreur réseau.') for i in range(4)])

def client(data):
    parse=AsyncMock(return_value=SimpleNamespace(output_parsed=TechnicalFeedback(**data)))
    return SimpleNamespace(responses=SimpleNamespace(parse=parse)),parse

@pytest.mark.parametrize('changes',[{'case_id':'invented'},{'consent':False},{'answer':'short'}])
def test_invalid_request(changes):
    with pytest.raises(ValidationError):payload(**changes)

def test_server_owned_rubric_sources_and_language():
    connection,parse=client(feedback());result=asyncio.run(review_technical(payload(),connection))
    assert result['rubric_version']==3
    assert result['provenance']['employer_interview'] is False
    assert len(result['references'])==4
    assert result['criteria'][0]['criterion'].startswith('Distinguer')
    args=parse.call_args.kwargs
    assert args['store'] is False
    assert 'French (français)' in args['instructions']
    assert 'untrusted data' in args['instructions']

@pytest.mark.parametrize('mutation',['quote','duplicate','missing_quote'])
def test_invalid_model_feedback_is_rejected(mutation):
    data=feedback()
    if mutation=='quote':data['criteria'][0]['answer_quote']='A claim the candidate never made'
    if mutation=='duplicate':data['criteria'][1]['criterion_index']=0
    if mutation=='missing_quote':data['criteria'][0]['status']='missing'
    connection,_=client(data)
    with pytest.raises(ApplicationOutputError):asyncio.run(review_technical(payload(),connection))

def test_missing_is_not_an_incorrect_statement():
    data=feedback();data['criteria'][3].update(status='missing',answer_quote=None)
    connection,_=client(data);result=asyncio.run(review_technical(payload(),connection))
    assert result['criteria'][3]['status']=='missing'
    assert result['criteria'][3]['answer_quote'] is None

def test_endpoint_consent_and_no_store(monkeypatch):
    from fastapi.testclient import TestClient
    from api.main import app
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    response=TestClient(app).post('/api/interview/technical',json=payload().model_dump())
    assert response.status_code==410
    assert response.headers['cache-control']=='no-store'
    assert TestClient(app).post('/api/interview/technical',json=payload().model_dump()|{'consent':False}).status_code==422
