import { getStore } from '@netlify/blobs';
const reply=(data,statusCode=200)=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(data)});
const err=(error,status=400)=>reply({error},status);
const safe=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const KEY=['violation','violation','violation','legal','legal','legal'];
const DEFAULT={session:1};
export async function handler(event){
 try{
  const store=getStore({name:'quqyqtyq-results',consistency:'strong'});
  const path=event.path.replace(/^\/\.netlify\/functions\/api/,'').replace(/^\/api/,'')||'/state';
  const settings=await store.get('settings',{type:'json'})||DEFAULT;
  if(path==='/state'&&event.httpMethod==='GET'){
   const listed=await store.list({prefix:'student-'+settings.session+'-'});
   const students=await Promise.all(listed.blobs.map(b=>store.get(b.key,{type:'json'})));
   return reply({session:settings.session,students:students.filter(Boolean).sort((a,b)=>a.joined-b.joined).map(({joined,...rest})=>rest)});
  }
  if(event.httpMethod!=='POST')return err('Сұраныс табылмады',404);
  const body=JSON.parse(event.body||'{}');
  if(path==='/join'){
   const name=safe(body.name,60).replace(/\s+/g,' ');
   if(name.length<2)return err('Атыңызды енгізіңіз');
   const id=crypto.randomUUID();
   await store.setJSON('student-'+settings.session+'-'+id,{id,name,joined:Date.now(),finished:false});
   return reply({id,session:settings.session});
  }
  if(path==='/submit'){
   const {id,session,answers}=body;
   const conclusion=safe(body.conclusion,240),reflectionChoice=safe(body.reflectionChoice,100),reflectionText=safe(body.reflectionText,240);
   if(session!==settings.session)return err('Мұғалім ойынды қайта бастады. Бетті жаңартыңыз.',409);
   if(!Array.isArray(answers)||answers.length!==6||answers.some(x=>!['violation','legal'].includes(x))||conclusion.length<5||!reflectionChoice||reflectionText.length<5)return err('Барлық тапсырманы орындаңыз');
   const key='student-'+session+'-'+safe(id,80);
   const student=await store.get(key,{type:'json'});
   if(!student)return err('Оқушы табылмады',404);
   const score=answers.reduce((n,a,i)=>n+(a===KEY[i]?1:0),0);
   await store.setJSON(key,{...student,finished:true,score,conclusion,reflectionChoice,reflectionText});
   return reply({ok:true,score});
  }
  if(path==='/reset'){
   const pin=process.env.ADMIN_PIN;
   if(!pin)return err('Мұғалім PIN коды Netlify жүйесінде орнатылмаған.',503);
   if(body.pin!==pin)return err('PIN қате',403);
   await store.setJSON('settings',{session:settings.session+1});
   return reply({ok:true});
  }
  return err('Сұраныс табылмады',404);
 }catch(e){return err('Сервер қатесі: '+String(e.message||e),500)}
}
