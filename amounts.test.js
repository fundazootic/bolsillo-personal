import test from 'node:test';
import assert from 'node:assert/strict';
import {formatPesos,debtStats} from './amounts.js';
import {parseAmount,totals} from './core.js';
test('COP input groups thousands and accepts pasted mixed grouping',()=>{
 for(const text of ['1300000','1.300.000','1.300,000','1,300,000']){
  assert.equal(formatPesos(text),'1.300.000');assert.equal(parseAmount(text),1300000);
 }
 assert.equal(formatPesos(''),'');assert.equal(formatPesos('0001000'),'1.000');
 for(const text of ['-100','1,50','1.50','abc','1e3'])assert.throws(()=>parseAmount(text));
});
test('payments persist across months and reduce principal only once',()=>{
 const debt={id:'d',amount:1300000,monthly_payment:300000};
 const payments=[{debt_id:'d',amount:100000,kind:'expense',paid:true,month:'2026-09'},{debt_id:'d',amount:200000,kind:'expense',paid:true,month:'2026-10'}];
 assert.deepEqual(debtStats(debt,payments),{paid:300000,remaining:1000000,months:4});
 assert.equal(totals([{kind:'income',amount:3000000},...payments.filter(p=>p.month==='2026-09')]).free,2900000);
 assert.deepEqual(debtStats({...debt,monthly_payment:null},payments),{paid:300000,remaining:1000000,months:null});
 assert.equal(debtStats({...debt,amount:300000},payments).months,0);
});
