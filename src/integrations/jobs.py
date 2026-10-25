"""Read-only Greenhouse shortlist. No CV data is sent to the job provider."""
import asyncio
import html
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from time import monotonic
from urllib.parse import urlparse
import httpx

BOARDS = {'anthropic': 'Anthropic', 'databricks': 'Databricks', 'scaleai': 'Scale AI'}
ASHBY_BOARDS = {'mistral.ai': 'Mistral AI', 'dust': 'Dust'}
_cache = None
_cache_time = 0.0
_lock = asyncio.Lock()

class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []; self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.hidden += 1
        if tag in ('p', 'li', 'br', 'div', 'h1', 'h2', 'h3'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.hidden = max(0, self.hidden - 1)
        if tag in ('p', 'li', 'div'): self.parts.append('\n')
    def handle_data(self, data):
        if not self.hidden: self.parts.append(data)

def plain_text(value):
    parser = PlainText(); parser.feed(html.unescape(value))
    return '\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())

def qualify(job, board, company=None):
    title = str(job.get('title', ''))
    content = plain_text(str(job.get('content', '')))
    # Conservative title-based seniority, with explicit agent duties in the text.
    if re.search(r'\b(senior|staff|principal|lead|manager|director|head)\b', title, re.I): return None
    if not re.search(r'\b(intern(ship)?|apprentice(ship)?|junior|entry.level|new.grad(uate)?|alternance|stagiaire|stage)\b', title, re.I): return None
    if not re.search(r'\b(engineer|engineering|ingénieur|développeur|developer)\b', title, re.I): return None
    if not re.search(r'\b(agentic|agents?|multi.agent)\b', title + '\n' + content, re.I): return None
    url = str(job.get('absolute_url', ''))
    if urlparse(url).scheme != 'https' or not urlparse(url).hostname: return None
    description = f'{title}\n{company or BOARDS[board]}\n{job.get("location", {}).get("name", "")}\nSource: {url}\n\n{content}'
    if len(description) < 50 or len(description) > 20000: return None
    return {'id': f'{board}:{job.get("id")}', 'title': title, 'company': company or BOARDS[board],
            'location': str(job.get('location', {}).get('name', '')), 'url': url,
            'description': description, 'updated_at': job.get('updated_at'),
            'qualification': 'Title indicates junior/internship; agent keywords found. Duties and eligibility still require review.'}

async def load_jobs():
    global _cache, _cache_time
    async with _lock:
        if _cache is not None and monotonic() - _cache_time < 300: return _cache
        async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
            async def read(board):
                try:
                    response = await client.get(f'https://boards-api.greenhouse.io/v1/boards/{board}/jobs', params={'content': 'true'})
                    response.raise_for_status()
                    payload = response.json()
                    jobs = [result for job in payload['jobs'] if (result := qualify(job, board))]
                    return jobs, None
                except (httpx.HTTPError, ValueError, KeyError, TypeError):
                    return [], BOARDS[board]
            async def read_ashby(board):
                try:
                    response = await client.get(f'https://api.ashbyhq.com/posting-api/job-board/{board}')
                    response.raise_for_status()
                    rows = []
                    for job in response.json()['jobs']:
                        if job.get('isListed') is not True: continue
                        normalized = {'id': job.get('jobUrl', '').rsplit('/', 1)[-1], 'title': job.get('title', ''),
                                      'content': job.get('descriptionHtml') or job.get('descriptionPlain', ''),
                                      'absolute_url': job.get('jobUrl', ''), 'location': {'name': job.get('location', '')},
                                      'updated_at': job.get('publishedAt')}
                        result = qualify(normalized, 'ashby-' + board, ASHBY_BOARDS[board])
                        if result: rows.append(result)
                    return rows, None
                except (httpx.HTTPError, ValueError, KeyError, TypeError):
                    return [], ASHBY_BOARDS[board]
            batches = await asyncio.gather(*(read(board) for board in BOARDS), *(read_ashby(board) for board in ASHBY_BOARDS))
        result = {'jobs': list({job['url']: job for jobs, _ in batches for job in jobs}.values())[:60],
                  'sources': [*BOARDS.values(), *ASHBY_BOARDS.values()], 'unavailable_sources': [error for _, error in batches if error],
                  'checked_at': datetime.now(timezone.utc).isoformat()}
        # Failed sources are retried on the next request; don't disguise failures as no matches.
        if not result['unavailable_sources']: _cache, _cache_time = result, monotonic()
        return result
