import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const html = readFileSync(new URL('../dist/en/apply/index.html', import.meta.url),'utf8');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/application.json',import.meta.url),'utf8'));
const bundle = await build({entryPoints:['src/scripts/application.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{"DEV":true}'}});
const profileText = 'I built an API with validation and automated tests and documented customer support workflows.';
function setup(t, query='') {
 const dom=new JSDOM(html,{url:'http://localhost:4321/drills.ai/en/apply/'+query,runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const w=dom.window, get=id=>w.document.getElementById('application-'+id);
 const calls=[];
 w.fetch=async(url, options)=> {calls.push({url,body:JSON.parse(options.body)}); return {ok:true,status:200,json:async()=>url.endsWith('profile-import')?{candidate_text:profileText}:fixture};};
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
 assert.deepEqual(calls.map(c=>c.url.split('/').at(-1)),['profile-import','application']);
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
 assert.equal(get('posting').required,false);assert.match(get('submit').textContent,/Save my profile/);
 const second=setup(t,'?step=posting');assert.equal(second.get('posting-card').hidden,false);
 assert.match(second.get('heading-title').textContent,/Which posting/);
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
