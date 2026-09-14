/* Standalone concept catalogue. Never imports or modifies game save data. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const here=__dirname,root=path.resolve(here,'../..'),catalog=require(path.join(root,'assets/tides/catalog.js')),art=require(path.join(root,'assets/tides/art-manifest.json'));
const read=file=>JSON.parse(fs.readFileSync(path.join(here,file),'utf8').replace(/^\uFEFF/,''));
const write=(file,value)=>fs.writeFileSync(path.join(here,file),JSON.stringify(value,null,2)+'\n');
const dimensions=file=>{const b=fs.readFileSync(file);assert.equal(b.subarray(1,4).toString(),'PNG');return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:crypto.createHash('sha256').update(b).digest('hex')};};
const design=[...(fs.existsSync(path.join(here,'design-a.json'))?read('design-a.json'):[]),...(fs.existsSync(path.join(here,'design-b.json'))?read('design-b.json'):[])];
const map=new Map(design.map(h=>[h.id,h])),showcase=read('showcase.json');for(const h of showcase)map.set(h.id,h);
const expected=[];for(let i=0;i<catalog.length;i++)for(let j=i+1;j<catalog.length;j++){const a=catalog[i],b=catalog[j],id=a.id+'--'+b.id;expected.push(map.get(id)||{id,parentA:a.id,parentB:b.id,name:a.name+' × '+b.name,descriptionSv:'Konceptbeskrivning förbereds.',promptEn:''});}
assert.equal(expected.length,300);assert.equal(new Set(expected.map(h=>h.id)).size,300);
const priority=new Set(showcase.map(h=>h.id)),hybrids=[...showcase,...expected.filter(h=>!priority.has(h.id))];
const species=catalog.map(s=>{const source=art.species[s.id],atlas=art.atlases[source.atlas],file='parents/'+path.basename(atlas.file),absolute=path.join(here,file);fs.copyFileSync(path.join(root,atlas.file),absolute);const d=dimensions(absolute);return {id:s.id,name:s.name,stars:s.stars,art:{file,...d,rect:source.sourceRect}};});
const base=fs.readFileSync(path.join(here,'prompt-template.txt'),'utf8'),sheets=[];const manifestFile=path.join(here,'manifest.json');const old=fs.existsSync(manifestFile)?read('manifest.json'):null;
const statuses=new Map((fs.existsSync(path.join(here,'jobs/status.json'))?read('jobs/status.json'):[]).map(j=>[j.index,j]));
const geometry=fs.existsSync(path.join(here,'source-rects.json'))?read('source-rects.json'):{sheets:[]};
const receipts=fs.readdirSync(path.join(here,'jobs')).filter(f=>f.startsWith('submit-')&&f.endsWith('.json')).map(f=>read('jobs/'+f)).sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt)),actualParams=new Map();
for(const receipt of receipts)for(const job of (receipt.response.structuredContent||receipt.response).jobs||[])if(job.job_id){const params=receipt.params||receipt.requests?.find(r=>r.index===job.index)?.params;if(params)actualParams.set(job.index,params);}
for(let n=0;n<20;n++){const id='sheet-'+String(n+1).padStart(2,'0'),file='sheets/'+id+'.png',absolute=path.join(here,file),existing=old?.sheets.find(s=>s.id===id),job=statuses.get(n+1),group=hybrids.slice(n*15,n*15+15);
 const sheet={id,index:n+1,file,columns:5,rows:3,width:4096,height:2720,status:'planned',jobId:job?.job_id||existing?.jobId||null,sourceUrl:job?.result_url||existing?.sourceUrl||null};
 if(fs.existsSync(absolute)){Object.assign(sheet,dimensions(absolute),{status:'completed'});}
 sheet.prompt=actualParams.get(n+1)?.prompt||base+'\n'+group.map((h,i)=>`CELL ${String(i+1).padStart(2,'0')} (row ${Math.floor(i/5)+1}, column ${i%5+1}): ${catalog.find(s=>s.id===h.parentA).name} + ${catalog.find(s=>s.id===h.parentB).name}. ${h.promptEn}`).join('\n');
 sheet.hybridIds=group.map(h=>h.id);
 const layout=geometry.sheets.find(s=>path.basename(s.file)===id+'.png');
 for(let cell=0;cell<group.length;cell++){const h=group[cell],bounds=layout?.creatures?.find(c=>c.index===cell);h.sheetId=id;h.cell=cell;h.status=sheet.status;if(bounds){h.rect=bounds.sourceRect;if(bounds.clipPathD)h.clipPathD=bounds.clipPathD;}}
 sheets.push(sheet);
}
const refinements=fs.existsSync(path.join(here,'refinements.json'))?read('refinements.json').sheets:[];
for(const batch of refinements){
 assert.ok(batch.index>20&&batch.index<=24);const columns=batch.columns||5,rows=batch.rows||3;assert.equal(batch.hybrids.length,columns*rows);
 const id='sheet-'+String(batch.index).padStart(2,'0'),file='sheets/'+id+'.png',absolute=path.join(here,file),job=statuses.get(batch.index),existing=old?.sheets.find(s=>s.id===id);
 const sheet={id,index:batch.index,file,columns,rows,width:4096,height:2720,status:'planned',purpose:batch.purpose,jobId:job?.job_id||existing?.jobId||null,sourceUrl:job?.result_url||existing?.sourceUrl||null,prompt:actualParams.get(batch.index)?.prompt||'',hybridIds:batch.hybrids.map(h=>h.id)};
 if(fs.existsSync(absolute))Object.assign(sheet,dimensions(absolute),{status:'completed'});
 const layout=geometry.sheets.find(s=>path.basename(s.file)===id+'.png');
 batch.hybrids.forEach((revision,cell)=>{
  const h=hybrids.find(h=>h.id===revision.id);assert.ok(h,'Unknown refinement '+revision.id);
  if(sheet.status!=='completed')return;
  h.originalArt={sheetId:h.sheetId,cell:h.cell,rect:h.rect,clipPathD:h.clipPathD};
  h.sheetId=id;h.cell=cell;h.status=sheet.status;h.promptEn=revision.promptEn;h.descriptionSv=revision.descriptionSv;
  delete h.rect;delete h.clipPathD;
  const bounds=layout?.creatures?.find(c=>c.index===cell);if(bounds){h.rect=bounds.sourceRect;if(bounds.clipPathD)h.clipPathD=bounds.clipPathD;}
 });
 sheets.push(sheet);
}
const data={title:'Tide breeding',scope:'preview-only',createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),combinationRule:'25 choose 2 = 300 unordered different-species pairs; no self-crosses',generator:'Higgsfield',model:'gpt_image_2_5',quality:'high',resolution:'4k',referenceJobs:Object.values(art.atlases).map(a=>a.jobId),species,hybrids,sheets};
write('manifest.json',data);const {referenceJobs,...display}=data;display.sheets=sheets.map(({prompt,...s})=>s);display.hybrids=hybrids.map(({promptEn,...h})=>h);fs.writeFileSync(path.join(here,'data.js'),'window.TIDE_BREEDING_DATA='+JSON.stringify(display)+';\n');
console.log(JSON.stringify({hybrids:hybrids.length,designed:hybrids.filter(h=>h.promptEn).length,completed:hybrids.filter(h=>h.status==='completed').length,sheets:sheets.length,missingDesigns:hybrids.filter(h=>!h.promptEn).map(h=>h.id)}));
if(process.argv.includes('--final')){assert.ok(hybrids.every(h=>h.promptEn&&h.rect),'Missing concept designs or sprite bounds');assert.ok(sheets.every(s=>s.status==='completed'&&s.jobId&&s.sourceUrl&&s.prompt),'Missing generated sheets or receipts');assert.ok(geometry.sheets.every(s=>!s.needsReview),'Unresolved sprite bounds');}
