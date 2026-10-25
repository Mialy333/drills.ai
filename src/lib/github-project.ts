/** Public metadata only: no credentials, README execution or arbitrary URL fetching. */
export async function fetchGithubProject(input: string, signal?: AbortSignal, language: 'fr'|'en' = 'en'): Promise<string> {
  let url: URL;
  try { url=new URL(input.trim()); } catch { throw new Error('github-url'); }
  const match=url.pathname.match(/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/);
  if(url.protocol!=='https:' || url.hostname!=='github.com' || url.port || url.username || url.password || url.search || url.hash || !match) throw new Error('github-url');
  const owner=match[1], repo=match[2].replace(/\.git$/,'');
  if(!repo || repo==='.' || repo==='..') throw new Error('github-url');
  const response=await fetch(`https://api.github.com/repos/${owner}/${repo}`, {headers:{Accept:'application/vnd.github+json'},credentials:'omit',signal});
  if(response.status===403 || response.status===429) throw new Error('github-limit');
  if(response.status===404) throw new Error('github-missing');
  if(!response.ok) throw new Error('github-failed');
  const data=await response.json();
  if(data.private!==false || typeof data.full_name!=='string' || data.full_name.toLowerCase()!==`${owner}/${repo}`.toLowerCase()) throw new Error('github-failed');
  return [`GitHub: https://github.com/${data.full_name}`,
    typeof data.description==='string' ? data.description.slice(0,1000) : '',
    typeof data.language==='string' ? `${language==='fr'?'Langage du dépôt':'Repository language'} : ${data.language.slice(0,100)}` : '',
    data.fork ? (language==='fr'?'Fork — contribution personnelle à préciser.':'Fork — personal contribution to specify.') : '',
    language==='fr'?'Source : métadonnées GitHub, sans vérification de la contribution personnelle ni du niveau.':'Source: GitHub repository metadata. Not a verification of personal authorship or skill.'
  ].filter(Boolean).join('\n');
}
