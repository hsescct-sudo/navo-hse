const assert=require('node:assert/strict'),c=require('../public/release-core.js');
assert.equal(c.programs.length,14);assert.equal(new Set(c.programs.map(p=>p.id)).size,14);
assert(c.programs.some(p=>p.label==='Together to Zero Harm program BSL'));
assert.equal(c.facilities.length,9);assert(c.facilities.every(f=>f.q.length===12&&f.q.some(q=>q.c)));
assert.equal(c.matrix(3,5).score,15);assert.equal(c.matrix(5,5).level,'Critical');assert.equal(c.matrix(6,2),null);assert.equal(c.matrix('',2),null);
assert.equal(c.fmea(8,4,3),96);assert.equal(c.fmea(10,10,10),1000);assert.equal(c.fmea(2,11,1),null);
const now=Date.parse('2026-10-13T12:00:00Z'),rows=[{ts:now-864e5},{ts:now-40*864e5},{ts:now-80*864e5},{ts:now+864e5}];
assert.deepEqual(c.reportBaseline(rows,now),{current:1,previous:1,change:0,expected30:1,sample:3,confidence:'low'});
console.log('PASS: 14 programmes, 9 tailored protocols with 108 questions, matrix/FMEA bounds, evidence-only trend baseline');
