/* ☁ Firestore over plain HTTPS requests - the way in when the live channel is refused.
 *
 * The Firebase SDK talks to Firestore over one long-lived streaming connection (WebChannel). On 2026-09-21 Google's
 * edge refused that stream for this game's database from the developer's own network ("Unknown SID") while every
 * ordinary request went through: the SDK then neither answers nor fails, and the cloud save is simply gone. The same
 * documents are reachable through Firestore's REST API - one request, one answer, the same security rules, the same
 * Firebase sign-in (the ID token goes in an Authorization header). This module is that road and nothing else: it turns
 * plain JSON into Firestore's typed values and back, builds the three requests the game needs (read a document, write
 * fields of a document, run a query) and gives every one of them a deadline. No DOM, no Firebase, no game: it runs
 * headless in the tests against a fake fetch.
 *
 * Values are encoded exactly as the JS SDK encodes them, so a document written here is indistinguishable from one the
 * SDK wrote: a safe integer is an integerValue (sent as a string, as the API wants), any other number a doubleValue,
 * arrays and maps nest, null stays null. The game JSON-round-trips a save before it writes it, so nothing else exists. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.FirestoreRest=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const HOST='https://firestore.googleapis.com/v1/';
 function encodeValue(v){
  if(v===null||v===undefined)return {nullValue:null};
  if(typeof v==='boolean')return {booleanValue:v};
  if(typeof v==='string')return {stringValue:v};
  if(typeof v==='number'){
   if(Number.isNaN(v))return {doubleValue:'NaN'};
   if(v===Infinity)return {doubleValue:'Infinity'};
   if(v===-Infinity)return {doubleValue:'-Infinity'};
   return Number.isSafeInteger(v)&&!Object.is(v,-0)?{integerValue:String(v)}:{doubleValue:v};
  }
  if(Array.isArray(v)){
   /* Firestore has no array directly inside an array; the SDK refuses it on the client, so refuse it here too rather
      than let the server answer 400 for a whole save */
   if(v.some(Array.isArray))throw new TypeError('Firestore cannot store an array directly inside an array');
   return {arrayValue:{values:v.map(encodeValue)}};
  }
  if(typeof v==='object')return {mapValue:{fields:encodeFields(v)}};
  throw new TypeError('cannot store a '+typeof v+' in Firestore');
 }
 function encodeFields(obj){
  const out={};
  for(const key of Object.keys(obj)){if(obj[key]===undefined)continue;out[key]=encodeValue(obj[key]);}   /* undefined is "not there", as JSON has it */
  return out;
 }
 function decodeValue(v){
  if(!v||typeof v!=='object')return null;
  if('nullValue' in v)return null;
  if('booleanValue' in v)return !!v.booleanValue;
  if('integerValue' in v)return Number(v.integerValue);
  if('doubleValue' in v)return Number(v.doubleValue);            /* a number, or the strings "NaN" / "Infinity" / "-Infinity" */
  if('stringValue' in v)return v.stringValue;
  if('arrayValue' in v)return ((v.arrayValue&&v.arrayValue.values)||[]).map(decodeValue);
  if('mapValue' in v)return decodeFields((v.mapValue&&v.mapValue.fields)||{});
  if('timestampValue' in v)return v.timestampValue;
  if('referenceValue' in v)return v.referenceValue;
  if('bytesValue' in v)return v.bytesValue;
  if('geoPointValue' in v)return v.geoPointValue;
  return null;
 }
 function decodeFields(fields){
  const out={};
  for(const key of Object.keys(fields||{}))out[key]=decodeValue(fields[key]);
  return out;
 }
 /* a field path for an update mask: plain identifiers as they are, anything else in backticks ("chars.`odd id`") */
 const SIMPLE=/^[A-Za-z_][A-Za-z0-9_]*$/;
 const fieldPath=segments=>segments.map(s=>SIMPLE.test(s)?s:'`'+String(s).replace(/\\/g,'\\\\').replace(/`/g,'\\`')+'`').join('.');
 class CloudError extends Error{
  constructor(status,code,message){super(message);this.name='CloudError';this.status=status;this.code=code;}
 }
 const codeOf=status=>status===401?'unauthenticated':status===403?'permission-denied':status===404?'not-found':status===409?'aborted':status===429?'resource-exhausted':status===400?'invalid-argument':status>=500?'unavailable':'unknown';
 /* One request with a deadline. Never hangs: a silent server is an 'unavailable' CloudError after timeoutMs. */
 async function request(fetchFn,url,{method='GET',token=null,body=null,timeoutMs=15000}={}){
  const ctl=typeof AbortController==='function'?new AbortController():null;
  let timer,res,text;
  const late=new Promise((_,rej)=>{timer=setTimeout(()=>{if(ctl)ctl.abort();rej(new CloudError(0,'unavailable','no answer within '+timeoutMs+' ms'));},timeoutMs);});
  try{
   const headers={};
   if(token)headers.Authorization='Bearer '+token;
   if(body!==null)headers['Content-Type']='application/json';
   const call=(async()=>{const r=await fetchFn(url,{method,headers,body:body===null?undefined:JSON.stringify(body),signal:ctl?ctl.signal:undefined});return [r,await r.text()];})();
   [res,text]=await Promise.race([call,late]);
  }catch(e){
   if(e instanceof CloudError)throw e;
   throw new CloudError(0,'unavailable',(e&&e.message)||'the request failed');
  }finally{clearTimeout(timer);}
  let json=null;try{json=text?JSON.parse(text):null;}catch(e){}
  if(!res.ok){
   const msg=(json&&json.error&&json.error.message)||(Array.isArray(json)&&json[0]&&json[0].error&&json[0].error.message)||('HTTP '+res.status);
   throw new CloudError(res.status,codeOf(res.status),msg);
  }
  return json;
 }
 /* client({fetch, project, getToken}) - getToken(fresh) resolves to a Firebase ID token, or null for a public read.
    A request that comes back 401 is sent once more with getToken(true): a token can run out between two saves. */
 function client({fetch:fetchFn,project,getToken=async()=>null,timeoutMs=15000}){
  const docs=HOST+'projects/'+project+'/databases/(default)/documents';
  const urlOf=path=>docs+'/'+String(path).split('/').map(encodeURIComponent).join('/');
  const send=async(url,opt={})=>{
   const token=await getToken(false);
   try{return await request(fetchFn,url,{...opt,token,timeoutMs});}
   catch(e){
    if(!(e instanceof CloudError&&e.status===401&&token))throw e;
    return request(fetchFn,url,{...opt,token:await getToken(true),timeoutMs});
   }
  };
  return {
   /* {exists, data, updateTime} - a document that is not there is an answer, not an error. `fields` (a list of top-level
      field names) asks for those fields only: a heartbeat on one small field of a large document stays small. */
   async get(path,fields=null){
    const qs=fields&&fields.length?'?'+fields.map(f=>'mask.fieldPaths='+encodeURIComponent(fieldPath([f]))).join('&'):'';
    try{const j=await send(urlOf(path)+qs);return {exists:true,data:decodeFields((j&&j.fields)||{}),updateTime:(j&&j.updateTime)||null};}
    catch(e){if(e instanceof CloudError&&e.status===404)return {exists:false,data:null,updateTime:null};throw e;}
   },
   /* Write `data` into the document. `mask` is a list of field paths (each a list of segments): ONLY those paths are
      touched - a masked path that is missing from `data` is deleted, every other field of the document is left alone,
      and the document is created if it did not exist (the SDK's set-with-merge and update in one). Without a mask the
      whole document is replaced (the SDK's plain set). */
   async patch(path,data,mask=null){
    const qs=mask?'?'+mask.map(p=>'updateMask.fieldPaths='+encodeURIComponent(fieldPath(p))).join('&'):'';
    await send(urlOf(path)+qs,{method:'PATCH',body:{fields:encodeFields(data)}});
    return true;
   },
   /* every document of a top-level collection, ordered, at most `limit` of them: [{id, data}] */
   async query(collectionId,{orderBy=null,descending=false,limit=100}={}){
    const structuredQuery={from:[{collectionId}],limit};
    if(orderBy)structuredQuery.orderBy=[{field:{fieldPath:orderBy},direction:descending?'DESCENDING':'ASCENDING'}];
    const rows=await send(docs+':runQuery',{method:'POST',body:{structuredQuery}});
    return (Array.isArray(rows)?rows:[]).filter(r=>r&&r.document).map(r=>({id:String(r.document.name).split('/').pop(),data:decodeFields(r.document.fields||{})}));
   },
  };
 }
 return Object.freeze({encodeValue,encodeFields,decodeValue,decodeFields,fieldPath,request,client,CloudError});
});
