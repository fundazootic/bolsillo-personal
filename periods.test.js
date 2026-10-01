import {test} from 'node:test';import assert from 'node:assert/strict';
import {periodBounds,periodFor,inPeriod,dueInPeriod,flowStats} from './periods.js';
test('25th cycles belong to closing month without overlapping dates',()=>{
 assert.deepEqual(periodBounds('2026-10',25),{start:'2026-09-25',end:'2026-10-24'});
 assert.equal(periodFor('2026-09-25',25),'2026-10');assert.equal(periodFor('2026-10-24',25),'2026-10');assert.equal(periodFor('2026-10-25',25),'2026-11');
 assert.equal(inPeriod('2026-10-25','2026-10',25),false);
 assert.equal(dueInPeriod('2026-10',28,25),'2026-09-28');assert.equal(dueInPeriod('2026-10',5,25),'2026-10-05');
});
test('calendar, short months, leap years and year rollover',()=>{
 assert.deepEqual(periodBounds('2028-02',1),{start:'2028-02-01',end:'2028-02-29'});
 assert.deepEqual(periodBounds('2028-03',31),{start:'2028-02-29',end:'2028-03-30'});
 assert.equal(periodFor('2026-12-25',25),'2027-01');assert.equal(periodFor('2028-02-29',31),'2028-03');
});
test('cash-flow advice distinguishes free cash from pending commitments and missing income',()=>{
 const rows=[{kind:'income',amount:1000000},{kind:'expense',paid:true,amount:200000},{kind:'expense',paid:false,amount:300000},{kind:'allocation',amount:100000}];
 const s=flowStats(rows,[],'2026-10',25,'2026-10-01');assert.equal(s.afterPending,400000);assert.equal(s.net,800000);assert.equal(s.days,24);assert.equal(s.daily,16666);assert.equal(s.change,null);
 assert.equal(flowStats([],[],'2026-10',25,'2026-10-25').daily,null);assert.equal(flowStats([],[],'2026-10').paidRatio,null);
});
