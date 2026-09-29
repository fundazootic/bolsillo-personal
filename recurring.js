export function updateMonthlyRule(rules,row,previous){
 if(row.kind!=='expense'||row.debt_id)return;
 const source_id=row.source_id||row.id,old=rules.find(r=>r.source_id===source_id);
 const due_day=previous&&previous.due_date===row.due_date&&old?old.due_day:row.due_date?Number(row.due_date.slice(-2)):null;
 const rule={source_id,title:row.title,amount:row.amount,category:row.category,notes:row.notes,due_day,start_month:old?.start_month||row.month,active:row.recurring};
 if(old)Object.assign(old,rule);else rules.push(rule);
}
export function monthlyCopies(rules,rows,month){
 const lastDay=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
 return rules.filter(r=>r.active&&r.start_month<month&&!rows.some(e=>(e.source_id||e.id)===r.source_id)).map(r=>({
  source_id:r.source_id,month,kind:'expense',title:r.title,amount:r.amount,category:r.category,notes:r.notes,
  recurring:true,paid:false,version:1,due_date:r.due_day?`${month}-${String(Math.min(r.due_day,lastDay)).padStart(2,'0')}`:null
 }));
}
export function withMonthlyStatus(rows,rules){return rows.map(r=>{
 const rule=r.kind==='expense'&&!r.debt_id?rules.find(p=>p.source_id===(r.source_id||r.id)):null;
 return rule?{...r,recurring:rule.active}:r;
});}
