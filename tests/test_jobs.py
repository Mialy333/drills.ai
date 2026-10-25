import asyncio
import httpx
import pytest
from src.integrations import jobs


def item(title='AI Agent Engineer Intern'):
    return {'id': 1, 'title': title, 'content': '&lt;p&gt;Build AI agents and test APIs.&lt;/p&gt;', 'absolute_url': 'https://example.com/jobs/1', 'location': {'name': 'Paris'}}

@pytest.mark.parametrize('title', ['Senior Agent Engineer', 'Staff Engineer Intern', 'Agent Engineer', 'Marketing Intern', 'Engineering Manager'])
def test_non_junior_or_non_engineering_titles_are_excluded(title):
    assert jobs.qualify(item(title), 'anthropic') is None


def test_intern_has_real_source_and_plain_description():
    result = jobs.qualify(item(), 'anthropic')
    assert result['url'] == 'https://example.com/jobs/1'
    assert 'Build AI agents' in result['description']
    assert '<p>' not in result['description']
    assert jobs.plain_text('<p>Keep</p><script>secret()</script>') == 'Keep'


def test_non_agent_internship_is_excluded():
    job = item('Software Engineer Intern'); job['content'] = 'Build frontend websites.'
    assert jobs.qualify(job, 'anthropic') is None


def test_bad_protocol_is_excluded():
    job = item(); job['absolute_url'] = 'javascript:alert(1)'
    assert jobs.qualify(job, 'anthropic') is None


def test_partial_provider_failure_is_reported(monkeypatch):
    real_client = httpx.AsyncClient
    def handler(request):
        if '/databricks/' in str(request.url): return httpx.Response(503)
        return httpx.Response(200, json={'jobs':[item()]})
    monkeypatch.setattr(jobs, '_cache', None)
    monkeypatch.setattr(jobs.httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(handler), trust_env=False, **kwargs))
    result = asyncio.run(jobs.load_jobs())
    assert len(result['jobs']) == 2
    assert result['unavailable_sources'] == ['Databricks']
    assert jobs._cache is None


def test_jobs_endpoint_does_not_require_openai_key(monkeypatch):
    from fastapi.testclient import TestClient
    from api.main import app
    async def fake(): return {'jobs':[], 'unavailable_sources':[], 'checked_at':'2026-10-25', 'sources':list(jobs.BOARDS.values())}
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    monkeypatch.setattr(jobs, 'load_jobs', fake)
    response = TestClient(app).get('/api/jobs')
    assert response.status_code == 200
    assert response.json()['jobs'] == []
