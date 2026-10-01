import {inPeriod} from './periods.js';
export function formatPesos(value){
 const text=String(value).replace(/\s/g,'');
 if(!text)return '';
 if(!/^[\d.]+$/.test(text)&&!/^\d{1,3}(?:[.,]\d{3})+$/.test(text))return text;
 const digits=text.replace(/[.,]/g,'').replace(/^0+(?=\d)/,'');
 return digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
export function bindAmounts(root){
 root.querySelectorAll('[data-money]').forEach(input=>{
  input.addEventListener('input',()=>{
   const before=input.value,start=input.selectionStart??before.length;
   const count=(before.slice(0,start).match(/\d/g)||[]).length;
   input.value=formatPesos(before);
   let pos=0,seen=0;
   while(pos<input.value.length&&seen<count){if(/\d/.test(input.value[pos]))seen++;pos++;}
   input.setSelectionRange(pos,pos);
  });
 });
}
export function debtStats(debt,payments,charges=[]){
 const paid=payments.filter(p=>p.debt_id===debt.id&&!p.is_debt_balance).reduce((sum,p)=>sum+p.amount,0);
 const charged=charges.filter(c=>c.debt_id===debt.id).reduce((sum,c)=>sum+c.amount,0);
 const remaining=Math.max(0,debt.amount+charged-paid);
 const months=remaining===0?0:debt.monthly_payment?Math.ceil(remaining/debt.monthly_payment):null;
 return {paid,remaining,months};
}
export function cardMonthStats(id,payments,charges,month,day=1){
 return {
  spent:charges.filter(c=>c.debt_id===id&&inPeriod(c.charge_date,month,day)).reduce((sum,c)=>sum+c.amount,0),
  paid:payments.filter(p=>p.debt_id===id&&!p.is_debt_balance&&inPeriod(p.payment_date,month,day)).reduce((sum,p)=>sum+p.amount,0)
 };
}
