import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

// This endpoint uses the private, high-entropy invitation/recovery code as its
// custom authentication. Never deploy it without that validation.
const allowedOrigins = new Set(['https://fundazootic.github.io','http://127.0.0.1:5173','http://localhost:5173']);
const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const publicClient = () => createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const hash = async (code:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))).map(b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req => {
 const origin=req.headers.get('origin');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin&&allowedOrigins.has(origin)?origin:'https://fundazootic.github.io','Vary':'Origin','Access-Control-Allow-Headers':'content-type,apikey,authorization,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowedOrigins.has(origin))return reply(403,{error:'Origen no permitido.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Método no permitido.'});
 try {
  const text=await req.text();if(text.length>4096)return reply(413,{error:'Solicitud demasiado grande.'});
  const {action,code,password,username:raw}=JSON.parse(text);
  if(!['register','recover'].includes(action)||typeof code!=='string'||! /^[a-f0-9]{48}$/.test(code.trim()))return reply(400,{error:'Revisa tu código privado. Debe tener 48 caracteres.'});
  if(typeof password!=='string'||password.length<12||password.length>128)return reply(400,{error:'Usa una contraseña de 12 a 128 caracteres.'});
  const codeHash=await hash(code.trim());
  if(action==='recover'){
   const {data,error}=await admin.rpc('bolsillo_recovery',{p_hash:codeHash});
   if(error||!data?.length)return reply(400,{error:'El código no corresponde a una cuenta registrada.'});
   const account=data[0];
   const updated=await admin.auth.admin.updateUserById(account.user_id,{password});
   if(updated.error)return reply(400,{error:'No se pudo cambiar la contraseña. Intenta otra distinta.'});
   const client=publicClient();
   const signed=await client.auth.signInWithPassword({email:`${account.username}@bolsillo.invalid`,password});
   if(signed.data.session)await admin.auth.admin.signOut(signed.data.session.access_token,'global');
   return reply(200,{username:account.username,message:'Contraseña actualizada. Inicia sesión de nuevo.'});
  }
  const username=typeof raw==='string'?raw.trim().toLowerCase():'';
  if(!/^[a-z0-9_]{3,30}$/.test(username))return reply(400,{error:'El usuario debe tener de 3 a 30 letras sin tildes, números o guion bajo.'});
  const claim=crypto.randomUUID();
  const reserved=await admin.rpc('bolsillo_claim',{p_hash:codeHash,p_username:username,p_claim:claim});
  if(reserved.error)return reply(400,{error:reserved.error.code==='23505'?'Ese usuario ya existe. Elige otro.':'Código no disponible. Si ya creaste tu cuenta, entra o recupera tu contraseña.'});
  const created=await admin.auth.admin.createUser({email:`${username}@bolsillo.invalid`,password,email_confirm:true,user_metadata:{username}});
  if(created.error||!created.data.user){await admin.rpc('bolsillo_release',{p_hash:codeHash,p_claim:claim});return reply(400,{error:'No se pudo crear la cuenta. Prueba otro usuario o contraseña.'});}
  const completed=await admin.rpc('bolsillo_finish',{p_hash:codeHash,p_claim:claim,p_user:created.data.user.id});
  if(completed.error){
   // Remove only the newly created, not-yet-authorized account from this request.
   const removed=await admin.auth.admin.deleteUser(created.data.user.id);
   if(!removed.error)await admin.rpc('bolsillo_release',{p_hash:codeHash,p_claim:claim});
   return reply(503,{error:'No se pudo completar el registro. Inténtalo más tarde.'});
  }
  return reply(201,{username,message:'Cuenta creada. Ya puedes entrar.'});
 }catch{return reply(400,{error:'No se pudo procesar la solicitud. Revisa los datos e inténtalo de nuevo.'});}
});
