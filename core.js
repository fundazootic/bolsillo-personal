export const categories = ['Tarjetas','Servicios','Vivienda','Alimentación','Transporte','Salud','Deudas','Otros'];
export const money = value => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
export function monthNow(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
export function shiftMonth(month,delta){const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
export const monthLabel = month => new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric'}).format(new Date(`${month}-15T12:00:00`));
export function totals(rows){const sum=rs=>rs.reduce((a,r)=>a+r.amount,0);const income=sum(rows.filter(r=>r.kind==='income'));const expenses=rows.filter(r=>r.kind==='expense');const paid=sum(expenses.filter(r=>r.paid));const pending=sum(expenses.filter(r=>!r.paid));const reserved=sum(rows.filter(r=>r.kind==='allocation'));return {income,paid,pending,reserved,balance:income-paid,free:income-paid-pending-reserved,count:expenses.length,done:expenses.filter(r=>r.paid).length};}
export function parseAmount(value){const clean=String(value).trim().replace(/\./g,'').replace(/\s/g,'');if(!/^\d+$/.test(clean))throw Error('Escribe un valor en pesos, sin decimales.');const amount=Number(clean);if(!Number.isSafeInteger(amount)||amount<=0||amount>999999999999)throw Error('El valor debe estar entre $1 y $999.999.999.999.');return amount;}
export function copyRecurring(rows,month){return rows.filter(r=>r.recurring).map(r=>{let due_date=null;if(r.due_date){const day=Math.min(Number(r.due_date.slice(-2)),new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate());due_date=`${month}-${String(day).padStart(2,'0')}`;}return {kind:r.kind,title:r.title,amount:r.amount,category:r.category,notes:r.notes,recurring:true,paid:false,month,due_date,source_id:r.source_id||r.id};});}
export function demoRows(month){return [
{id:'demo1',kind:'income',title:'Sueldo',amount:3000000,category:'Ingreso',paid:false,recurring:true},
{id:'demo2',kind:'expense',title:'Arriendo',amount:850000,category:'Vivienda',paid:true,recurring:true,due_date:`${month}-05`},
{id:'demo3',kind:'expense',title:'Tarjeta de crédito',amount:350000,category:'Tarjetas',paid:false,recurring:true,due_date:`${month}-20`},
{id:'demo4',kind:'expense',title:'Internet de casa',amount:95000,category:'Servicios',paid:false,recurring:true,due_date:`${month}-25`},
{id:'demo5',kind:'expense',title:'Mercado',amount:400000,category:'Alimentación',paid:true,recurring:false},
{id:'demo6',kind:'allocation',title:'Mi ahorro',amount:300000,category:'Ahorro',paid:false,recurring:true},
{id:'demo7',kind:'allocation',title:'Para disfrutar',amount:200000,category:'Personal',paid:false,recurring:true}
].map(r=>({...r,month,notes:'',version:1,source_id:null}));}
