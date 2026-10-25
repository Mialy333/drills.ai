import asyncio
import json
from pathlib import Path
from mcp import Client
from api import mcp_app as integration
from src.ai_generator.application import ApplicationRequest, ApplicationAnalysis, validate_analysis


def payload():
    result=json.loads(Path('tests/fixtures/application.json').read_text())
    return {'candidate_text':'I built a Python API with FastAPI and wrote pytest tests. This was a personal project.',
            'job_description':'AI Agent Engineer internship. Python and REST APIs are essential. Work on agent tools and tests.',
            'consent':True,'output_language':'en','scope':'in_scope','requirements':result['requirements']}


def test_mcp_discovers_and_scores_using_web_app_rules():
    async def run():
        async with Client(integration.mcp, raise_exceptions=True) as client:
            tools=await client.list_tools()
            assert {tool.name for tool in tools.tools}=={'search_jobs','get_job','get_interview_rubric','score_documented_match'}
            result=await client.call_tool('score_documented_match',{'payload':payload()})
            assert result.structured_content['score']==100
            rubric=await client.call_tool('get_interview_rubric',{'language':'fr'})
            assert len(rubric.structured_content['cases'])==5
            invalid=payload();invalid['requirements'][0]['candidate_quote']='Fabricated Python project experience'
            failed=await client.call_tool('score_documented_match',{'payload':invalid})
            assert failed.is_error
    asyncio.run(run())


def test_mcp_score_matches_web_validation_result():
    data=json.loads(Path('tests/fixtures/application.json').read_text())
    analysis=ApplicationAnalysis.model_validate({k:v for k,v in data.items() if k not in ('score','decision','output_language','interview_questions')})
    request=ApplicationRequest.model_validate({k:v for k,v in payload().items() if k not in ('scope','requirements')})
    web=validate_analysis(analysis,request)
    mcp=integration.score_documented_match(integration.MatchInput.model_validate(payload()))
    assert (web.score,web.decision)==(mcp['score'],mcp['decision'])


def test_mcp_search_uses_only_public_data(monkeypatch):
    async def fake():return {'jobs':[{'id':'test:1','location':'Paris','description':'Full posting','title':'AI Agent Intern','url':'https://example.com'}],'sources':['Test'],'unavailable_sources':[],'checked_at':'2026-10-25'}
    monkeypatch.setattr(integration,'load_jobs',fake)
    result=asyncio.run(integration.search_jobs('Paris'))
    assert len(result['jobs'])==1
    assert 'description' not in result['jobs'][0]
    assert asyncio.run(integration.get_job('test:1'))['description']=='Full posting'


def test_mcp_http_initialization():
    from starlette.testclient import TestClient
    with TestClient(integration.mcp_app) as client:
        response=client.post('/',headers={'Accept':'application/json, text/event-stream'},json={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25','capabilities':{},'clientInfo':{'name':'test','version':'1'}}})
        assert response.status_code==200
        assert response.json()['result']['serverInfo']['name']=='DRILLS.ai opportunities'
