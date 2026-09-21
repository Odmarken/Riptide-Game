/* A small Firestore for the tests: documents held as typed fields, PATCH with updateMask, GET with a field mask and
 * :runQuery - the semantics Firestore documents, and the ones a trial against the real database confirmed on 2026-09-21
 * (a masked path replaces that path only; a masked path missing from the body is deleted; a PATCH creates the document).
 * `players/...` wants the good token, as the rules do; everything else is public. `maskBug:true` makes a mask on
 * chars.<id> replace the WHOLE chars map - the disaster the game's read-back exists to catch. */
const R=require('../../assets/cloud/firestore-rest.js');
function fakeFirestore({goodToken='good-token',maskBug=false}={}){
 const docs=new Map(),calls=[];
 const parseMaskPath=p=>{const out=[];let i=0;while(i<p.length){if(p[i]==='`'){let s='';i++;while(p[i]!=='`'){if(p[i]==='\\')i++;s+=p[i++];}i++;out.push(s);}else{let s='';while(i<p.length&&p[i]!=='.')s+=p[i++];out.push(s);}if(p[i]==='.')i++;}return out;};
 const getAt=(fields,segs)=>{let cur={mapValue:{fields}};for(const s of segs){if(!cur||!cur.mapValue||!cur.mapValue.fields||!(s in cur.mapValue.fields))return undefined;cur=cur.mapValue.fields[s];}return cur;};
 const setAt=(fields,segs,value)=>{let cur=fields;for(let i=0;i<segs.length-1;i++){if(!cur[segs[i]]||!cur[segs[i]].mapValue)cur[segs[i]]={mapValue:{fields:{}}};if(!cur[segs[i]].mapValue.fields)cur[segs[i]].mapValue.fields={};cur=cur[segs[i]].mapValue.fields;}
  if(value===undefined)delete cur[segs[segs.length-1]];else cur[segs[segs.length-1]]=value;};
 async function fetch(url,opt={}){
  const u=new URL(url),method=opt.method||'GET',token=((opt.headers||{}).Authorization||'').replace('Bearer ','');
  calls.push({method,url,path:decodeURIComponent(u.pathname),query:u.search,body:opt.body?JSON.parse(opt.body):null,token});
  const reply=(status,body)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)});
  const rel=decodeURIComponent(u.pathname).split('/documents')[1]||'';
  if(rel===':runQuery'){
   const q=JSON.parse(opt.body).structuredQuery,col=q.from[0].collectionId,by=q.orderBy&&q.orderBy[0];
   let rows=[...docs.entries()].filter(([k])=>k.split('/').length===2&&k.startsWith(col+'/')).map(([k,f])=>({document:{name:'projects/p/databases/(default)/documents/'+k,fields:f}}));
   if(by)rows.sort((a,b)=>{const x=R.decodeValue(a.document.fields[by.field.fieldPath]),y=R.decodeValue(b.document.fields[by.field.fieldPath]);return (by.direction==='DESCENDING'?-1:1)*(x<y?-1:x>y?1:0);});
   return reply(200,rows.slice(0,q.limit));
  }
  const key=rel.replace(/^\//,'');
  if(key.startsWith('players/')&&token!==goodToken)return reply(token?403:401,{error:{code:token?403:401,message:token?'Missing or insufficient permissions.':'Request had invalid authentication credentials.'}});
  if(method==='GET'){
   if(!docs.has(key))return reply(404,{error:{code:404,message:'Document not found'}});
   const only=u.searchParams.getAll('mask.fieldPaths');let fields=docs.get(key);
   if(only.length){const cut={};for(const k of only)if(k in fields)cut[k]=fields[k];fields=cut;}
   return reply(200,{name:key,fields,updateTime:'2026-09-21T20:00:00Z'});
  }
  if(method==='PATCH'){
   const incoming=JSON.parse(opt.body).fields||{},masks=u.searchParams.getAll('updateMask.fieldPaths');
   if(!masks.length){docs.set(key,incoming);return reply(200,{name:key,fields:incoming});}
   const fields=JSON.parse(JSON.stringify(docs.get(key)||{}));
   for(const m of masks){let segs=parseMaskPath(m);if(maskBug&&segs.length===2&&segs[0]==='chars')segs=['chars'];setAt(fields,segs,getAt(incoming,segs));}
   docs.set(key,fields);return reply(200,{name:key,fields});
  }
  return reply(405,{error:{code:405,message:'no'}});
 }
 return {fetch,docs,calls,read:key=>docs.has(key)?R.decodeFields(docs.get(key)):null,write:(key,data)=>docs.set(key,R.encodeFields(data))};
}
module.exports={fakeFirestore};
