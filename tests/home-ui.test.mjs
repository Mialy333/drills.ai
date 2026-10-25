import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/scripts/home.ts'],bundle:true,write:false,format:'iife'});
const fixture=JSON.parse(readFileSync('tests/fixtures/application.json','utf8'));
test('home has a single start action and resumes saved profile, diagnosis or documents',t=>{
 for(const stage of ['new','profile','diagnostic','documents']){
 const dom=new JSDOM(readFileSync('dist/fr/index.html','utf8'),{url:'https://example.com/drills.ai/fr/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 if(stage!=='new')w.sessionStorage.setItem('drills.application.v1',JSON.stringify({version:1,expiresAt:Date.now()+60000,profile:'I built a Python API and documented automated tests and agent workflows.',posting:'A job posting',result:stage==='profile'?null:fixture,cv:'CV',pitch:'Pitch',reviewed:stage==='documents',remember:false}));
 w.eval(bundle.outputFiles[0].text);
 assert.equal(w.document.querySelector('.journey-grid'),null);
 const link=w.document.getElementById('home-start');
 assert.match(link.href,new RegExp('step='+({new:'profile',profile:'posting',diagnostic:'diagnostic',documents:'documents'}[stage])));
 assert.match(link.textContent,stage==='new'?/Commencer ici/:/Reprendre/);
 }
});
