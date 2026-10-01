import {shiftMonth,totals} from './core.js';
export const isoToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function dateAt(month,day){return `${month}-${String(Math.min(day,new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate())).padStart(2,'0')}`;}
function previousDay(date){return new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10);}
export function periodBounds(month,day=1){return day===1?{start:`${month}-01`,end:previousDay(`${shiftMonth(month,1)}-01`)}:{start:dateAt(shiftMonth(month,-1),day),end:previousDay(dateAt(month,day))};}
export function periodFor(date,day=1){const m=date.slice(0,7);return day===1||date<dateAt(m,day)?m:shiftMonth(m,1);}
export function inPeriod(date,month,day=1){const b=periodBounds(month,day);return Boolean(date)&&date>=b.start&&date<=b.end;}
export function dueInPeriod(month,dueDay,day=1){const b=periodBounds(month,day);if(!dueDay)return null;const candidate=dateAt(month,dueDay);return candidate<=b.end?candidate:dateAt(shiftMonth(month,-1),dueDay);}
export function flowStats(rows,previous,month,day=1,today=isoToday()){
 const t=totals(rows),p=totals(previous),bounds=periodBounds(month,day),afterPending=t.free-t.pending;
 const days=today>bounds.end?0:Math.floor((Date.parse(bounds.end+'T12:00:00Z')-Date.parse((today<bounds.start?bounds.start:today)+'T12:00:00Z'))/86400000)+1;
 return {afterPending,net:t.income-t.paid,days,daily:days?Math.max(0,Math.floor(afterPending/days)):null,paidRatio:t.income?Math.round(t.paid/t.income*100):null,change:previous.length?t.paid-p.paid:null,overdue:rows.filter(r=>r.kind==='expense'&&!r.paid&&r.due_date&&r.due_date<today).length};
}
