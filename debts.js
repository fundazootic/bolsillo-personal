import {accountSections} from './card-view.js';
import {money,parseAmount,monthNow,monthLabel,shiftMonth} from './core.js';
import {bindAmounts,debtStats} from './amounts.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const number=v=>v?new Intl.NumberFormat('es-CO').format(v):'';
export function createDebts({db,isDemo,getMonth,getUser,refresh,toast,setBusy}){
 let debts=[],payments=[],charges=[],demoDebts=[],demoPayments=[],demoCharges=[],unavailable=false;
 function reset(){debts=[];payments=[];charges=[];demoDebts=[];demoPayments=[];demoCharges=[];}
 async function fetchData(){
  if(isDemo())return {debts:demoDebts,payments:demoPayments,charges:demoCharges};
  const [d,p,c]=await Promise.all([db.from('debt_accounts').select('*').order('created_at'),db.from('entries').select('*').not('debt_id','is',null).eq('is_debt_balance',false).order('payment_date'),db.from('card_charges').select('*').order('charge_date')]);
  if(d.error||p.error||c.error)throw Error('No se pudieron cargar las deudas.');
  return {debts:d.data,payments:p.data,charges:c.data};
 }
 function accept(data){debts=data.debts;payments=data.payments;charges=data.charges;unavailable=false;}
 function failed(){unavailable=true;}
 function demoRows(){return demoPayments.filter(p=>p.month===getMonth());}
 function section(){
  if(unavailable)return '<section class="panel debt-panel"><div class="panel-heading"><h2>Deudas y abonos</h2><p>No pudimos consultar tus deudas. Actualiza para reintentar.</p></div></section>';
  return accountSections(debts,payments,charges);
 }
 function bind(){
  document.querySelector('#new-debt')?.addEventListener('click',()=>editDebt());
  document.querySelector('#new-card')?.addEventListener('click',()=>editDebt(null,true));
  document.querySelectorAll('[data-card-charge]').forEach(b=>b.onclick=()=>editCharge(debts.find(d=>d.id===b.dataset.cardCharge)));
  document.querySelectorAll('[data-charge-edit]').forEach(b=>b.onclick=()=>{const c=charges.find(c=>c.id===b.dataset.chargeEdit);editCharge(debts.find(d=>d.id===c.debt_id),c);});
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
 function editDebt(d,card=d?.account_type==='card'){
  const id=d?.id||crypto.randomUUID();
  modal(d?(card?'Editar tarjeta':'Editar deuda'):(card?'Agregar tarjeta':'Agregar deuda'),`<label for="debt-title">${card?'Nombre de la tarjeta':'¿A quién le debes o qué debes?'}</label><input id="debt-title" name="title" required maxlength="120" value="${esc(d?.title||'')}" placeholder="Ej. Préstamo de Juan"><label for="debt-amount">${card?'Saldo inicial de la tarjeta en pesos':'Total de la deuda en pesos'}</label><input id="debt-amount" data-money name="amount" inputmode="numeric" required value="${d?.amount===0?'0':number(d?.amount)}" placeholder="Ej. 1.300.000"><label for="debt-plan">Abono mensual de referencia <small>(opcional)</small></label><input id="debt-plan" data-money name="plan" inputmode="numeric" value="${number(d?.monthly_payment)}" placeholder="Ej. 100.000"><p class="helper">Es opcional y solo estima el plazo. Cada abono puede ser mayor o menor; no registra pagos ni aparta dinero.</p><label for="debt-notes">Nota <small>(opcional)</small></label><textarea id="debt-notes" name="notes" maxlength="1000">${esc(d?.notes||'')}</textarea>`,async data=>{
   const values={id,title:String(data.get('title')).trim(),account_type:card?'card':'debt',amount:card&&String(data.get('amount')).trim()==='0'?0:parseAmount(data.get('amount')),monthly_payment:data.get('plan')?parseAmount(data.get('plan')):null,notes:String(data.get('notes')).trim()};
   if(!values.title)throw Error('Escribe el nombre de la deuda.');
   if(d&&values.amount+charges.filter(c=>c.debt_id===d.id).reduce((a,c)=>a+c.amount,0)<debtStats(d,payments,charges).paid)throw Error('El total no puede ser menor que lo abonado.');
   if(isDemo()){if(d)Object.assign(d,values,{version:d.version+1});else demoDebts.push({...values,version:1});return;}
   const result=d?await db.from('debt_accounts').update({...values,version:d.version+1}).eq('id',d.id).eq('version',d.version).select('id'):await db.from('debt_accounts').upsert({...values,user_id:getUser(),version:1},{onConflict:'id',ignoreDuplicates:true}).select('id');
   if(result.error)throw Error(result.error.message);if(d&&!result.data.length)throw Error('La deuda cambió en otro dispositivo. Cierra y actualiza antes de editar.');
  });
 }
 function editPayment(d,p){
  const requestId=p?.id||crypto.randomUUID(),remaining=debtStats(d,payments,charges).remaining+(p?.amount||0);
  modal(p?'Corregir abono':'Registrar abono',`<p class="helper">${esc(d.title)} · Saldo disponible: ${money(remaining)}</p><label for="payment-amount">Valor del abono en pesos</label><input id="payment-amount" data-money name="amount" inputmode="numeric" required value="${number(p?.amount)}" placeholder="Ej. 100.000"><label for="payment-date">Fecha del abono</label><input id="payment-date" type="date" name="date" min="2000-01-01" max="${today()}" required value="${p?.payment_date||today()}"><label for="payment-notes">Nota <small>(opcional)</small></label><textarea id="payment-notes" name="notes" maxlength="1000">${esc(p?.notes||'')}</textarea><p class="helper">Puedes abonar más o menos que tu referencia mensual. Se descontará de tu dinero libre en el mes de esta fecha.</p>`,async data=>{
   const amount=parseAmount(data.get('amount')),date=String(data.get('date')),notes=String(data.get('notes')).trim();
   if(amount>remaining)throw Error('El abono supera el saldo pendiente.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today()||date<'2000-01-01')throw Error('Revisa la fecha del abono.');
   const values={amount,month:date.slice(0,7),payment_date:date,notes};
   if(isDemo()){if(p)Object.assign(p,values,{version:p.version+1});else demoPayments.push({...values,id:requestId,debt_id:d.id,kind:'expense',category:'Deudas',title:d.title,paid:true,recurring:false,version:1});return;}
   const result=p?await db.from('entries').update({...values,version:p.version+1}).eq('id',p.id).eq('version',p.version).select('id'):await db.rpc('add_debt_payment',{p_id:requestId,p_debt:d.id,p_amount:amount,p_date:date,p_notes:notes});
   if(result.error)throw Error(result.error.message);if(p&&!result.data.length)throw Error('El abono cambió en otro dispositivo. Cierra y actualiza antes de editar.');
  });
 }
 function editCharge(d,c){
  const requestId=c?.id||crypto.randomUUID();
  modal(c?'Corregir compra o cargo':'Registrar compra',`<p class="helper">${esc(d.title)} · Esto aumenta lo que debes en la tarjeta.</p><label for="charge-description">¿Qué pagaste con la tarjeta?</label><input id="charge-description" name="description" required maxlength="120" placeholder="Ej. Mercado, gasolina o una compra" value="${esc(c?.description||'')}"><label for="charge-amount">Valor de la compra en pesos</label><input id="charge-amount" data-money name="amount" inputmode="numeric" required value="${number(c?.amount)}" placeholder="Ej. 150.000"><label for="charge-date">Fecha de la compra</label><input id="charge-date" name="date" type="date" min="2000-01-01" max="${today()}" required value="${c?.charge_date||today()}"><label for="charge-type">Tipo de movimiento</label><select id="charge-type" name="type"><option value="purchase" ${c?.charge_type!=='fee'?'selected':''}>Compra</option><option value="fee" ${c?.charge_type==='fee'?'selected':''}>Interés, cuota de manejo u otro cargo</option></select><p class="helper">Registra el valor total de la compra una sola vez. Tu dinero libre bajará cuando abones a la tarjeta.</p>`,async data=>{
   const amount=parseAmount(data.get('amount')),date=String(data.get('date')),description=String(data.get('description')).trim(),charge_type=String(data.get('type'));
   if(!description)throw Error('Describe la compra o el cargo.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today()||date<'2000-01-01')throw Error('Revisa la fecha.');
   if(c&&debtStats(d,payments,charges).remaining+amount-c.amount<0)throw Error('La corrección dejaría los abonos por encima de la deuda.');
   const values={amount,charge_date:date,description,charge_type};
   if(isDemo()){if(c)Object.assign(c,values,{version:c.version+1});else demoCharges.push({...values,id:requestId,debt_id:d.id,version:1});return;}
   const result=c?await db.from('card_charges').update({...values,version:c.version+1}).eq('id',c.id).eq('version',c.version).select('id'):await db.rpc('add_card_charge',{p_id:requestId,p_debt:d.id,p_amount:amount,p_date:date,p_description:description,p_type:charge_type});
   if(result.error)throw Error(result.error.message);if(c&&!result.data.length)throw Error('La compra cambió en otro dispositivo. Cierra y actualiza antes de editar.');
  });
 }
 return {fetchData,accept,failed,reset,demoRows,section,bind,editPaymentById:id=>{const p=payments.find(p=>p.id===id);if(p)editPayment(debts.find(d=>d.id===p.debt_id),p);}};
}

