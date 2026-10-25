import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const html=readFileSync('dist/en/prepare/index.html','utf8');
const fixture=JSON.parse(readFileSync('tests/fixtures/application.json','utf8'));
const bundle=await build({entryPoints:['src/scripts/prepare.ts'],bundle:true,write:false,format:'iife',define:{'import.meta.env':'{"DEV":true}'}});
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
function setup(t, configure=()=>{}){
 const dom=new JSDOM(html,{url:'https://example.com/drills.ai/en/prepare/',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window;const get=id=>w.document.getElementById('practice-'+id);
 w.sessionStorage.setItem('drills.application.v1',JSON.stringify({version:1,expiresAt:Date.now()+86400000,profile:'I built a Python API with validation and wrote tests for error handling.',posting:'Agent Engineer internship building API tools and automated evaluations.',result:fixture,cv:'Original CV',pitch:'My prepared pitch with a concrete contribution and an interest in agent engineering.',reviewed:true,remember:false}));
 configure(w);w.eval(bundle.outputFiles[0].text);return {w,get};
}
test('text fallback reuses pitch and requires consent before feedback',async t=>{
 const {w,get}=setup(t);assert.equal(get('record').disabled,true);
 get('use-draft').click();assert.match(get('text').value,/My prepared pitch/);
 let calls=0;const criterion={observation:'Your contribution is concrete.',next_action:'Explain one test you wrote.'};
 w.fetch=async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).transcript,get('text').value);return {ok:true,json:async()=>({clarity:criterion,evidence:criterion,relevance:criterion,follow_up_question:'How did you handle an API failure?'})};};
 get('review').click();await tick();assert.equal(calls,0);
 get('consent').checked=true;get('review').click();await tick();assert.equal(calls,1);assert.equal(get('feedback').querySelectorAll('h3').length,3);
 const saved=JSON.parse(w.sessionStorage.getItem('drills.application.v1'));assert.equal(saved.cv,'Original CV');assert.equal(saved.reviewed,true);assert.equal(saved.practice_text,get('text').value);
 get('clear').click();assert.equal(get('text').value,'');assert.equal(JSON.parse(w.sessionStorage.getItem('drills.application.v1')).cv,'Original CV');
});
test('API failure preserves the rehearsal text and candidate dossier',async t=>{
 const {w,get}=setup(t);get('use-draft').click();const text=get('text').value;get('consent').checked=true;
 w.fetch=async()=>({ok:false,status:502});get('review').click();await tick();
 assert.equal(get('text').value,text);assert.match(get('status').textContent,/preserved/);assert.equal(get('review').disabled,false);
});
test('clear during request ignores late feedback',async t=>{
 const {w,get}=setup(t);get('use-draft').click();get('consent').checked=true;
 let resolve;w.fetch=()=>new Promise(r=>resolve=r);get('review').click();get('clear').click();
 const criterion={observation:'Concrete evidence.',next_action:'Explain a test.'};resolve({ok:true,json:async()=>({clarity:criterion,evidence:criterion,relevance:criterion,follow_up_question:'What did you test exactly?'})});await tick();
 assert.equal(get('feedback').children.length,0);assert.equal(get('text').value,'');
});
test('microphone permission failure leaves text fallback usable',async t=>{
 const {w,get}=setup(t,w=>{
  Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:async()=>{throw new Error('denied');}}});
  w.MediaRecorder=class {static isTypeSupported(){return true;}};
 });
 get('record').click();await tick();assert.match(get('status').textContent,/denied/);assert.equal(get('record').disabled,false);
 get('use-draft').click();assert.match(get('text').value,/My prepared pitch/);
});
test('recording stays local until explicit consent and transcription, and releases microphone',async t=>{
 let stopped=0;const {w,get}=setup(t,w=>{
  Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopped++}]})}});
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
  w.MediaRecorder=class {
   static isTypeSupported(){return true;}
   state='inactive';start(...args){assert.equal(args.length,0);this.state='recording';}
   stop(){this.state='inactive';this.ondataavailable({data:new w.Blob(['test recording'],{type:'audio/mp4'})});this.onstop();}
  };
 });
 let calls=0;w.fetch=async(url,options)=>{calls++;assert.match(url,/interview\/transcribe$/);assert.equal(JSON.parse(options.body).media_type,'audio/mp4');return {ok:true,json:async()=>({text:'I built an agent with a tool API and wrote tests for failures.'})};};
 get('record').click();await tick();assert.equal(get('stop').hidden,false);get('stop').click();
 assert.ok(stopped>0);assert.equal(get('audio').hidden,false);assert.equal(calls,0);
 get('transcribe').click();await tick();assert.equal(calls,0);
 get('consent').checked=true;get('transcribe').click();for(let i=0;i<10&&!get('text').value;i++)await tick();
 assert.equal(calls,1);assert.match(get('text').value,/I built an agent/);
 get('clear').click();assert.equal(get('audio').hidden,true);
});
test('identical feedback requests reuse the last result without another API call',async t=>{
 const {w,get}=setup(t);get('use-draft').click();get('consent').checked=true;let calls=0;
 const criterion={observation:'Your example is concrete.',next_action:'Describe one failing test.'};
 w.fetch=async()=>{calls++;return {ok:true,json:async()=>({clarity:criterion,evidence:criterion,relevance:criterion,follow_up_question:'What happened when the API failed?'})};};
 get('review').click();await tick();get('review').click();await tick();assert.equal(calls,1);
 get('text').value+=' I also tested retries.';get('text').dispatchEvent(new w.Event('input'));get('review').click();await tick();assert.equal(calls,2);
});


test('pitch and technical cases occupy separate views with one case at a time',t=>{
 const {w,get}=setup(t);assert.equal(get('pitch-panel').hidden,false);assert.equal(get('technical-panel').hidden,true);
 get('tab-technical').click();assert.equal(get('pitch-panel').hidden,true);assert.equal(get('technical-panel').hidden,false);
 const cards=[...w.document.querySelectorAll('[data-interview-case]')];assert.equal(cards.filter(card=>!card.hidden).length,1);
 get('case').value=cards[1].dataset.interviewCase;get('case').dispatchEvent(new w.Event('change'));
 assert.equal(cards[0].hidden,true);assert.equal(cards[1].hidden,false);
 get('tab-pitch').click();assert.equal(get('pitch-panel').hidden,false);assert.equal(get('technical-panel').hidden,true);
});
