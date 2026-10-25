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
