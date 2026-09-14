/* Run with Electron. Real DOM + production UI/core, isolated fixture and no game saves. */
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/.tides-breeding-ui-qa'),runId=Date.now()+'-'+process.pid;
fs.mkdirSync(out,{recursive:true});const profile=path.join(out,'profiles',runId);fs.mkdirSync(profile,{recursive:true});
app.setPath('userData',profile);app.setPath('sessionData',profile);app.disableHardwareAcceleration();app.commandLine.appendSwitch('force-device-scale-factor','1');
const report={runId,checks:[],errors:[],captures:[],profile},base=pathToFileURL(root+path.sep).href;
const fixture=`<!doctype html><html><head><meta charset="utf-8"><base href="${base}"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="assets/tides/ui.css"><style>body{display:block;margin:0;background:#192315;font-family:var(--body,sans-serif)}#fixture{position:relative;height:100vh;width:100vw;overflow:hidden}.panel{position:absolute!important;inset:0!important;display:none!important;width:auto!important;max-width:700px!important;margin:auto;padding:18px!important;overflow:auto!important;background:#2d2015!important}.panel.open{display:block!important}.tide-modal{background:#182115}#tideHub .tide-hub-box{background:#2b2117;border:1px solid #8a7146;border-radius:14px;color:var(--parch)}.tide-hub-box h2{font:28px var(--display);color:#eddbb3;margin:0}.tide-hub-box p{margin:5px 0}button{font:inherit}#hero{display:none}</style></head><body><main id="fixture"><div id="tideStorageEntry"></div><section id="p-hero" class="panel open"></section><section id="p-tides" class="panel"><header class="tide-storage-top"><button class="sbtn" id="tideStorageBack">← Back</button><h2 class="ptitle">Tide storage</h2></header><p id="tideStorageIntro"></p><div id="tideStorageTools"></div><div id="tideStorageBody"></div></section><div id="tideHub" class="tide-modal" hidden><div class="tide-hub-box"><h2 id="tideHubTitle"></h2><p id="tideHubIntro"></p><div id="tideHubTools"></div><div id="tideHubBody"></div><p id="tideHubMessage"></p><button class="sbtn" id="tideHubClose">Close</button></div></div></main><script src="assets/tides/catalog.js"></script><script src="assets/tides/art-layout.js"></script><script src="assets/tides/motion.js"></script><script src="assets/tides/hybrids.js"></script><script src="assets/tides/breeding.js"></script><script src="assets/tides/core.js"></script><script>
let S={tides:Tides.createCollection()},gameOn=true,gamePaused=false,hero=null,keys={},holdMove=null;const sfx={click(){},loot(){}};let qaSaves=0;function save(){qaSaves++}function saveNow(){qaSaves++}function stopMining(){}function toggleSide(){}function isDesktopLayout(){return true}function zoneOf(){return {farm:true}}function openTab(id){document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('open',p.id==='p-'+id));if(id==='tides')TideUI.renderStoragePage()}
window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message||'Resource '+e.target?.src));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.qaNow=Date.now();Date.now=()=>qaNow;
Tides.purchaseLasso(S.tides,10000,{rng:()=>0});const seed=JSON.parse(JSON.stringify(S.tides.pets[0]));S.tides.pets=Tides.catalog.map((s,i)=>({...seed,speciesId:s.id,id:'tide-'+(i+1),level:20}));S.tides.pets.push({...seed,id:'tide-26',speciesId:'meadowmouse'});S.tides.nextId=27;S.tides.equippedId='tide-1';
</script><script src="assets/tides/ui.js"></script></body></html>`;
const fixturePath=path.join(out,'fixture.html');fs.writeFileSync(fixturePath,fixture);
let win,finished=false;const deadline=setTimeout(()=>finish(Error('UI QA timed out')),120000);deadline.unref();
function finish(error){if(finished)return;finished=true;clearTimeout(deadline);if(error)report.fatal=error.stack||String(error);report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length};report.status=error||report.errors.length||report.summary.failed?'failed':'complete';fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify({status:report.status,summary:report.summary,fatal:report.fatal})+'\n');app.exit(report.status==='complete'?0:1)}
process.on('uncaughtException',finish);process.on('unhandledRejection',finish);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(fn,...args){return win.webContents.executeJavaScript('('+fn.toString()+')(...'+JSON.stringify(args)+')',true)}
function check(name,value){report.checks.push({name,pass:!!value})}
async function click(selector){await evaluate(s=>{const b=document.querySelector(s);if(!b)throw Error('Missing control '+s);if(b.disabled)throw Error('Disabled control '+s);b.click()},selector)}
async function capture(name){await evaluate(async()=>{await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));TideUI.paintIcons();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});win.webContents.invalidate();await wait(250);const file=path.join(out,name+'.png');fs.writeFileSync(file,(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());report.captures.push(file)}
app.whenReady().then(async()=>{
 const ses=session.fromPartition('breeding-ui-'+runId);ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_d,cb)=>cb({cancel:true}));
 win=new BrowserWindow({show:false,width:1100,height:1000,useContentSize:true,webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,offscreen:true,backgroundThrottling:false,spellcheck:false}});win.webContents.setFrameRate(30);
 win.webContents.on('render-process-gone',(_e,d)=>finish(Error('Renderer '+d.reason)));
 await win.loadFile(fixturePath);
 check('25 wild plus 300 hybrid species loaded',await evaluate(()=>Tides.catalog.length===25&&Tides.allSpecies().length===325));
 check('access callback rejects opening an unreachable station',await evaluate(()=>!TideUI.openBreeding('house',{canInteract:()=>false})&&document.getElementById('tideHub').hidden));
 await evaluate(()=>{window.qaAccess=true;TideUI.openBreeding('house',{canInteract:()=>qaAccess})});
 check('empty slots and disabled start',await evaluate(()=>document.querySelectorAll('[data-breeding-slot]').length===2&&document.getElementById('tideBreedStart').disabled));
 await capture('empty-parent-slots');
 await click('[data-breeding-slot="0"]');await click('[data-breeding-parent="tide-1"]');await click('[data-breeding-slot="1"]');
 check('second parent picker excludes every owned copy of first species',await evaluate(()=>![...document.querySelectorAll('[data-breeding-parent]')].some(b=>['tide-1','tide-26'].includes(b.dataset.breedingParent))));
 await click('[data-breeding-parent="tide-2"]');await click('#tideBreedStart');
 check('UI starts exactly60-second persisted incubation and hides result',await evaluate(()=>{const j=Tides.breedingStatus(S.tides,'house');return j.readyAt-j.startedAt===60000&&j.offspring===null&&!document.querySelector('#tideBreedReveal')&&document.querySelectorAll('.tide-mystery').length===1&&S.tides.pets.length===26&&qaSaves>0}));
 const initialJob=await evaluate(()=>Tides.breedingStatus(S.tides,'house').id);
 await click('#tideHubClose');await evaluate(()=>{qaNow+=59000;TideUI.openBreeding('house',{canInteract:()=>qaAccess})});
 check('close and reopen preserves same incubation and no early reveal',await evaluate(id=>Tides.breedingStatus(S.tides,'house').id===id&&document.getElementById('tideBreedCountdown').textContent==='0:01'&&!document.getElementById('tideBreedReveal'),initialJob));
 await capture('incubation');
 await evaluate(()=>qaNow+=1000);await wait(320);check('wall-clock completion enables explicit Reveal',await evaluate(()=>!!document.getElementById('tideBreedReveal')&&!document.getElementById('tideBreedReveal').disabled&&S.tides.pets.length===26));
 await click('#tideBreedReveal');check('reveal starts modest flash while storage is unchanged',await evaluate(()=>document.getElementById('tideIncubation').classList.contains('revealing')&&S.tides.pets.length===26));
 await evaluate(()=>document.getElementById('tideBreedReveal').click());await wait(500);
 check('repeated reveal clicks claim exactly one and clear incubation',await evaluate(()=>S.tides.pets.length===27&&!Tides.breedingStatus(S.tides,'house')&&document.querySelector('.tide-breeding-reward h3')));
 await capture('revealed-offspring');await click('#tideBreedStorage');
 check('reward opens offspring details with hybrid lineage and merged special',await evaluate(()=>{const p=S.tides.pets.at(-1),s=Tides.getSpecies(p.speciesId),text=document.getElementById('tideDetail').textContent;return text.includes(s.name)&&text.includes(Tides.getSpecies(s.parentA).name)&&text.includes(Tides.getSpecies(s.parentB).name)&&text.includes(Tides.getSkill(p).name)}));
 await click('#tideStorageBack');check('cards use separate nonnested buttons',await evaluate(()=>!document.querySelector('button button')&&document.querySelectorAll('article.tide-card').length===27));
 await click('[data-tide-favorite="tide-1"]');await evaluate(()=>{const f=document.getElementById('tideFilter');f.value='favorites';f.dispatchEvent(new Event('change'))});
 check('favorite toggle saves and filter returns only favorites',await evaluate(()=>S.tides.pets[0].favorite&&document.querySelectorAll('[data-tide-entry]').length===1&&document.querySelector('[data-tide-entry]').dataset.tideEntry==='tide-1'));
 await click('[data-tide-visible="tide-1"]');check('eye selects visible companion independently of battle equip',await evaluate(()=>{Tides.equip(S.tides,'tide-2');return TideUI.visibleCompanion().id==='tide-1'&&S.tides.equippedId==='tide-2'}));
 await click('[data-tide-visible="tide-1"]');check('eye toggles companion off without changing equipped',await evaluate(()=>!TideUI.visibleCompanion()&&S.tides.equippedId==='tide-2'));
 await evaluate(()=>{const p=S.tides.pets.at(-1);p.mutations={hp:2,attack:1,power:2,sixStar:true};const f=document.getElementById('tideFilter');f.value='6';f.dispatchEvent(new Event('change'))});
 check('six-star filter uses individual mutations',await evaluate(()=>document.querySelectorAll('[data-tide-entry]').length===1&&document.querySelector('.tide-stars.mutant').getAttribute('aria-label')==='6 stars, mutant'));
 await click('[data-tide-pet]');
 check('detail shows exact DNA stacks beside actual individual stats',await evaluate(()=>{const p=S.tides.pets.at(-1),s=Tides.stats(p),d=document.getElementById('tideDetail');return d.querySelector('[data-tide-hp]').textContent===String(s.maxHp)&&d.querySelector('[data-tide-atk]').textContent===String(s.atk)&&d.querySelector('[data-tide-power]').textContent==='110%'&&[...d.querySelectorAll('.tide-dna')].map(x=>x.textContent).join(',')==='+2,+1,+2'&&!!d.querySelector('.tide-stars.mutant')}));
 await capture('mutant-detail-desktop');win.setContentSize(390,844);await wait(150);await capture('mutant-detail-mobile');
 check('mobile detail fits without horizontal overflow',await evaluate(()=>{const p=document.getElementById('p-tides');return p.scrollWidth<=p.clientWidth+1&&[...p.querySelectorAll('.tide-stat-grid>div')].every(x=>x.getBoundingClientRect().right<=390)}));
 await evaluate(()=>{TideUI.closeHub();TideUI.openBreeding('house',{canInteract:()=>qaAccess})});await capture('breeding-mobile');
 check('mobile parent slots fit without horizontal overflow',await evaluate(()=>{const b=document.getElementById('tideHubBody');return b.scrollWidth<=b.clientWidth+1}));
 await evaluate(()=>qaAccess=false);await wait(350);check('station access is revalidated while open',await evaluate(()=>document.getElementById('tideHub').hidden));
 // Simulate saving after Reveal but before its visual timer completed, then reload collection.
 await evaluate(()=>{qaAccess=true;const j=Tides.startBreeding(S.tides,{stationId:'recover',parentAId:'tide-1',parentBId:'tide-2',now:qaNow-60000,rng:()=>.5});Tides.revealBreeding(S.tides,'recover',{now:qaNow,jobId:j.job.id});S.tides=Tides.normalizeCollection(JSON.parse(JSON.stringify(S.tides)),{now:qaNow});TideUI.openBreeding('recover',{canInteract:()=>true})});
 check('reopening an already revealed saved job recovers offspring once',await evaluate(()=>S.tides.pets.length===28&&!Tides.breedingStatus(S.tides,'recover')));
 await evaluate(()=>{TideUI.closeHub();TideUI.openBreeding('recover',{canInteract:()=>true})});check('reopen after claim never duplicates offspring',await evaluate(()=>S.tides.pets.length===28));
 // Real atlas frames: refined sheet21, sheet22 and clipped overlapping source cells.
 const frameIds=await evaluate(()=>[Tides.getHybrid('pebbletoad','spectralpanther').id,Tides.getHybrid('cinderwolf','dawnphoenix').id,Tides.allSpecies().find(s=>s.art?.clipPathD).id]);
 await evaluate(ids=>ids.forEach(id=>TideUI.frameFor(id)),frameIds);await wait(1400);
 check('supplementary and clipped atlas cells produce isolated nonempty frames',await evaluate(ids=>ids.every(id=>{const f=TideUI.frameFor(id);return f&&f.w>0&&f.h>0&&f.image.width<=640&&f.image.height<=640}),frameIds));
 await evaluate(id=>{const p=S.tides.pets.at(-1);p.speciesId=id;Tides.setVisible(S.tides,p.id);window.followCanvas=document.createElement('canvas');followCanvas.width=160;followCanvas.height=160;followCanvas.style='position:absolute;top:0;left:0';document.getElementById('fixture').append(followCanvas);window.drawnFollower=TideUI.drawCompanion(followCanvas.getContext('2d'),80,100,{motion:.6,phase:1.4,time:4})},frameIds[1]);
 check('visible hybrid companion draws through shared atlas/motion renderer',await evaluate(()=>drawnFollower&&followCanvas.getContext('2d').getImageData(0,0,160,160).data.some((v,i)=>i%4===3&&v>0)));
 report.errors=await evaluate(()=>qaErrors);finish();
}).catch(finish);
