import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/scripts/technical-interview.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{"DEV":true}'}});
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
const answer='I separate reads from writes, limit retries and check the reservation status before creating it again.';
function setup(t){
 const dom=new JSDOM(readFileSync('dist/en/prepare/index.html','utf8'),{url:'https://example.com',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.eval(bundle.outputFiles[0].text);
 const card=w.document.querySelector('[data-interview-case]');const get=selector=>card.querySelector(selector);
 const data={case_id:'tool-failure',rubric_version:3,criteria:['met','partial','incorrect','missing'].map((status,i)=>({criterion_index:i,status,answer_quote:status==='missing'?null:'I separate reads from writes',explanation:'Explain this design choice with more precision.',next_action:'Describe how you handle an uncertain reservation.'}))};
 return {w,get,data};
}
test('technical feedback requires consent, shows four grounded statuses and caches an unchanged answer',async t=>{
 const {w,get,data}=setup(t);let calls=0;w.fetch=async(url,options)=>{calls++;assert.match(url,/interview\/technical$/);assert.equal(JSON.parse(options.body).answer,answer);return {ok:true,json:async()=>data};};
 get('textarea').value=answer;get('[data-technical-review]').click();await tick();assert.equal(calls,0);
 get('[data-technical-consent]').checked=true;get('[data-technical-review]').click();await tick();
 assert.equal(calls,1);assert.equal(get('[data-technical-feedback]').querySelectorAll('details').length,4);assert.match(get('[data-technical-feedback]').textContent,/1 of 4/);assert.match(get('[data-technical-feedback]').textContent,/Needs correction/);
 get('[data-technical-review]').click();await tick();assert.equal(calls,1);
 get('textarea').dispatchEvent(new w.Event('input'));assert.equal(get('[data-technical-feedback]').textContent,'');
});
test('fabricated quotes produce no feedback and preserve the answer',async t=>{
 const {w,get,data}=setup(t);data.criteria[0].answer_quote='Invented quotation';w.fetch=async()=>({ok:true,json:async()=>data});
 get('textarea').value=answer;get('[data-technical-consent]').checked=true;get('[data-technical-review]').click();await tick();
 assert.equal(get('[data-technical-feedback]').textContent,'');assert.match(get('[data-technical-status]').textContent,/could not/);assert.equal(get('textarea').value,answer);
});
test('editing during a request discards the stale response',async t=>{
 const {w,get,data}=setup(t);let complete;w.fetch=()=>new Promise(resolve=>{complete=resolve;});
 get('textarea').value=answer;get('[data-technical-consent]').checked=true;get('[data-technical-review]').click();
 get('textarea').value=answer+' New reasoning.';get('textarea').dispatchEvent(new w.Event('input'));complete({ok:true,json:async()=>data});await tick();
 assert.equal(get('[data-technical-feedback]').textContent,'');assert.match(get('[data-technical-status]').textContent,/Answer changed/);
});
