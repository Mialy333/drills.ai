import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const html = readFileSync(new URL('../dist/en/apply/index.html', import.meta.url),'utf8');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/application.json',import.meta.url),'utf8'));
const bundle = await build({entryPoints:['src/scripts/application.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{"DEV":true}'}});
const profileText = 'I built an API with validation and automated tests and documented customer support workflows.';
function setup(t, query='?step=posting') {
 const dom=new JSDOM(html,{url:'http://localhost:4321/drills.ai/en/apply/'+query,runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const w=dom.window, get=id=>w.document.getElementById('application-'+id);
 const calls=[];
 w.fetch=async(url, options)=> {if(url.endsWith('/health'))return {ok:true,status:200,json:async()=>({status:'ok'})};calls.push({url,body:JSON.parse(options.body)}); return {ok:true,status:200,json:async()=>url.endsWith('profile-import')?{candidate_text:profileText}:fixture};};
 w.eval(bundle.outputFiles[0].text);
 return {w,get,calls};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function done(get) { for(let i=0;i<200 && get('inputs').disabled;i++) await tick(); assert.equal(get('inputs').disabled,false); }
function upload(w,get) {
 Object.defineProperty(get('pdf'),'files',{configurable:true,value:[new w.File(['%PDF-1.4 example'],'cv.pdf',{type:'application/pdf'})]});
 get('pdf').dispatchEvent(new w.Event('change'));
}
function submit(w,get) { get('form').dispatchEvent(new w.Event('submit',{cancelable:true})); }
test('one click imports a CV then analyses the posting without manual profile entry',async t=>{
 const {w,get,calls}=setup(t); upload(w,get);get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';
 get('consent').checked=true;get('consent').dispatchEvent(new w.Event('change'));
 assert.equal(calls.length,0); // selecting a file and consent alone do not launch paid calls
 submit(w,get);submit(w,get);await done(get);
 assert.deepEqual(calls.map(c=>c.url.split('/').at(-1)),['profile-import','assessment']);
 assert.equal(calls[1].body.candidate_text,profileText);
 assert.equal(get('results').hidden,false);
 assert.match(get('status').textContent,/Assessment ready/);
 assert.equal(get('form').getAttribute('aria-busy'),'false');
 assert.equal(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).profile,profileText);
});
test('consent is required and a failed PDF import never triggers a diagnosis',async t=>{
 const {w,get,calls}=setup(t);upload(w,get);get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';
 submit(w,get);assert.equal(calls.length,0);
 get('consent').checked=true;
 w.fetch=async()=>({ok:false,status:422});submit(w,get);await done(get);
 assert.equal(get('results').hidden,true);assert.match(get('status').textContent,/invalid/);
 assert.equal(get('posting').value.startsWith('AI Agent'),true);
});
test('an imported profile survives an analysis service failure and no diagnostic is fabricated',async t=>{
 const {w,get}=setup(t);upload(w,get);get('consent').checked=true;
 get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';
 w.fetch=async url=>url.endsWith('profile-import')?{ok:true,status:200,json:async()=>({candidate_text:profileText})}:{ok:false,status:503};
 submit(w,get);await done(get);
 assert.equal(get('profile').value,profileText);assert.equal(get('results').hidden,true);
 assert.match(get('status').textContent,/unavailable/);
 assert.equal(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).profile,profileText);
});
test('profile entry and posting entry have distinct visible steps',t=>{
 const {get}=setup(t,'?step=profile');assert.equal(get('posting-card').hidden,true);
 assert.equal(get('posting').required,false);assert.match(get('submit').textContent,/Next: opportunities/);
 const second=setup(t,'?step=posting');assert.equal(second.get('posting-card').hidden,false);
 assert.match(second.get('heading-title').textContent,/Find your next opportunity/);
});
test('a saved profile is reused for another posting without uploading a CV',async t=>{
 const {w,get,calls}=setup(t); get('profile').value=profileText;get('profile').dispatchEvent(new w.Event('input'));
 get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 submit(w,get);await done(get);
 assert.equal(calls.length,1);assert.equal(calls[0].body.candidate_text,profileText);assert.equal(get('results').hidden,false);
});

test('inline startup retires stale DRILLS assets without deleting profiles or unrelated caches', async t => {
 const dom = new JSDOM(html,{url:'http://localhost:4321/drills.ai/en/apply/',runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const w=dom.window, deleted=[], unregistered=[];
 const base='http://localhost:4321/drills.ai/';
 Object.defineProperty(w.navigator,'serviceWorker',{value:{
  controller:{scriptURL:base+'sw.js'},
  getRegistrations:async()=>[
   {scope:base,active:{scriptURL:base+'sw.js'},unregister:async()=>unregistered.push('drills')},
   {scope:'http://localhost:4321/other/',active:{scriptURL:'http://localhost:4321/other/sw.js'},unregister:async()=>unregistered.push('other')},
  ],
 }});
 w.caches={keys:async()=>['drills-old-assets','other-app-assets'],delete:async key=>deleted.push(key)};
 w.localStorage.setItem('drills.application.v1','saved-profile');
 w.sessionStorage.setItem('drills.application.v1','tab-profile');
 let reloads=0;w.__reload=()=>reloads++;
 const script=[...w.document.querySelectorAll('script')].find(node=>node.textContent.includes('drills.worker-repair.v1'));
 assert.ok(script,'repair must be inline, outside any potentially stale module');
 const code=script.textContent.replace('location.reload()','window.__reload()');
 w.eval(code);await tick();await tick();
 assert.deepEqual(unregistered,['drills']);assert.deepEqual(deleted,['drills-old-assets']);
 assert.equal(reloads,1);assert.equal(w.localStorage.getItem('drills.application.v1'),'saved-profile');
 assert.equal(w.sessionStorage.getItem('drills.application.v1'),'tab-profile');
 w.eval(code);await tick();await tick();assert.equal(reloads,1,'no reload loop');
});

test('evidence validation failure explains the problem and preserves the imported profile', async t => {
 const {w,get}=setup(t);
 get('profile').value=profileText;
 get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';
 get('consent').checked=true;
 w.fetch=async()=>({ok:false,status:502,json:async()=>({detail:{code:'evidence_validation'}})});
 submit(w,get);await done(get);
 assert.match(get('status').textContent,/citations could not be validated/);
 assert.equal(get('profile').value,profileText);
 assert.equal(get('results').hidden,true);
});

test('CV toolbar formats selected text and preserves formatting and links in print',async t=>{
 const {w,get}=setup(t);get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 submit(w,get);await done(get);
 w.document.querySelector('[data-application-step=documents]').click();
 const editor=w.document.getElementById('cv-rich-editor');
 const editable=editor.querySelector('.tiptap');editable.focus();
 const range=w.document.createRange();range.selectNodeContents(editable);
 w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.document.dispatchEvent(new w.Event('selectionchange'));await tick();await tick();
 w.document.querySelector('[data-command="bold"]').click();assert.ok(editor.querySelector('strong'));
 w.document.getElementById('cv-link-url').value='https://example.com/portfolio';
 w.document.querySelector('[data-command="link"]').click();assert.equal(editor.querySelector('a').getAttribute('href'),'https://example.com/portfolio');
 w.document.querySelector('[data-command="center"]').click();assert.equal(editor.querySelector('p').style.textAlign,'center');
 assert.match(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).cv_html,/<strong>/);
 get('reviewed').checked=true;get('reviewed').dispatchEvent(new w.Event('change'));
 w.print=()=>{};get('print-button').click();assert.ok(get('print-text').querySelector('strong'));assert.ok(get('print-text').querySelector('a'));
});

test('restored CV formatting strips executable HTML and unsafe links',t=>{
 const dom=new JSDOM(html,{url:'http://localhost:4321/drills.ai/en/apply/',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window;
 w.sessionStorage.setItem('drills.application.v1',JSON.stringify({version:1,expiresAt:Date.now()+60000,profile:profileText,posting:'test posting',result:fixture,cv:'Plain',cv_html:'<div style="text-align:right"><strong>Safe</strong><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Link</a></div>',pitch:'Text',reviewed:false,remember:false}));
 w.eval(bundle.outputFiles[0].text);
 const editor=w.document.getElementById('cv-rich-editor');
 assert.ok(editor.querySelector('strong'));assert.equal(editor.querySelector('script,img'),null);assert.equal(editor.querySelector('a[href]'),null);assert.equal(editor.querySelector('p').style.textAlign,'right');
});

test('formatting toggles off on second click and links can be edited and removed',async t=>{
 const {w,get}=setup(t);get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 submit(w,get);await done(get);
 w.document.querySelector('[data-application-step=documents]').click();
 const editable=w.document.querySelector('#cv-rich-editor .tiptap');editable.focus();
 const range=w.document.createRange();range.selectNodeContents(editable);
 w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.document.dispatchEvent(new w.Event('selectionchange'));await tick();await tick();
 for(const [command,tag] of [['bold','strong'],['italic','em'],['underline','u'],['strike','s']]){
  const button=w.document.querySelector(`[data-command="${command}"]`);
  button.click();assert.ok(editable.querySelector(tag));assert.equal(button.getAttribute('aria-pressed'),'true');
  button.click();assert.equal(editable.querySelector(tag),null);assert.equal(button.getAttribute('aria-pressed'),'false');
 }
 const input=w.document.getElementById('cv-link-url'),apply=w.document.querySelector('[data-command="link"]');
 input.value='https://example.com/one';apply.click();
 input.value='https://example.com/two';apply.click();assert.equal(editable.querySelector('a').getAttribute('href'),'https://example.com/two');
 assert.equal(editable.querySelector('a a'),null);
 w.document.querySelector('[data-command="unlink"]').click();assert.equal(editable.querySelector('a'),null);
 const size=w.document.getElementById('cv-size');size.value='16pt';size.dispatchEvent(new w.Event('change',{bubbles:true}));assert.match(editable.innerHTML,/16pt/);
 w.document.querySelector('[data-command="clear"]').click();assert.equal(editable.querySelector('[style*="font-size"]'),null);
});

test('switching EN to FR and back preserves reviewed result, edited CV, formatting and pitch without an API call',async t=>{
 const {w,get}=setup(t);get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;submit(w,get);await done(get);
 const saved=JSON.parse(w.sessionStorage.getItem('drills.application.v1'));
 saved.cv='My edited CV';saved.cv_html='<p><strong>My edited CV</strong></p>';saved.pitch='My edited pitch';saved.reviewed=true;
 const frHtml=readFileSync(new URL('../dist/fr/apply/index.html',import.meta.url),'utf8');
 let state=JSON.stringify(saved);
 for(const [language,page] of [['fr',frHtml],['en',html]]){
  const next=new JSDOM(page,{url:`http://localhost:4321/drills.ai/${language}/apply/`,runScripts:'outside-only'});t.after(()=>next.window.close());
  const nw=next.window;nw.sessionStorage.setItem('drills.application.v1',state);let calls=0;nw.fetch=()=>{calls++;throw Error('unexpected request');};nw.eval(bundle.outputFiles[0].text);
  const field=id=>nw.document.getElementById('application-'+id);
  assert.equal(field('results').hidden,false);assert.equal(field('profile').value,profileText);assert.equal(field('cv').value,'My edited CV');assert.equal(field('pitch').value,'My edited pitch');assert.equal(field('reviewed').checked,true);assert.ok(nw.document.querySelector('#cv-rich-editor strong'));assert.equal(calls,0);
  field('pitch').dispatchEvent(new nw.Event('input'));state=nw.sessionStorage.getItem('drills.application.v1');
  const parsed=JSON.parse(state);parsed.reviewed=true;state=JSON.stringify(parsed);
 }
});
test('CV uses section headings, keeps contact across reloads and removes success chatter',async t=>{
 const {w,get}=setup(t);get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 submit(w,get);await done(get);
 assert.equal(w.document.querySelectorAll('#cv-rich-editor h3').length,fixture.cv_sections.length);
 get('contact').value='Jane Doe\njane@example.com';get('contact').dispatchEvent(new w.Event('input'));
 assert.equal(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).contact,get('contact').value);
 assert.match(w.document.getElementById('cv-contact-preview').textContent,/Jane Doe/);
 w.document.querySelector('[data-command="bold"]').click();
 assert.equal(w.document.getElementById('cv-editor-note').textContent,'');
});
test('GitHub public project is previewed and only added after a personal contribution',async t=>{
 const {w,get}=setup(t);get('profile').value=profileText;
 const el=id=>w.document.getElementById(id);const requests=[];
 w.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>({private:false,full_name:'octocat/demo',description:'A public agent project',language:'Python',fork:true})};};
 el('github-url').value='https://github.com/octocat/demo';el('github-load').click();await tick();
 assert.equal(requests[0].url,'https://api.github.com/repos/octocat/demo');assert.equal(requests[0].options.credentials,'omit');
 assert.equal(get('profile').value,profileText);assert.equal(el('github-review').hidden,false);
 el('github-add').click();assert.equal(get('profile').value,profileText);
 el('github-contribution').value='I added API validation and failure handling tests.';el('github-add').click();
 assert.match(get('profile').value,/https:\/\/github.com\/octocat\/demo/);assert.match(get('profile').value,/Fork/);
 assert.match(get('profile').value,/I added API validation/);
 assert.equal(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).profile,get('profile').value);
});
test('GitHub rejects arbitrary hosts and handles missing repositories without losing profile',async t=>{
 const {w,get}=setup(t);get('profile').value=profileText;const el=id=>w.document.getElementById(id);let calls=0;
 w.fetch=async()=>{calls++;return {ok:false,status:404};};
 el('github-url').value='https://evil.example/octocat/demo';el('github-load').click();await tick();assert.equal(calls,0);
 el('github-url').value='https://github.com/octocat/demo';el('github-load').click();await tick();assert.equal(calls,1);
 assert.match(el('github-status').textContent,/not found/);assert.equal(get('profile').value,profileText);assert.equal(el('github-review').hidden,true);
});
test('legacy CV in a single paragraph becomes real headings, emphasis and bullet lists',t=>{
 const {w,get}=setup(t);
 const result=structuredClone(fixture);result.cv_sections=[{heading:'Target Title',text:'***AI Agent Engineer Internship***',source_quotes:['I built a Python API with FastAPI']},{heading:'Projects',text:'Support agent - Validated six cases - Wrote tests',source_quotes:['I built a Python API with FastAPI']}];
 const flat='Target Title ***AI Agent Engineer Internship*** Projects Support agent - Validated six cases - Wrote tests';
 const state={version:1,expiresAt:Date.now()+86400000,profile:profileText,posting:'Full internship posting that calls for APIs and testing.',result,cv:flat,cv_html:'<p>'+flat+'</p>',pitch:result.pitch.text,reviewed:false,remember:false};
 const dom=new JSDOM(html,{url:'http://localhost:4321/drills.ai/en/apply/',runScripts:'outside-only'});t.after(()=>dom.window.close());
 dom.window.sessionStorage.setItem('drills.application.v1',JSON.stringify(state));dom.window.eval(bundle.outputFiles[0].text);
 const root=dom.window.document.querySelector('#cv-rich-editor');
 assert.equal(root.querySelectorAll('h3').length,2);assert.equal(root.querySelectorAll('li').length,2);
 assert.equal(root.querySelector('strong').textContent,'AI Agent Engineer Internship');
 assert.match(root.textContent,/Support agent/);
});
test('job selection fills the posting without sending the candidate profile to Greenhouse',async t=>{
 const {w,get}=setup(t);get('profile').value=profileText;const requests=[];
 const description='AI Agent Engineer Internship. Build agents and APIs with automated evaluation and tests.';
 w.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({jobs:[{title:'Agent Engineer Intern',company:'Example',location:'Paris',url:'https://example.com/jobs/1',description}],unavailable_sources:[],checked_at:new Date().toISOString()})};};
 w.document.getElementById('jobs-load').click();await tick();
 assert.equal(requests[0].url,'http://127.0.0.1:8000/api/jobs');assert.equal(requests[0].options.body,undefined);
 w.document.querySelector('#jobs-results button').click();assert.equal(get('posting').value,description);assert.equal(get('profile').value,profileText);
 assert.equal(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).posting,description);
});
test('French page localizes CV section labels and GitHub notices without translating source facts',async t=>{
 const frenchHtml=readFileSync('dist/fr/apply/index.html','utf8');
 const dom=new JSDOM(frenchHtml,{url:'https://example.com/drills.ai/fr/apply/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 const result=structuredClone(fixture);result.cv_sections[0].heading='Projects';
 const saved={version:1,expiresAt:Date.now()+86400000,profile:profileText,posting:'AI Agent Engineer internship with tools and API evaluation.',result,cv:'Projects\nBuilt an API.',cv_html:'<h3>Projects</h3><p>Built an API.</p>',pitch:result.pitch.text,reviewed:false,remember:false};
 w.sessionStorage.setItem('drills.application.v1',JSON.stringify(saved));w.eval(bundle.outputFiles[0].text);
 assert.equal(w.document.querySelector('#cv-rich-editor h3').textContent,'Projets');
 assert.match(w.document.getElementById('application-pick-pdf').textContent,/Choisir mon CV PDF/);
 w.fetch=async()=>({ok:true,status:200,json:async()=>({private:false,full_name:'octocat/demo',description:'Original repository description',language:'Python',fork:false})});
 w.document.getElementById('github-url').value='https://github.com/octocat/demo';w.document.getElementById('github-load').click();await tick();
 const preview=w.document.getElementById('github-preview').value;assert.match(preview,/Langage du dépôt/);assert.doesNotMatch(preview,/Repository language|Not a verification/);assert.match(preview,/Original repository description/);
});
test('all public MVP routes declare their language and use localized navigation',t=>{
 for(const lang of ['fr','en'])for(const page of ['','apply/','progress/']){
  const dom=new JSDOM(readFileSync(`dist/${lang}/${page}index.html`,'utf8'));t.after(()=>dom.window.close());
  assert.equal(dom.window.document.documentElement.lang,lang);
  const nav=dom.window.document.querySelector('.bar-nav').textContent;
  assert.match(nav,lang==='fr'?/Ma candidature/:/My application/);
  assert.doesNotMatch(nav,lang==='fr'?/My application/:/Ma candidature/);
 }
});


test('profile next moves to opportunities without AI and diagnosis/documents are separate',async t=>{
 const {w,get,calls}=setup(t,'');
 assert.equal(get('profile-card').hidden,false);assert.equal(get('posting-card').hidden,true);
 get('profile').value=profileText;submit(w,get);await done(get);
 assert.equal(calls.length,0);assert.equal(get('profile-card').hidden,true);assert.equal(get('posting-card').hidden,false);
 w.document.getElementById('jobs-show-posting').click();
 get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 const result=structuredClone(fixture);result.requirements.push({...result.requirements[0],name:'Graduation in 2027',kind:'eligibility',status:'not_documented',candidate_quote:null});result.decision='strengthen';
 w.fetch=async()=>({ok:true,json:async()=>result});submit(w,get);await done(get);
 assert.equal(get('form').hidden,true);assert.equal(get('diagnostic-panel').hidden,false);assert.equal(get('documents-panel').hidden,true);
 assert.match(get('score').textContent,/100 %/);assert.match(get('eligibility').textContent,/condition/);
 assert.match(get('evidence').firstChild.textContent,/Graduation/);
 w.document.querySelector('[data-application-step=documents]').click();
 assert.equal(get('diagnostic-panel').hidden,true);assert.equal(get('documents-panel').hidden,false);
 const saved=JSON.parse(w.sessionStorage.getItem('drills.application.v1'));assert.equal(saved.history.length,1);assert.equal(saved.history[0].sent_at,null);
});


test('opportunities paginate four at a time and selection opens the posting editor',async t=>{
 const {w}=setup(t);const el=id=>w.document.getElementById('jobs-'+id);
 const jobs=Array.from({length:9},(_,i)=>({title:'Agent Intern '+i,company:'Example',location:'Paris',url:'https://example.com/jobs/'+i,description:'Role '+i+' building AI agents with tools, APIs and automated evaluations.'}));
 w.fetch=async()=>({ok:true,json:async()=>({jobs,unavailable_sources:[]})});el('load').click();await tick();
 assert.equal(el('results').children.length,4);assert.equal(el('page').textContent,'1 / 3');el('next').click();
 assert.equal(el('results').children.length,4);assert.match(el('results').textContent,/Agent Intern 4/);el('next').click();assert.equal(el('results').children.length,1);
 el('results').querySelector('button').click();assert.equal(el('browser').hidden,true);assert.equal(el('posting-editor').hidden,false);
});


test('selected job preserves an application link in diagnosis and history without recording a send',async t=>{
 const {w,get}=setup(t);get('profile').value=profileText;
 const description='AI Agent Engineer internship building tools and evaluating API workflows.';
 w.fetch=async(url)=>url.endsWith('/api/jobs')?{ok:true,json:async()=>({jobs:[{title:'Agent intern',company:'Example',location:'Paris',description,url:'https://example.com/apply/123'}],unavailable_sources:[]})}:{ok:true,json:async()=>fixture};
 w.document.getElementById('jobs-load').click();await tick();w.document.querySelector('#jobs-results button').click();
 assert.equal(get('posting-url').value,'https://example.com/apply/123');get('consent').checked=true;submit(w,get);await done(get);
 assert.equal(get('apply-link').href,'https://example.com/apply/123');assert.equal(get('apply-link').hidden,false);
 get('apply-link').addEventListener('click',event=>event.preventDefault());get('apply-link').click();
 const saved=JSON.parse(w.sessionStorage.getItem('drills.application.v1'));assert.equal(saved.history[0].posting_url,'https://example.com/apply/123');assert.equal(saved.history[0].sent_at,null);
 get('posting').value='A different role';get('posting').dispatchEvent(new w.Event('input'));assert.equal(get('posting-url').value,'');assert.equal(get('apply-link').hidden,true);
});
test('work rights are explicit country-scoped declarations and changes invalidate diagnosis',async t=>{
 const {w,get,calls}=setup(t);get('profile').value=profileText;get('posting').value='AI Agent Engineer internship building tools and evaluating API workflows.';
 get('residence').value='Paris, France';get('work-country').value='France';get('work-authorization').value='yes';get('consent').checked=true;
 submit(w,get);await done(get);assert.match(calls[0].body.candidate_text,/Candidate-declared work country: France/);assert.match(calls[0].body.candidate_text,/without employer sponsorship/);
 const saved=JSON.parse(w.sessionStorage.getItem('drills.application.v1'));assert.equal(saved.work_authorization,'yes');assert.equal(saved.profile,profileText);
 get('work-authorization').value='unknown';get('work-authorization').dispatchEvent(new w.Event('input'));assert.equal(get('results').hidden,true);
 get('posting-url').value='javascript:alert(1)';get('posting-url').dispatchEvent(new w.Event('input'));assert.equal(get('apply-link').hasAttribute('href'),false);
});

test('opportunities start with only two choices and reveal controls only on request',t=>{
 const {w,get}=setup(t);const el=id=>w.document.getElementById('jobs-'+id);
 assert.equal(el('browser').hidden,true);assert.equal(el('posting-editor').hidden,true);assert.equal(el('pagination').hidden,true);assert.equal(el('explanation').hidden,true);assert.equal(get('consent-panel').hidden,true);
 el('show-list').click();assert.equal(el('browser').hidden,false);assert.equal(el('posting-editor').hidden,true);assert.equal(el('pagination').hidden,true);assert.equal(get('consent-panel').hidden,true);
 el('show-posting').click();assert.equal(el('browser').hidden,true);assert.equal(el('posting-editor').hidden,false);assert.equal(get('consent-panel').hidden,false);
 w.document.querySelector('[data-application-step=profile]').click();assert.equal(get('profile-card').hidden,false);
 w.document.querySelector('[data-application-step=posting]').click();assert.equal(get('consent-panel').hidden,false);
});

 test('fictional example never reuses a real application link, contact or eligibility',t=>{
 const {get}=setup(t,'?step=profile');
 get('posting-url').value='https://example.com/real-job';get('residence').value='Paris';get('work-country').value='France';get('work-authorization').value='yes';get('contact').value='Private contact';
 get('example').click();
 for(const id of ['posting-url','residence','work-country','contact'])assert.equal(get(id).value,'');
 assert.equal(get('work-authorization').value,'unknown');assert.equal(get('apply-link').hidden,true);assert.equal(get('consent').checked,false);
 });

function pendingAssessment(){return {...structuredClone(fixture),cv_sections:[],pitch:null,drafts_pending:true};}
test('assessment appears before drafts; documents generate on demand and keep score/history',async t=>{
 const {w,get,calls}=setup(t);
 w.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>url.endsWith('application-drafts')?fixture:pendingAssessment()};};
 get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 submit(w,get);await done(get);
 assert.equal(calls.length,1);assert.match(calls[0].url,/assessment$/);assert.equal(get('results').hidden,false);
 assert.equal(get('cv').value,'');assert.match(get('score').textContent,/100/);
 w.document.querySelector('[data-application-step="documents"]').click();await done(get);
 assert.equal(calls.length,2);assert.match(calls[1].url,/application-drafts$/);
 assert.equal(get('documents-panel').hidden,false);assert.ok(get('cv').value.length>0);
 assert.equal(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).history[0].analyses,1);
 // Revisiting documents must not regenerate or overwrite edits.
 get('pitch').value='My edited introduction';get('pitch').dispatchEvent(new w.Event('input'));
 w.document.querySelector('[data-application-step="diagnostic"]').click();
 w.document.querySelector('[data-application-step="documents"]').click();
 assert.equal(calls.length,2);assert.equal(get('pitch').value,'My edited introduction');
});
test('failed document generation preserves assessment and offers an explicit retry',async t=>{
 const {w,get}=setup(t);
 w.fetch=async url=>url.endsWith('application-drafts')?{ok:false,status:502,json:async()=>({})}:{ok:true,status:200,json:async()=>pendingAssessment()};
 get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 submit(w,get);await done(get);w.document.querySelector('[data-application-step="documents"]').click();await done(get);
 assert.equal(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).result.score,100);
 assert.equal(get('drafts-controls').hidden,false);assert.match(get('drafts-status').textContent,/failed/);
 assert.equal(get('generate-documents').disabled,false);assert.equal(get('drafts-content').hidden,true);
});
test('score remains visible alongside unresolved eligibility, including zero, without inventing null scores',async t=>{
 const {w,get}=setup(t);
 for(const score of [100,0,null]){
  const result=structuredClone(fixture);result.score=score;result.scope=score===null?'out_of_scope':'in_scope';
  result.requirements.push({...result.requirements[0],kind:'eligibility',name:'Availability',status:'not_documented',candidate_quote:null});
  w.fetch=async()=>({ok:true,status:200,json:async()=>result});
  get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design. '+score;get('posting').dispatchEvent(new w.Event('input'));get('consent').checked=true;
  submit(w,get);await done(get);
  assert.match(get('eligibility').textContent,/condition/);
  if(score===null)assert.match(get('score').textContent,/not calculated/);else assert.match(get('score').textContent,new RegExp('^'+score+' %'));
 }
});
test('unchanged assessment is reused without a second request',async t=>{
 const {w,get,calls}=setup(t);get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 submit(w,get);await done(get);submit(w,get);await done(get);assert.equal(calls.length,1);
});
test('previous backend remains usable during deployment rollout',async t=>{
 const {w,get,calls}=setup(t);
 w.fetch=async(url,options)=>{calls.push({url});return url.endsWith('/assessment')?{ok:false,status:404}:{ok:true,status:200,json:async()=>fixture};};
 get('profile').value=profileText;get('posting').value='AI Agent Engineer internship with API integration, tests and workflow design.';get('consent').checked=true;
 submit(w,get);await done(get);assert.deepEqual(calls.map(x=>x.url.split('/').at(-1)),['assessment','application']);assert.equal(get('results').hidden,false);
});
test('profile navigation does not require browser storage to succeed',t=>{
 const {w,get}=setup(t,'?step=profile');
 w.Storage.prototype.setItem=()=>{throw new Error('storage blocked')};
 get('profile').value=profileText;submit(w,get);
 assert.equal(get('posting-card').hidden,false);assert.match(w.location.search,/posting/);
});

test('pending assessment survives reload and requires consent before drafting again',async t=>{
 const dom=new JSDOM(html,{url:'http://localhost:4321/drills.ai/en/apply/?step=documents',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window,get=id=>w.document.getElementById('application-'+id),calls=[];
 w.sessionStorage.setItem('drills.application.v1',JSON.stringify({version:1,expiresAt:Date.now()+60000,profile:profileText,posting:'AI Agent Engineer internship with API integration and automated tests.',result:pendingAssessment(),cv:'',pitch:'',reviewed:false,remember:false}));
 w.fetch=async(url,options)=>{if(url.endsWith('/health'))return {ok:true,status:200};calls.push(url);return {ok:true,status:200,json:async()=>fixture};};
 w.eval(bundle.outputFiles[0].text);
 assert.equal(get('documents-panel').hidden,false);assert.equal(get('drafts-controls').hidden,false);
 get('generate-documents').click();assert.equal(calls.length,0);assert.match(get('drafts-status').textContent,/Confirm/);
 get('drafts-consent').checked=true;get('generate-documents').click();await done(get);
 assert.equal(calls.length,1);assert.equal(get('drafts-controls').hidden,true);assert.equal(get('drafts-content').hidden,false);
});
