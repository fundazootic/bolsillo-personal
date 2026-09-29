import {money,parseAmount,monthNow,monthLabel,shiftMonth} from './core.js';
import {bindAmounts,debtStats} from './amounts.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const number=v=>v?new Intl.NumberFormat('es-CO').format(v):'';
export function createDebts({db,isDemo,getMonth,getUser,refresh,toast,setBusy}){
 let debts=[],payments=[],demoDebts=[],demoPayments=[],unavailable=false;
 function reset(){debts=[];payments=[];demoDebts=[];demoPayments=[];}
 async function fetchData(){
  if(isDemo())return {debts:demoDebts,payments:demoPayments};
  const [d,p]=await Promise.all([db.from('debt_accounts').select('*').order('created_at'),db.from('entries').select('*').not('debt_id','is',null).eq('is_debt_balance',false).order('payment_date')]);
  if(d.error||p.error)throw Error('No se pudieron cargar las deudas.');
  return {debts:d.data,payments:p.data};
 }
 function accept(data){debts=data.debts;payments=data.payments;unavailable=false;}
 function failed(){unavailable=true;}
 function demoRows(){return demoPayments.filter(p=>p.month===getMonth());}
 function section(){
  if(unavailable)return '<section class="panel debt-panel"><div class="panel-heading"><h2>Deudas y abonos</h2><p>No pudimos consultar tus deudas. Actualiza para reintentar.</p></div></section>';
  const pending=debts.reduce((sum,d)=>sum+debtStats(d,payments).remaining,0);
  return `<section class="panel debt-panel" aria-label="Deudas y abonos"><div class="panel-heading"><div><h2>Deudas y abonos</h2><p>Tus deudas continúan aquí aunque cambies de mes.</p></div><button class="primary" id="new-debt">+ Agregar deuda</button></div><div class="debt-total"><span>Saldo pendiente total</span><strong>${money(pending)}</strong></div><div class="debt-cards">${debts.map(d=>{
   const s=debtStats(d,payments),history=payments.filter(p=>p.debt_id===d.id).sort((a,b)=>b.payment_date.localeCompare(a.payment_date));
   return `<article class="debt-card"><div class="debt-card-top"><div><h3>${esc(d.title)}</h3><span class="badge ${s.remaining?'pending':'paid'}">${s.remaining?'Por pagar':'Saldada'}</span></div><button class="text-button" data-debt-edit="${d.id}">Editar deuda</button></div><div class="debt-numbers"><div><span>Total registrado</span><strong>${money(d.amount)}</strong></div><div><span>Has abonado</span><strong>${money(s.paid)}</strong></div><div><span>Falta por pagar</span><strong>${money(s.remaining)}</strong></div></div><div class="progress-track"><div style="width:${Math.min(100,Math.round(s.paid/d.amount*100))}%"></div></div><p class="debt-estimate">${s.months===0?'¡Deuda saldada!':s.months?`Con ${money(d.monthly_payment)} al mes: ${s.months} ${s.months===1?'abono mensual':'abonos mensuales'}${s.months<=1200?`, aproximadamente hasta ${esc(monthLabel(shiftMonth(monthNow(),s.months)))}`:''}.`:'Define un abono mensual en «Editar deuda» para estimar cuándo terminarás.'}</p>${d.notes?`<p class="debt-note">${esc(d.notes)}</p>`:''}<button class="outline" data-debt-pay="${d.id}" ${s.remaining?'':'disabled'}>+ Registrar abono</button><details class="debt-history"><summary>Historial de abonos (${history.length})</summary>${history.map(p=>`<div class="debt-payment"><div><strong>${money(p.amount)}</strong><span>${esc(p.payment_date.split('-').reverse().join('/'))}${p.notes?' · '+esc(p.notes):''}</span></div><button class="text-button" data-payment-edit="${p.id}">Corregir abono</button></div>`).join('')||'<p>Todavía no has registrado abonos.</p>'}</details></article>`;
  }).join('')||'<div class="empty-state"><strong>Empieza con tu primera deuda</strong><p>Registra cuánto debes y después agrega cada abono.</p></div>'}</div><div class="budget-caption">Solo los abonos se descuentan del presupuesto del mes de su fecha. El saldo total y el plan mensual no se apartan automáticamente. La estimación parte del próximo mes y supone pagos constantes, sin intereses ni cargos nuevos.</div></section>`;
 }
 function bind(){
  document.querySelector('#new-debt')?.addEventListener('click',()=>editDebt());
  document.querySelectorAll('[data-debt-edit]').forEach(b=>b.onclick=()=>editDebt(debts.find(d=>d.id===b.dataset.debtEdit)));
  document.querySelectorAll('[data-debt-pay]').forEach(b=>b.onclick=()=>editPayment(debts.find(d=>d.id===b.dataset.debtPay)));
  document.querySelectorAll('[data-payment-edit]').forEach(b=>b.onclick=()=>{const p=payments.find(p=>p.id===b.dataset.paymentEdit);editPayment(debts.find(d=>d.id===p.debt_id),p);});
 }
 function modal(title,fields,onSave,extra=''){
  const dialog=document.querySelector('#editor');let saving=false;
  dialog.innerHTML=`<form id="debt-form"><div class="dialog-heading"><h2>${title}</h2><button type="button" class="icon-button" aria-label="Cerrar" id="debt-close">✕</button></div>${fields}<p class="form-error" id="debt-error" role="alert"></p>${extra}<div class="dialog-footer"><span></span><button class="primary" type="submit">Guardar</button></div></form>`;
  bindAmounts(dialog);dialog.showModal();document.querySelector('#debt-close').onclick=()=>{if(!saving)dialog.close();};dialog.oncancel=e=>{if(saving)e.preventDefault();};
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;setBusy(true);dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{await onSave(new FormData(e.target));dialog.close();toast('Guardado. Tu saldo está actualizado.');setBusy(false);await refresh();}
   catch(error){document.querySelector('#debt-error').textContent=error.message||'No se pudo guardar. Revisa tu conexión.';}
   finally{saving=false;setBusy(false);dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };return dialog;
 }
 function editDebt(d){
  const id=d?.id||crypto.randomUUID();
  modal(d?'Editar deuda':'Agregar deuda',`<label for="debt-title">¿A quién le debes o qué debes?</label><input id="debt-title" name="title" required maxlength="120" value="${esc(d?.title||'')}" placeholder="Ej. Préstamo de Juan"><label for="debt-amount">Total de la deuda en pesos</label><input id="debt-amount" data-money name="amount" inputmode="numeric" required value="${number(d?.amount)}" placeholder="Ej. 1.300.000"><label for="debt-plan">Abono mensual previsto <small>(opcional)</small></label><input id="debt-plan" data-money name="plan" inputmode="numeric" value="${number(d?.monthly_payment)}" placeholder="Ej. 100.000"><p class="helper">Sirve para estimar el plazo; no registra un pago ni aparta dinero.</p><label for="debt-notes">Nota <small>(opcional)</small></label><textarea id="debt-notes" name="notes" maxlength="1000">${esc(d?.notes||'')}</textarea>`,async data=>{
   const values={id,title:String(data.get('title')).trim(),amount:parseAmount(data.get('amount')),monthly_payment:data.get('plan')?parseAmount(data.get('plan')):null,notes:String(data.get('notes')).trim()};
   if(!values.title)throw Error('Escribe el nombre de la deuda.');
   if(d&&values.amount<debtStats(d,payments).paid)throw Error('El total no puede ser menor que lo abonado.');
   if(isDemo()){if(d)Object.assign(d,values,{version:d.version+1});else demoDebts.push({...values,version:1});return;}
   const result=d?await db.from('debt_accounts').update({...values,version:d.version+1}).eq('id',d.id).eq('version',d.version).select('id'):await db.from('debt_accounts').upsert({...values,user_id:getUser(),version:1},{onConflict:'id',ignoreDuplicates:true}).select('id');
   if(result.error)throw Error(result.error.message);if(d&&!result.data.length)throw Error('La deuda cambió en otro dispositivo. Cierra y actualiza antes de editar.');
  });
 }
 function editPayment(d,p){
  const requestId=p?.id||crypto.randomUUID(),remaining=debtStats(d,payments).remaining+(p?.amount||0);
  modal(p?'Corregir abono':'Registrar abono',`<p class="helper">${esc(d.title)} · Saldo disponible: ${money(remaining)}</p><label for="payment-amount">Valor del abono en pesos</label><input id="payment-amount" data-money name="amount" inputmode="numeric" required value="${number(p?.amount)}" placeholder="Ej. 100.000"><label for="payment-date">Fecha del abono</label><input id="payment-date" type="date" name="date" min="2000-01-01" max="${today()}" required value="${p?.payment_date||today()}"><label for="payment-notes">Nota <small>(opcional)</small></label><textarea id="payment-notes" name="notes" maxlength="1000">${esc(p?.notes||'')}</textarea><p class="helper">Se registrará como pago realizado en el mes de esta fecha.</p>`,async data=>{
   const amount=parseAmount(data.get('amount')),date=String(data.get('date')),notes=String(data.get('notes')).trim();
   if(amount>remaining)throw Error('El abono supera el saldo pendiente.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today()||date<'2000-01-01')throw Error('Revisa la fecha del abono.');
   const values={amount,month:date.slice(0,7),payment_date:date,notes};
   if(isDemo()){if(p)Object.assign(p,values,{version:p.version+1});else demoPayments.push({...values,id:requestId,debt_id:d.id,kind:'expense',category:'Deudas',title:d.title,paid:true,recurring:false,version:1});return;}
   const result=p?await db.from('entries').update({...values,version:p.version+1}).eq('id',p.id).eq('version',p.version).select('id'):await db.rpc('add_debt_payment',{p_id:requestId,p_debt:d.id,p_amount:amount,p_date:date,p_notes:notes});
   if(result.error)throw Error(result.error.message);if(p&&!result.data.length)throw Error('El abono cambió en otro dispositivo. Cierra y actualiza antes de editar.');
  });
 }
 return {fetchData,accept,failed,reset,demoRows,section,bind,editPaymentById:id=>{const p=payments.find(p=>p.id===id);if(p)editPayment(debts.find(d=>d.id===p.debt_id),p);}};
}

