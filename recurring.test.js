import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updateMonthlyRule,monthlyCopies} from './recurring.js';
test('fixed payments skip months, reset check, clamp dates without losing day 31 and avoid duplicates',()=>{
 const rules=[],original={id:'a',kind:'expense',month:'2028-01',title:'Arriendo',amount:850000,category:'Vivienda',notes:'',recurring:true,paid:true,due_date:'2028-01-31'};
 updateMonthlyRule(rules,original);
 const feb=monthlyCopies(rules,[],'2028-02')[0];
 assert.equal(feb.due_date,'2028-02-29');assert.equal(feb.paid,false);
 assert.equal(monthlyCopies(rules,[feb],'2028-02').length,0);
 assert.equal(monthlyCopies(rules,[],'2028-05')[0].due_date,'2028-05-31');
 assert.equal(monthlyCopies(rules,[],'2027-12').length,0);
 updateMonthlyRule(rules,{...feb,amount:900000},feb);
 assert.equal(monthlyCopies(rules,[],'2028-03')[0].due_date,'2028-03-31');
 assert.equal(monthlyCopies(rules,[],'2028-03')[0].amount,900000);
 updateMonthlyRule(rules,{...feb,recurring:false},feb);
 assert.equal(monthlyCopies(rules,[],'2028-03').length,0);
 assert.equal(original.paid,true);
});
