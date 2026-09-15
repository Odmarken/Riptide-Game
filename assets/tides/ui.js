/* Tides presentation and game integration. Rules and exploration remain independently testable. */
const TideUI=(()=>{
 const frames=new Map(),sheets=new Map();let frameBytes=0;
 let session=null,hubMode='',wildChoice=null,storageLimit=48,clockTick=0,motionClock=0;
 let storagePetId=null,storageOwner=null,storageReturnTab='hero',storageReturnScroll=0,storageScroll=0,storageReturnHub=null;
 let breedingStation=null,breedingOwner=null,breedingAccess=null,breedingParents=[null,null],breedingPicker=null,breedingReward=null,breedingTimer=null,breedingRevealing=null,breedingPhase='';
 let trainingOwner=null,trainingPicker=null;
 const el=id=>document.getElementById(id),html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const species=id=>Tides.getSpecies(id),owned=()=>Tides.equipped(S.tides),outdoors=()=>!!(S&&zoneOf().wasteland&&!zoneOf().dungeon);
 const stars=(s,p=null)=>{const n=p?(p.stars||Tides.stats(p)?.stars||s.stars):s.stars;return `<span class="tide-stars${s.spectral?' spectral':''}${n===6?' mutant':''}" aria-label="${n} stars${n===6?', mutant':''}">${'★'.repeat(n)}${n===6?' · Mutant':s.spectral?' · Spectral':''}</span>`;};
 const petSkill=p=>Tides.getSkill?.(p)||species(p.speciesId||p)?.skill;
 const mutation=p=>Tides.mutationSummary?.(p)||{hp:0,attack:0,power:0,sixStar:false,count:0};
 const dna=(n,label)=>n>0?`<span class="tide-dna" title="${html(label)} mutation: +${n}" aria-label="${html(label)} mutation plus ${n}"><svg viewBox="0 0 18 22" aria-hidden="true"><path d="M3 1c0 9 12 11 12 20M15 1c0 9-12 11-12 20M4 4h10M6 8h6M6 14h6M4 18h10"/></svg>+${n}</span>`:'';
 const parentNames=s=>s.parentA&&s.parentB?[species(s.parentA)?.name,species(s.parentB)?.name].filter(Boolean).join(' × '):'';
 const eyeIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
 const icon=s=>`<canvas class="tide-sprite" width="320" height="280" data-tide-art="${s.id}" role="img" aria-label="${html(s.name)}"></canvas>`;
 const remaining=p=>Tides.remainingInjury(p);
 function restText(p){if(!p)return '';if(Tides.isTraining?.(S.tides,p.id))return 'Training · Sunscar Sands';if(Tides.isBreedingParent?.(S.tides,p.id))return 'Breeding';const secs=Math.ceil(remaining(p)/1000);return secs?'Resting · '+Math.floor(secs/3600)+':'+String(Math.floor(secs/60)%60).padStart(2,'0')+':'+String(secs%60).padStart(2,'0'):'Ready';}
 function imageFor(s){
  const file=s.art?.file||s.sheet;
  if(!file)return null;
  if(!sheets.has(file)){const im=new Image();im.onload=()=>paintIcons();im.src=file;sheets.set(file,im);}
  return sheets.get(file);
 }
 function frameFor(id){
  if(frames.has(id)){const f=frames.get(id);frames.delete(id);frames.set(id,f);return f;}
  const s=species(id);if(!s)return null;const im=imageFor(s);if(!im?.complete||!im.naturalWidth)return null;
  const layout=s.art||(typeof TideArtLayout==='object'?TideArtLayout[id]:null);
  const cw=im.naturalWidth/3,ch=im.naturalHeight/2;
  const rect=layout?.rect||layout?.sourceRect||[Math.floor(s.cell%3*cw),Math.floor(Math.floor(s.cell/3)*ch),Math.floor(cw),Math.floor(ch)];
  const scale=Math.min(1,640/Math.max(rect[2],rect[3])),c=document.createElement('canvas');c.width=Math.ceil(rect[2]*scale);c.height=Math.ceil(rect[3]*scale);const g=c.getContext('2d',{willReadFrequently:true});
  g.save();g.setTransform(scale,0,0,scale,-rect[0]*scale,-rect[1]*scale);if(layout?.clipPathD)g.clip(new Path2D(layout.clipPathD),'evenodd');g.drawImage(im,0,0);g.restore();
  const data=g.getImageData(0,0,c.width,c.height).data;let left=c.width,right=-1,top=c.height,bottom=-1;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>=64){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)return null;const f={image:c,x:Math.max(0,left-3),y:Math.max(0,top-3),w:Math.min(c.width,right+4)-Math.max(0,left-3),h:Math.min(c.height,bottom+4)-Math.max(0,top-3)};
  f.bytes=c.width*c.height*4;frames.set(id,f);frameBytes+=f.bytes;
  while(frameBytes>48*1024*1024&&frames.size>1){const key=frames.keys().next().value;frameBytes-=frames.get(key).bytes;frames.delete(key);}return f;
 }
 function paintIcons(){
  document.querySelectorAll('[data-tide-art]').forEach(c=>{const f=frameFor(c.dataset.tideArt);if(!f)return;const g=c.getContext('2d'),k=Math.min((c.width-12)/f.w,(c.height-12)/f.h);g.clearRect(0,0,c.width,c.height);g.drawImage(f.image,f.x,f.y,f.w,f.h,(c.width-f.w*k)/2,(c.height-f.h*k)/2,f.w*k,f.h*k);});
 }
 function drawAnimal(g,id,x,y,height,fx=1,motion=0,phase=0,alpha=1,time=motionClock,alive=true,stride=1){
  const f=frameFor(id);if(!f)return false;
  TideMotion.draw(g,f,id,x,y,height,fx,motion,phase,alpha,time,alive,stride);return true;
 }
 function animalVisual(id,base=36){
  const s=species(id),f=frameFor(id),bounds=s?.art?.rect||(typeof TideArtLayout==='object'?TideArtLayout[id]?.bounds:null);
  const height=base*(s?.visualScale||1),aspect=f?f.w/f.h:bounds?bounds[2]/bounds[3]:1;
  return {height,width:height*aspect};
 }
 function wildBounds(w){
  const size=animalVisual(w.speciesId),half=Math.max(26,size.width*.55+6),top=w.y+6-Math.max(52,size.height*1.08+8);
  return {...size,left:w.x-half,right:w.x+half,top,bottom:w.y+16};
 }
 function battleLayout(w,h,playerId,foeId,hudBottom=0,controlsTop=h,heroFrame=null,options={}){
  const top=Math.max(Math.min(130,h*.18),hudBottom+12),bottom=Math.max(top+1,controlsTop-12);
  // Reserve the whole hero, including the hovering Ring, tall weapons and boots.
  const guild=!!options.guild,foeFrame=options.trainerFrame;
  const heroAbove=Math.max(64,-(heroFrame?.headY??-42)+22,guild?-(foeFrame?.headY??-42)+22:0),heroBelow=Math.max(14,(heroFrame?.groundY??14)+3,guild?(foeFrame?.groundY??14)+3:0);
  const heroX=w*(guild?.09:.105),heroScale=Math.min(guild?Math.min(3.4,w*.15/64,h*.28/58):w<650?Math.min(2.6,w*.27/58):Math.min(4.2,h*.3/58,w*.2/58),(bottom-top)/(heroAbove+heroBelow));
  const floor=Math.min(Math.max(h*(guild?.65:h<600?.54:.58),top+5+heroAbove*heroScale),bottom+5-heroBelow*heroScale);
  const foeHeroX=w-heroX,foeHeroLeft=foeHeroX-heroScale*32;
  const start=Math.max(w*.22,heroX+heroScale*32+12),end=guild?Math.min(w*.78,foeHeroLeft-12):w-Math.max(12,w*.025),gap=Math.max(14,w*(guild?.06:.1));
  const p=animalVisual(playerId,w<650?85:135),f=animalVisual(foeId,w<650?85:135);
  const fit=Math.min(1,Math.max(1,end-start-gap)/((p.width+f.width)*1.1),Math.max(1,floor-top)/(Math.max(p.height,f.height)*1.08));
  for(const size of [p,f]){size.height*=fit;size.width*=fit;}
  const extra=Math.max(0,end-start-p.width*1.1-f.width*1.1-gap);
  const left=start+p.width*.55+extra*.2,right=end-f.width*.55-extra*.2;
  return {floor,left,right,player:p,foe:f,heroX,heroScale,foeHeroX,foeHeroLeft,heroRight:heroX+heroScale*32,heroTop:floor-5-heroAbove*heroScale,heroBottom:floor-5+heroBelow*heroScale,travel:Math.max(0,right-left-(p.width+f.width)*.42-8)};
 }
 function stopHero(){
  if(!hero)return;hero.moveTo=null;hero.pendingDoor=null;hero.target=null;hero.goPortal=false;hero.moving=false;hero.dance=0;holdMove=null;stopMining();
  for(const k in keys)keys[k]=false;
 }
 function openHub(mode,title,intro=''){
  if(!gameOn||session)return false;if(breedingTimer!==null)clearInterval(breedingTimer);breedingTimer=null;stopHero();hubMode=mode;el('tideHub').hidden=false;el('tideHubTitle').textContent=title;el('tideHubIntro').textContent=intro;el('tideHubTools').innerHTML='';el('tideHubBody').innerHTML='';el('tideHubBody').scrollTop=0;el('tideHubMessage').textContent='';el('tideHubClose').onclick=closeHub;return true;
 }
 function closeHub(){if(breedingTimer!==null)clearInterval(breedingTimer);breedingTimer=null;el('tideHub').hidden=true;hubMode='';wildChoice=null;el('tideHubBody').onscroll=null;}
 function modalOpen(){return !!session||!el('tideHub')?.hidden;}
 function church(){return world?.solids.find(s=>s.type==='cathedral');}
 function churchInReach(){const c=church();return !!(gameOn&&S&&hero&&!hero.dead&&zoneOf().city&&c&&Math.hypot(hero.x-c.x,hero.y-c.y)<210);}
 function openChurch(){
  if(!churchInReach()||!openHub('church','The Tidekeeper','City Church · Begin your bond with the wild'))return;
  const bought=S.tides.lassoOwned;
  el('tideHubBody').innerHTML=`<div class="tide-shop"><img class="tide-lasso" src="assets/tides/lasso.png" alt="Coiled taming lasso"><h3>Tidekeeper's Lasso</h3><p>A lasting bond begins with a simple loop of rope. This reusable lasso lets you challenge neutral Tides throughout Wasteland.</p><p>Includes one random <b>one-star, level 1 companion</b>. Win a Tide battle to welcome its wild opponent into your Tide storage.</p><button class="sbtn gold" id="tideBuy" ${bought?'disabled':''}>${bought?'Bought':'Buy · 10,000 gold'}</button>${bought?'<button class="sbtn" id="tideChurchStorage">Open Tide storage</button>':''}<p>${totalGold().toLocaleString()} gold available</p></div>`;
  el('tideBuy').onclick=()=>{
   if(!churchInReach()||hubMode!=='church')return;
   const result=Tides.purchaseLasso(S.tides,totalGold());
   if(!result.ok){el('tideHubMessage').textContent=result.reason==='gold'?'You need 10,000 gold.':'You already own the lasso.';return;}
   spendGold(Tides.LASSO_PRICE||10000);S.tides.exploration=TideExploration.create(S.tides.exploration);saveNow();renderHUD();renderHero();renderBag();sfx.buy();openChurch();
   el('tideHubMessage').textContent=species(result.starter.speciesId).name+' is your first Tide. Your lasso is in the Bag.';
  };
  if(el('tideChurchStorage'))el('tideChurchStorage').onclick=openStorage;
 }
 function entry(){
  const host=el('tideStorageEntry');if(!host||!S)return;
  if(!S.tides?.lassoOwned){host.innerHTML='';return;}
  host.innerHTML='<button class="card tide-entry" id="tideStorageButton"><img class="tide-entry-icon" src="assets/tides/lasso.png" alt="" aria-hidden="true" draggable="false"><span>Tide storage</span></button>';
  el('tideStorageButton').onclick=openStorage;
 }
 function bagItem(){return S.tides?.lassoOwned?`<div class="card item"><div><div class="sn" style="font-size:13px;font-weight:600"><img src="assets/tides/lasso.png" class="shopico" alt=""> Tidekeeper's Lasso</div><div class="ss" style="font-size:11px;color:var(--dim)">Reusable. Challenge wild Tides in Wasteland and win to tame them. Cannot be sold or discarded.</div></div><div class="btns"><button class="sbtn" id="tideBagStorage">Tide storage</button></div></div>`:'';}
 function bindBag(){if(el('tideBagStorage'))el('tideBagStorage').onclick=openStorage;}
 const breedingErrors={training:'This Tide is at the training grounds. Collect it first.',battle:'Finish your Tide battle first.',busy:'This house is already breeding a Tide.',same:'Choose two different companions.',unowned:'That companion is no longer in storage.','hybrid-parent':'Choose one of the original Tide species.','same-species':'Choose two different species.',injured:'This companion is recovering.','parent-busy':'This companion is already breeding.','unknown-hybrid':'This pairing is unavailable.',missing:'There is no incubation in this house.',early:'Your Tide needs a little more time.',unrevealed:'Reveal your Tide first.',settled:'This Tide has already joined your storage.'};
 function breedingMessage(reason){el('tideHubMessage').textContent=breedingErrors[reason]||'Return to the breeding house to continue.';}
 function breedingAllowed(){return hubMode==='breeding'&&gameOn&&!session&&S?.tides===breedingOwner&&(!breedingAccess||breedingAccess());}
 function openBreeding(stationId,options={}){
  if(!S?.tides||!stationId||options.canInteract&&!options.canInteract())return false;
  if(!openHub('breeding','Tide Breeding','Pair two different original species and discover a new Tide.'))return false;
  if(breedingOwner!==S.tides||breedingStation!==stationId){breedingParents=[null,null];breedingReward=null;}
  breedingStation=stationId;breedingOwner=S.tides;breedingAccess=typeof options.canInteract==='function'?options.canInteract:null;breedingPicker=null;
  const job=Tides.breedingStatus(breedingOwner,breedingStation,Date.now());
  // A revealed job survives reloads. Claiming it is safe to retry and never duplicates the pet.
  if(job?.revealed)finishBreedingReveal(breedingOwner,breedingStation,job.id);
  renderBreeding();breedingTimer=setInterval(refreshBreeding,250);return true;
 }
 function breedingSlot(p,index,locked){return `<button class="tide-parent-slot${p?' filled':''}" data-breeding-slot="${index}" ${locked?'disabled':''} aria-label="${p?'Change':'Choose'} parent ${index===0?'A':'B'}${p?': '+html(species(p.speciesId).name):''}"><span class="tide-parent-label">Parent ${index===0?'A':'B'}</span>${p?icon(species(p.speciesId))+'<b>'+html(species(p.speciesId).name)+'</b>'+stars(species(p.speciesId),p)+'<small>Level '+p.level+'</small>':'<span class="tide-parent-plus" aria-hidden="true">+</span><b>Choose a Tide</b><small>From your storage</small>'}</button>`;}
 function renderBreeding(){
  if(hubMode!=='breeding'||S?.tides!==breedingOwner)return;
  if(breedingPicker!==null){renderBreedingPicker();return;}
  const job=Tides.breedingStatus(breedingOwner,breedingStation,Date.now());breedingPhase=job?.phase||'empty';
  if(job)breedingParents=[job.parentAId,job.parentBId];
  const parents=breedingParents.map(id=>breedingOwner.pets.find(p=>p.id===id)),body=el('tideHubBody');
  el('tideHubTools').innerHTML='';
  body.innerHTML=`<div class="tide-breeding"><div class="tide-parent-pair">${breedingSlot(parents[0],0,!!job)}<span class="tide-pair-mark" aria-hidden="true">×</span>${breedingSlot(parents[1],1,!!job)}</div><p class="tide-breeding-note">Both parents stay in your storage. They cannot battle or breed again until the new Tide is revealed.</p>${job?'':`<button class="sbtn gold tide-breed-start" id="tideBreedStart" ${parents.every(Boolean)?'':'disabled'}>Begin breeding · 1 minute</button>`}<div class="tide-incubation${breedingRevealing===job?.id?' revealing':''}" id="tideIncubation">${job?`<div class="tide-mystery" aria-label="Unrevealed Tide">?</div><h3>${job.ready?'Your Tide is ready':'A new bond is growing'}</h3><p id="tideBreedCountdown" role="timer"></p><div class="tide-incubation-progress"><i id="tideBreedProgress"></i></div>${job.ready?'<button class="sbtn gold" id="tideBreedReveal" '+(breedingRevealing===job.id?'disabled':'')+'>Reveal Tide</button>':'<p class="cl">You can keep playing and return when it is ready.</p>'}`:breedingReward?breedingRewardMarkup(breedingReward):'<div class="tide-mystery sleeping" aria-hidden="true">?</div><p class="cl">Your new Tide will appear here.</p>'}</div></div>`;
  body.querySelectorAll('[data-breeding-slot]').forEach(b=>b.onclick=()=>{if(!breedingAllowed()){breedingMessage('station');return;}breedingPicker=Number(b.dataset.breedingSlot);renderBreedingPicker();});
  if(el('tideBreedStart'))el('tideBreedStart').onclick=()=>{
   if(!breedingAllowed()){breedingMessage('station');return;}
   const result=Tides.startBreeding(breedingOwner,{stationId:breedingStation,parentAId:breedingParents[0],parentBId:breedingParents[1],now:Date.now()});
   if(!result.ok){breedingMessage(result.reason);return;}breedingReward=null;saveNow();el('tideHubMessage').textContent='';renderBreeding();sfx.click?.();
  };
  if(el('tideBreedReveal'))el('tideBreedReveal').onclick=()=>revealBreeding(job.id);
  if(el('tideBreedStorage'))el('tideBreedStorage').onclick=()=>{const id=breedingReward.id;openStorage();openPet(id);};
  refreshBreeding(false);paintIcons();
 }
 function breedingRewardMarkup(p){const s=species(p.speciesId),m=mutation(p);return `<div class="tide-breeding-reward">${icon(s)}<h3>${html(s.name)}</h3>${stars(s,p)}<p class="tide-lineage">${html(parentNames(s))}</p><p class="tide-reward-mutations">${dna(m.hp,'Health')}${dna(m.attack,'Base attack')}${dna(m.power,'Special power')}${m.sixStar?'<span class="tide-mutant-note">Six-star mutation</span>':''}</p><p>Joined your Tide storage.</p><button class="sbtn" id="tideBreedStorage">View Tide</button></div>`;}
 function renderBreedingPicker(){
  if(hubMode!=='breeding'||breedingPicker===null)return;
  const chosen=breedingPicker,other=breedingOwner.pets.find(p=>p.id===breedingParents[1-chosen]);
  el('tideHubTools').innerHTML='<div class="tide-tools"><button class="sbtn" id="tideParentBack">← Back</button><input type="search" id="tideParentSearch" placeholder="Find a parent" aria-label="Find a breeding parent"></div>';
  el('tideParentBack').onclick=()=>{breedingPicker=null;renderBreeding();};
  let limit=48;
  function drawChoices(){
   const q=(el('tideParentSearch')?.value||'').trim().toLowerCase();
   const eligible=Tides.eligibleBreedingParents(breedingOwner,{now:Date.now(),stationId:breedingStation}).filter(p=>p.speciesId!==other?.speciesId&&species(p.speciesId).name.toLowerCase().includes(q));
   el('tideHubBody').innerHTML=`<p class="tide-breeding-note">Choose parent ${chosen===0?'A':'B'}. Original species only${other?' · Must differ from '+html(species(other.speciesId).name):''}.</p><div class="tide-grid tide-parent-picker">${eligible.slice(0,limit).map(p=>`<button class="tide-card" data-breeding-parent="${html(p.id)}">${icon(species(p.speciesId))}<b>${html(species(p.speciesId).name)}</b>${stars(species(p.speciesId),p)}<span class="cl">Level ${p.level}${p.favorite?' · ★ Favorite':''}</span></button>`).join('')}</div>${eligible.length?'':'<p class="cl">No eligible Tides. Choose a different species, or wait for a breeding parent to become available.</p>'}${eligible.length>limit?'<button class="sbtn tide-load-parents" id="tideMoreParents">Show more companions</button>':''}`;
   el('tideHubBody').querySelectorAll('[data-breeding-parent]').forEach(b=>b.onclick=()=>{if(!breedingAllowed()){breedingMessage('station');return;}const id=b.dataset.breedingParent;if(!Tides.eligibleBreedingParents(breedingOwner,{now:Date.now(),stationId:breedingStation}).some(p=>p.id===id))return;breedingParents[chosen]=id;breedingReward=null;breedingPicker=null;renderBreeding();});
   if(el('tideMoreParents'))el('tideMoreParents').onclick=()=>{limit+=48;drawChoices();};paintIcons();
  }
  el('tideParentSearch').oninput=()=>{limit=48;drawChoices();};drawChoices();
 }
 function refreshBreeding(allowRender=true){
  if(hubMode!=='breeding'||S?.tides!==breedingOwner)return;
  if(!breedingAllowed()){closeHub();return;}
  if(breedingPicker!==null)return;
  const job=Tides.breedingStatus(breedingOwner,breedingStation,Date.now());
  if(allowRender&&(job?.phase||'empty')!==breedingPhase){renderBreeding();return;}
  if(!job)return;
  const seconds=Math.ceil(job.remainingMs/1000),text=el('tideBreedCountdown'),progress=el('tideBreedProgress');
  if(text)text.textContent=job.ready?'Ready to reveal':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  if(progress)progress.style.width=Math.max(0,Math.min(100,100*(1-job.remainingMs/Math.max(1,job.readyAt-job.startedAt))))+'%';
 }
 function revealBreeding(jobId){
  if(!breedingAllowed()||breedingRevealing===jobId)return;
  const owner=breedingOwner,station=breedingStation,result=Tides.revealBreeding(owner,station,{now:Date.now(),jobId});
  if(!result.ok){breedingMessage(result.reason);return;}
  breedingRevealing=jobId;saveNow();renderBreeding();
  setTimeout(()=>finishBreedingReveal(owner,station,jobId),420);
 }
 function finishBreedingReveal(owner,station,jobId){
  if(S?.tides!==owner)return;
  const result=Tides.claimBreeding(owner,station,{now:Date.now(),jobId});
  if(breedingRevealing===jobId)breedingRevealing=null;
  if(!result.ok)return;
  saveNow();entry();refreshStorageValues();
  if(breedingOwner===owner&&breedingStation===station){breedingReward=result.pet;breedingParents=[null,null];if(hubMode==='breeding'){renderBreeding();sfx.loot?.();}}
 }
 function trainingAllowed(){return !!(gameOn&&!session&&S?.tides&&hero&&!hero.dead&&typeof trainingInReach==='function'&&trainingInReach());}
 function trainingError(reason){return {lasso:'Buy a Tidekeeper\'s Lasso at the City church first.',battle:'Finish your Tide battle first.',training:'This Tide is already training.',breeding:'This Tide is currently breeding.',injured:'This Tide is recovering.',maximum:'This Tide is already at maximum level.',full:'All three training places are occupied.',missing:'This Tide has already been collected.',unowned:'This Tide is no longer in storage.'}[reason]||'Return to the training grounds to continue.';}
 function openTraining(){
  if(!trainingAllowed()||!openHub('training','Tide Training Grounds','Leave up to three companions to train while you explore.'))return false;
  trainingOwner=S.tides;trainingPicker=null;
  if(Tides.updateTraining(trainingOwner).changed)saveNow();
  renderTraining();return true;
 }
 function renderTraining(){
  if(hubMode!=='training'||trainingOwner!==S?.tides)return;
  if(trainingPicker!==null){renderTrainingPicker();return;}
  el('tideHubTools').innerHTML='';
  const slots=Tides.trainingStatus(trainingOwner),rate=Tides.TRAINING_CONFIG.XP_PER_MINUTE;
  el('tideHubBody').innerHTML=`<div class="tide-training"><p class="tide-breeding-note"><b>${rate} XP per minute</b>, even while you are away. Training is slower than winning wild battles and stops at level ${Tides.MAX_LEVEL}. Collect a Tide whenever you wish.</p><div class="tide-training-slots">${slots.map(job=>job.empty?`<article class="tide-training-slot"><span class="tide-parent-label">Paddock ${job.slot+1}</span><div class="tide-training-empty" aria-hidden="true">+</div><b>A place to grow</b><button class="sbtn" data-training-slot="${job.slot}" ${trainingOwner.lassoOwned?'':'disabled'}>Choose a Tide</button></article>`:trainingCard(job)).join('')}</div><p class="tide-breeding-note">Your Tides stay in storage. While training, they cannot battle, breed or follow you. Depositing an equipped or visible Tide unequips and hides it until you collect it.</p>${trainingOwner.lassoOwned?'<button class="sbtn" id="tideTrainingStorage">Tide storage</button>':'<p class="cl">Buy a Tidekeeper\'s Lasso at the City church to begin.</p>'}</div>`;
  el('tideHubBody').querySelectorAll('[data-training-slot]').forEach(b=>b.onclick=()=>{if(!trainingAllowed()||trainingOwner!==S.tides)return;trainingPicker=Number(b.dataset.trainingSlot);renderTrainingPicker();});
  el('tideHubBody').querySelectorAll('[data-training-collect]').forEach(b=>b.onclick=()=>collectTrainingPet(b.dataset.trainingCollect));
  if(el('tideTrainingStorage'))el('tideTrainingStorage').onclick=openStorage;
  refreshTrainingValues();paintIcons();
 }
 function trainingCard(job){const p=job.pet,s=species(p.speciesId);return `<article class="tide-training-slot occupied" data-training-pet="${html(p.id)}"><span class="tide-parent-label">Paddock ${job.slot+1}</span>${icon(s)}<b>${html(s.name)}</b>${stars(s,p)}<span class="cl" data-training-level></span><div class="tide-xp"><i data-training-bar></i></div><span class="cl" data-training-xp></span><span class="tide-state" data-training-time></span><span class="cl" data-training-gained></span><button class="sbtn gold" data-training-collect="${html(p.id)}">Collect Tide</button></article>`;}
 function refreshTrainingValues(){
  if(hubMode!=='training'||trainingPicker!==null||trainingOwner!==S?.tides)return;
  for(const job of Tides.trainingStatus(trainingOwner)){
   if(job.empty)continue;
   const box=[...el('tideHubBody').querySelectorAll('[data-training-pet]')].find(n=>n.dataset.trainingPet===job.petId);if(!box)continue;
   const p=job.pet,next=Tides.xpToNext(p.level),minutes=Math.floor(job.elapsedMs/60000);
   box.querySelector('[data-training-level]').textContent='Level '+p.level+' / '+Tides.MAX_LEVEL;
   box.querySelector('[data-training-bar]').style.width=(next?Math.min(100,p.xp/next*100):100)+'%';
   box.querySelector('[data-training-xp]').textContent=next?p.xp+' / '+next+' XP':'Maximum level';
   box.querySelector('[data-training-time]').textContent=job.maxLevel?'Ready to collect':(minutes>=60?Math.floor(minutes/60)+'h ':'')+minutes%60+'m training';
   box.querySelector('[data-training-gained]').textContent='+'+job.totalXp.toLocaleString()+' XP earned';
  }
 }
 function renderTrainingPicker(){
  if(hubMode!=='training'||trainingPicker===null)return;
  el('tideHubTools').innerHTML='<div class="tide-tools"><button class="sbtn" id="tideTrainingBack">← Back</button><input type="search" id="tideTrainingSearch" placeholder="Find a Tide" aria-label="Find a Tide to train"></div>';
  el('tideTrainingBack').onclick=()=>{trainingPicker=null;renderTraining();};let limit=48;
  function drawChoices(){
   const query=(el('tideTrainingSearch')?.value||'').trim().toLowerCase(),choices=Tides.eligibleTrainingPets(trainingOwner).filter(p=>species(p.speciesId).name.toLowerCase().includes(query));
   el('tideHubBody').innerHTML=`<p class="tide-breeding-note">Choose a companion for paddock ${trainingPicker+1}. Equipped or visible Tides will stay here while they train.</p><div class="tide-grid tide-parent-picker">${choices.slice(0,limit).map(p=>`<button class="tide-card" data-training-deposit="${html(p.id)}">${icon(species(p.speciesId))}<b>${html(species(p.speciesId).name)}</b>${stars(species(p.speciesId),p)}<span class="cl">Level ${p.level}${p.id===trainingOwner.equippedId?' · Equipped':''}${p.id===trainingOwner.visibleId?' · Visible':''}</span></button>`).join('')}</div>${!choices.length?'<p class="cl">No Tides are available. Companions must be below level 30 and free from battles, breeding and other training places.</p>':''}${choices.length>limit?'<button class="sbtn tide-load-parents" id="tideMoreTraining">Show more companions</button>':''}`;
   el('tideHubBody').querySelectorAll('[data-training-deposit]').forEach(b=>b.onclick=()=>depositTrainingPet(b.dataset.trainingDeposit));
   if(el('tideMoreTraining'))el('tideMoreTraining').onclick=()=>{limit+=48;drawChoices();};paintIcons();
  }
  el('tideTrainingSearch').oninput=()=>{limit=48;drawChoices();};drawChoices();
 }
 function depositTrainingPet(id){
  if(!trainingAllowed()||hubMode!=='training'||trainingOwner!==S.tides||trainingPicker===null)return false;
  const result=Tides.startTraining(trainingOwner,id,{slot:trainingPicker});
  if(!result.ok){el('tideHubMessage').textContent=trainingError(result.reason);return false;}
  trainingPicker=null;saveNow();entry();refreshStorageValues();renderTraining();sfx.click?.();
  el('tideHubMessage').textContent=species(result.pet.speciesId).name+' is now training.'+(result.wasEquipped?' Unequipped for training.':'')+(result.wasVisible?' Your visible companion is resting here.':'');return true;
 }
 function collectTrainingPet(id){
  if(!trainingAllowed()||hubMode!=='training'||trainingOwner!==S.tides)return false;
  const result=Tides.collectTraining(trainingOwner,id);
  if(!result.ok){el('tideHubMessage').textContent=trainingError(result.reason);return false;}
  saveNow();entry();refreshStorageValues();renderTraining();sfx.click?.();el('tideHubMessage').textContent=species(result.pet.speciesId).name+' is ready in Tide storage. Training earned '+result.xp.toLocaleString()+' XP.';return true;
 }
 function tickTraining(){
  if(!gameOn||!S?.tides)return;
  if(Tides.updateTraining(S.tides).changed){saveNow();refreshStorageValues();}
  if(hubMode==='training'){if(trainingOwner!==S.tides||!trainingAllowed())closeHub();else refreshTrainingValues();}
 }
 function visibleCompanion(){return S?.tides?Tides.visible(S.tides):null;}
 function drawCompanion(g,x,y,options={}){
  const p=visibleCompanion();if(!p)return false;
  const height=options.height||animalVisual(p.speciesId).height;
  // Stronger footfalls stay readable at follower size; battle and wild strides keep their existing scale.
  return drawAnimal(g,p.speciesId,x,y,height,options.fx??1,options.motion??0,options.phase??0,options.alpha??1,options.time??motionClock,true,1.5);
 }
 function petCard(p){
  const s=species(p.speciesId),equipped=S.tides.equippedId===p.id;
  return `<article class="tide-card${equipped?' equipped':''}" data-tide-entry="${html(p.id)}"><button class="tide-card-main" data-tide-pet="${html(p.id)}" aria-label="View ${html(s.name)} stats">${icon(s)}<span class="tide-card-name">${html(s.name)}</span>${stars(s,p)}<span class="cl">Level <span data-tide-level>${p.level}</span></span><span class="tide-state" data-tide-state>${restText(p)}</span><span class="tide-equipped-badge" data-tide-equipped>${equipped?'Equipped':''}</span>${mutation(p).count?'<span class="tide-mutation-count">DNA · '+mutation(p).count+' mutation'+(mutation(p).count===1?'':'s')+'</span>':''}</button>${petToggles(p)}</article>`;
 }
 function petToggles(p){return `<div class="tide-pet-toggles"><button class="tide-toggle" data-tide-favorite="${html(p.id)}" aria-pressed="${!!p.favorite}" aria-label="${p.favorite?'Remove favorite':'Mark as favorite'}" title="Favorite">★</button><button class="tide-toggle" data-tide-visible="${html(p.id)}" aria-pressed="${S.tides.visibleId===p.id}" aria-label="${S.tides.visibleId===p.id?'Hide Tide companion':'Show Tide companion'}" title="${Tides.isTraining?.(S.tides,p.id)?'Collect this Tide from training first':'Visible companion'}" ${Tides.isTraining?.(S.tides,p.id)?'disabled':''}>${eyeIcon}</button></div>`;}
 function bindPetToggles(box){
  box.querySelectorAll('[data-tide-favorite]').forEach(b=>b.onclick=()=>{const r=Tides.toggleFavorite(S.tides,b.dataset.tideFavorite);if(!r.ok)return;save();if(storagePetId)renderPet();else renderStorage(false);sfx.click?.();});
  box.querySelectorAll('[data-tide-visible]').forEach(b=>b.onclick=()=>{const id=b.dataset.tideVisible,r=Tides.setVisible(S.tides,S.tides.visibleId===id?null:id);if(!r.ok)return;save();refreshStorageValues();sfx.click?.();});
 }
 function storageOpen(){return !!el('p-tides')?.classList.contains('open');}
 function filteredPets(){
  const query=(el('tideSearch')?.value||'').trim().toLowerCase(),filter=el('tideFilter')?.value||'all';
  // Collection order records when a Tide was received, including late-claimed hybrids.
  // Reverse a copy so sorting the view never changes saved order or equipped IDs.
  return S.tides.pets.slice().reverse().filter(p=>{const s=species(p.speciesId),n=Tides.stats(p)?.stars||s.stars;return (!query||(s.name+' '+parentNames(s)).toLowerCase().includes(query))&&(filter==='all'||filter==='favorites'&&p.favorite||filter==='ready'&&!remaining(p)&&!Tides.isTraining(S.tides,p.id)&&!Tides.isBreedingParent(S.tides,p.id)||filter==='training'&&Tides.isTraining(S.tides,p.id)||filter==='spectral'&&s.spectral||filter==='hybrids'&&!!s.parentA||filter==='mutations'&&mutation(p).count>0||String(n)===filter);});
 }
 function renderStorage(reset=true){
  if(!storageOpen()||storagePetId)return;
  if(reset)storageLimit=48;
  const box=el('p-tides'),scroll=box.scrollTop,filtered=filteredPets(),shown=filtered.slice(0,storageLimit);
  el('tideStorageTools').hidden=false;
  el('tideStorageBody').innerHTML=`<div class="tide-grid">${shown.map(petCard).join('')}</div>${!shown.length?'<p class="cl">No Tides match this search.</p>':''}${shown.length<filtered.length?'<p class="cl">Scroll to see more companions…</p>':''}`;
  el('tideStorageBody').querySelectorAll('[data-tide-pet]').forEach(b=>b.onclick=()=>openPet(b.dataset.tidePet));
  bindPetToggles(el('tideStorageBody'));
  box.scrollTop=reset?0:scroll;refreshStorageValues();paintIcons();
 }
 function updateStorageHeader(){
  const p=owned(),s=p&&species(p.speciesId);
  const originals=new Set(S.tides.pets.filter(p=>!species(p.speciesId)?.parentA).map(p=>p.speciesId)).size,hybrids=new Set(S.tides.pets.filter(p=>species(p.speciesId)?.parentA).map(p=>p.speciesId)).size;
  el('tideStorageIntro').textContent=`${S.tides.pets.length.toLocaleString()} companions · ${originals} / 25 original species${hybrids?' · '+hybrids+' hybrids':''}`;
  el('tideEquipped').textContent=s?`Equipped: ${s.name} · Level ${p.level} · ${restText(p)}`:'Select a Tide to view its stats and equip it.';
 }
 function openStorage(){
  if(!gameOn||!S?.tides?.lassoOwned||session)return;
  const current=document.querySelector('.panel.open');
  if(current?.id!=='p-tides'){
   storageReturnTab=current?.id.slice(2)||'battle';storageReturnScroll=current?.scrollTop||0;storagePetId=null;storageScroll=0;storageOwner=null;
  }
  storageReturnHub=hubMode==='wild'?{mode:'wild',id:wildChoice}:hubMode==='church'?{mode:'church'}:hubMode==='guild'?{mode:'guild'}:hubMode==='training'?{mode:'training'}:hubMode==='breeding'?{mode:'breeding',id:breedingStation,canInteract:breedingAccess}:null;
  closeHub();toggleSide(false);openTab('tides');
 }
 function renderStoragePage(){
  if(storageOwner!==S.tides){
   storageOwner=S.tides;storagePetId=null;storageLimit=48;storageScroll=0;
   el('tideStorageTools').innerHTML='<div class="tide-equipped-line" id="tideEquipped"></div><div class="tide-tools"><input id="tideSearch" type="search" placeholder="Find a Tide" aria-label="Find a Tide"><select id="tideFilter" aria-label="Filter Tides"><option value="all">All companions</option><option value="favorites">★ Favorites</option><option value="ready">Ready for battle</option><option value="training">Training</option><option value="hybrids">Hybrids</option><option value="mutations">DNA mutations</option><option value="1">★ Common</option><option value="2">★★ Uncommon</option><option value="3">★★★ Rare</option><option value="4">★★★★ Epic</option><option value="5">★★★★★ Legendary</option><option value="6">★★★★★★ Mutant</option><option value="spectral">Spectral</option></select></div>';
   el('tideSearch').oninput=()=>renderStorage();el('tideFilter').onchange=()=>renderStorage();
  }
  el('tideStorageBack').onclick=storageBack;
  el('p-tides').onscroll=()=>{const box=el('p-tides');if(!storagePetId&&storageLimit<filteredPets().length&&box.scrollTop+box.clientHeight>=box.scrollHeight-120){storageLimit+=48;renderStorage(false);}};
  if(storagePetId)renderPet();else renderStorage(false);updateStorageHeader();
 }
 function openPet(id){
  if(!storageOpen()||!S.tides.pets.some(p=>p.id===id))return;
  storageScroll=el('p-tides').scrollTop;storagePetId=id;renderPet();el('p-tides').scrollTop=0;
 }
 function renderPet(){
  const p=S.tides.pets.find(p=>p.id===storagePetId);if(!p){storagePetId=null;renderStorage();return;}
  const s=species(p.speciesId),m=mutation(p),skill=petSkill(p);
  el('tideStorageTools').hidden=true;
  el('tideStorageBody').innerHTML=`<div class="card tide-detail" id="tideDetail">${icon(s)}<h3>${html(s.name)}</h3>${stars(s,p)}${petToggles(p)}${parentNames(s)?'<p class="tide-lineage">'+html(parentNames(s))+'</p>':''}<p class="cl">${html(s.description)}</p><div class="tide-stat-grid"><div><span>Level</span><b data-tide-level></b></div><div><span>Health</span><b><em data-tide-hp></em>${dna(m.hp,'Health')}</b></div><div><span>Base attack</span><b><em data-tide-atk></em>${dna(m.attack,'Base attack')}</b></div><div><span>Special power</span><b><em data-tide-power></em>${dna(m.power,'Special power')}</b></div></div>${m.sixStar?'<p class="tide-mutant-note">Six-star mutation · Enhanced health and attack</p>':''}<div class="tide-xp"><i data-tide-xp-bar></i></div><div class="cl" data-tide-xp></div><div class="tide-state" data-tide-state></div><div class="tide-skills"><b>${html(s.attack.name)}</b><p>${html(s.attack.description)}</p><b>${html(skill.name)}</b><p>${html(skill.description)}</p></div><button class="sbtn" data-tide-equip="${html(p.id)}"></button><p class="cl">Equip a Tide for battles and XP. The eye chooses your visible companion independently.</p></div>`;
  el('tideDetail').querySelector('[data-tide-equip]').onclick=e=>{
   if(session||!storageOpen()||remaining(p))return;const result=Tides.equip(S.tides,p.id);if(!result.ok)return;
   save();entry();refreshStorageValues();sfx.click?.();e.currentTarget.blur();
  };
  bindPetToggles(el('tideDetail'));
  refreshStorageValues();paintIcons();
 }
 function refreshStorageValues(){
  if(!storageOpen()||!S?.tides?.lassoOwned)return;
  const fill=(box,p)=>{
   const st=Tides.stats(p),next=Tides.xpToNext(p.level),training=Tides.isTraining(S.tides,p.id),breeding=Tides.isBreedingParent(S.tides,p.id),ready=!remaining(p)&&!training&&!breeding,equipped=S.tides.equippedId===p.id;
   for(const [key,value]of Object.entries({level:p.level,hp:st.maxHp,atk:st.atk,power:Math.round((st.powerMultiplier||1)*100)+'%',xp:next?`${p.xp} / ${next} XP`:'Maximum level',state:restText(p),equipped:equipped?'Equipped':''}))box.querySelectorAll('[data-tide-'+key+']').forEach(n=>n.textContent=value);
   box.querySelectorAll('[data-tide-state]').forEach(n=>n.classList.toggle('resting',!ready));
   box.querySelectorAll('[data-tide-xp-bar]').forEach(n=>n.style.width=(next?Math.min(100,p.xp/next*100):100)+'%');
   const button=box.querySelector('[data-tide-equip]');if(button){button.disabled=equipped||!ready;button.textContent=training?'Training':breeding?'Breeding':equipped?'Equipped':ready?'Equip':'Recovering';}
   box.classList.toggle('equipped',equipped);
   box.querySelectorAll('[data-tide-favorite]').forEach(b=>{b.setAttribute('aria-pressed',String(!!p.favorite));b.setAttribute('aria-label',p.favorite?'Remove favorite':'Mark as favorite');});
   box.querySelectorAll('[data-tide-visible]').forEach(b=>{const visible=S.tides.visibleId===p.id;b.disabled=training;b.title=training?'Collect this Tide from training first':'Visible companion';b.setAttribute('aria-pressed',String(visible));b.setAttribute('aria-label',visible?'Hide Tide companion':'Show Tide companion');});
  };
  el('tideStorageBody').querySelectorAll('[data-tide-entry]').forEach(card=>{const p=S.tides.pets.find(p=>p.id===card.dataset.tideEntry);if(p)fill(card,p);});
  const p=S.tides.pets.find(p=>p.id===storagePetId);if(p&&el('tideDetail'))fill(el('tideDetail'),p);updateStorageHeader();
 }
 function storageBack(){
  if(!storageOpen())return;
  if(storagePetId){storagePetId=null;renderStorage(false);el('p-tides').scrollTop=storageScroll;return;}
  const back=storageReturnHub;storageReturnHub=null;openTab(storageReturnTab==='battle'&&isDesktopLayout()?'hero':storageReturnTab);
  const previous=el('p-'+storageReturnTab);if(previous)previous.scrollTop=storageReturnScroll;
  if(back?.mode==='wild')openWild(back.id);else if(back?.mode==='church')openChurch();else if(back?.mode==='guild')openGuild();else if(back?.mode==='training')openTraining();else if(back?.mode==='breeding')openBreeding(back.id,{canInteract:back.canInteract});
 }
 function exploration(){if(!S.tides.exploration)S.tides.exploration=TideExploration.create();return S.tides.exploration;}
 function explorationWild(){return TideExploration.visible(exploration());}
 function updateExploration(dt=0){
  if(!S?.tides||!world||!hero)return;
  const view=typeof VW==='number'&&typeof zoom==='number'?{x:camX,y:camY,w:VW/zoom,h:VH/zoom}:null;
  TideExploration.advance(exploration(),{dt,view,world,worldKey:world.key,x:hero.x,y:hero.y,now:Date.now(),hasLasso:S.tides.lassoOwned,petLevel:owned()?.level||1,paused:gamePaused||modalOpen()||!!padPanelOpen()||hero.dead,
   isValidPosition:(x,y)=>!collide(hero,x,y)&&!expeditionDoors().some(d=>Math.hypot(d.x-x,d.y-y)<220)&&![...(world.stable?.clearZones||[]),...(world.training?.clearZones||[])].some(r=>x>r.x-50&&x<r.x+r.w+50&&y>r.y-50&&y<r.y+r.h+50)});
 }
 function wildList(){return outdoors()&&S.tides?.lassoOwned&&!session?explorationWild():[];}
 function addWildDrawables(list,bounds){
  for(const w of wildList()){
   const box=wildBounds(w);if(box.right<bounds.x0||box.left>bounds.x1||box.bottom<bounds.y0||box.top-26>bounds.y1)continue;
   list.push({y:w.y,f:()=>{const s=species(w.speciesId),near=Math.hypot(hero.x-w.x,hero.y-w.y)<160,H=box.height;
    drawAnimal(ctx,s.id,w.x,w.y+6,H,w.fx||1,w.motion||0,w.walkphase||0,s.spectral?.93:1,motionClock+(w.homeX||w.x)*.01);
    ctx.save();ctx.textAlign='center';ctx.font='700 9px Georgia,serif';ctx.fillStyle=s.spectral?'#8ed8ff':'#dcc78e';ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.fillText('★'.repeat(s.stars),w.x,w.y-H-8);if(near){ctx.font='700 10px Georgia,serif';ctx.fillStyle='#efe6ca';ctx.fillText(s.name+' · Lv '+w.level,w.x,w.y-H-21);}ctx.restore();}});
  }
 }
 function wildClick(x,y){
  const w=wildList().filter(w=>{const b=wildBounds(w);return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;}).sort((a,b)=>Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y))[0];
  if(!w)return false;
  if(Math.hypot(hero.x-w.x,hero.y-w.y)<180)openWild(w.id);
  else{hero.target=null;hero.goPortal=false;hero.moveTo={x:w.x,y:w.y+45};marker={...hero.moveTo,t:0};hero.pendingDoor={s:w,open:()=>openWild(w.id),rng:170};}
  return true;
 }
 function openWild(id){
  const w=wildList().find(w=>w.id===id);if(!w||Math.hypot(hero.x-w.x,hero.y-w.y)>185)return;
  const s=species(w.speciesId),p=owned(),ready=p&&!remaining(p)&&!Tides.isTraining(S.tides,p.id)&&!Tides.isBreedingParent(S.tides,p.id);
  if(!openHub('wild','A wild Tide','Neutral · It will only fight if you challenge it'))return;wildChoice=id;
  el('tideHubBody').innerHTML=`<div class="tide-challenge">${icon(s)}<h3>${html(s.name)}</h3>${stars(s)}<p>Level ${w.level}<br>${html(s.description)}</p><p>${p?'Your companion: <b>'+html(species(p.speciesId).name)+'</b> · Level '+p.level+'<br><span id="tideWildReady">'+restText(p)+'</span>':'Equip a Tide from storage to challenge this animal.'}</p><button class="sbtn gold" id="tideChallenge" ${ready?'':'disabled'}>Tide battle</button><button class="sbtn" id="tideWildStorage">Choose a companion</button><p>Both Tides complete their chosen action each round, even if knocked out. A double knockout is a draw.</p><p>Win to tame this Tide. ${Tides.INJURY_MS?'Defeat or leaving an unfinished battle means two hours of rest.':'After a defeat, your Tide can battle again immediately.'} A draw grants no capture or XP and causes no injury.</p></div>`;
  el('tideChallenge').onclick=()=>begin(id);el('tideWildStorage').onclick=openStorage;paintIcons();
 }
 function appendLog(text){const box=el('tideBattleLog'),row=document.createElement('div');row.textContent=text;box.append(row);while(box.children.length>18)box.firstChild.remove();box.scrollTop=box.scrollHeight;}
 function guildAllowed(){return !!(gameOn&&S?.tides&&hero&&!hero.dead&&typeof guildInReach==='function'&&guildInReach());}
 function guildError(reason){return {lasso:'Buy a Tidekeeper\'s Lasso at the City church first.',equipped:'Equip a Tide from storage to enter the arena.',injured:'Choose a Tide that is ready to battle.',breeding:'Your Tide is breeding. Choose another companion.',training:'Collect your Tide from the training grounds first.',battle:'Finish your current Tide battle first.'}[reason]||'Choose a ready Tide from storage and try again.';}
 function openGuild(){
  if(!guildAllowed()||!openHub('guild','Tides Guild','The Underwell Arena · Best of three'))return false;
  const p=owned(),s=p&&species(p.speciesId),ready=!!(S.tides.lassoOwned&&p&&!remaining(p)&&!Tides.isTraining(S.tides,p.id)&&!Tides.isBreedingParent(S.tides,p.id));
  // Warm the five original-species atlases before a random opponent is drawn.
  Tides.catalog.forEach(imageFor);if(s)imageFor(s);
  el('tideHubBody').innerHTML=`<div class="tide-challenge tide-guild-challenge"><div class="tide-guild-emblem" aria-hidden="true">⚔</div><h3>Enter the arena</h3><p>Face a new guild trainer and one of the 25 original Tides. Their Tide matches your companion's level.</p>${p?`<div class="tide-guild-companion">${icon(s)}<b>${html(s.name)}</b><span>Level ${p.level} · ${html(restText(p))}</span></div>`:'<p>Equip a Tide from Tide storage to join a match.</p>'}<p>First to <b>two victories</b> wins the series. Both Tides complete their chosen action, even if knocked out. Double knockouts are draws: replay that match with the score unchanged. Both Tides recover fully before each match.</p><button class="sbtn gold" id="tideGuildStart" ${ready?'':'disabled'}>Battle · Best of three</button>${S.tides.lassoOwned?'<button class="sbtn" id="tideGuildStorage">Choose a companion</button>':'<p>Get your Tidekeeper\'s Lasso at the City church first.</p>'}<p class="tide-guild-practice">Practice freely: no captures, XP or injuries.</p></div>`;
  el('tideGuildStart').onclick=beginGuild;if(el('tideGuildStorage'))el('tideGuildStorage').onclick=openStorage;paintIcons();return true;
 }
 function showBattleControls(){
  el('tideBattleFx').hidden=false;el('tideBattleFx').classList.toggle('tide-guild-battle',!!session?.guild);
  el('tideBattleLog').innerHTML='';el('tideActions').hidden=false;el('tideActions').style.display='';el('tideResult').hidden=true;
  el('tideAttack').onclick=()=>act('attack');el('tidePower').onclick=()=>act('power');el('tideRetreat').onclick=retreat;
 }
 function beginGuild(){
  if(session||hubMode!=='guild'||!guildAllowed()||gamePaused)return false;
  const p=owned();if(!p||!frameFor(p.speciesId)){el('tideHubMessage').textContent=p?'Your Tide is arriving. Try again in a moment.':guildError('equipped');return false;}
  const owner=S.tides,result=TideGuild.start(owner,{trainer:createGuildTrainer()});
  if(!result.ok){el('tideHubMessage').textContent=guildError(result.reason);return false;}
  closeHub();Mounts.reset(mountRide);updateMountButton();stopHero();
  session={guild:result.series,owner,battle:result.battle,oldZoom:zoom,oldCamX:camX,oldCamY:camY,time:0,animation:null,result:null,shownResult:false,heroEffects:null,trainerEffects:{}};
  frameFor(result.battle.foe.speciesId);setZoom(Math.min(3,Math.max(2.1,zoom)));showBattleControls();
  appendLog('Match 1 of 3. Both chosen actions complete each round. First to two victories wins; drawn matches are replayed.');battleHud();paintBattle();saveNow();return true;
 }
 function nextGuildRound(){
  if(!session?.guild||session.animation||!session.shownResult||session.guild.status!=='between-rounds'||session.owner!==S?.tides||!guildAllowed()||gamePaused)return false;
  const replay=session.result?.outcome==='draw',result=TideGuild.nextRound(session.owner,session.guild);if(!result.ok)return false;
  session.guild=result.series;session.battle=result.battle;session.result=null;session.shownResult=false;session.retreatAsked=false;session.pendingOutcome=null;session.animation=null;
  showBattleControls();appendLog((replay?'Replaying match ':'Match ')+session.guild.round+' of 3. Both Tides are restored to full health.');battleHud();paintBattle();saveNow();return true;
 }
 function finishRound(){
  if(!session||session.animation||session.result||!session.pendingOutcome)return;
  const result=session.guild?TideGuild.finishRound(session.owner,session.guild,session.battle):Tides.finishBattle(session.owner,session.battle);
  session.pendingOutcome=null;if(!result.ok){closeBattle();return;}
  if(session.guild)session.guild=result.series;session.result=result;saveNow();entry();
 }
 function begin(id){
  if(session||!outdoors()||gamePaused||hero.dead||hubMode!=='wild'||wildChoice!==id)return;
  const w=explorationWild().find(w=>w.id===id),p=owned();if(!w||!p||Math.hypot(hero.x-w.x,hero.y-w.y)>185)return;
  const now=Date.now();
  if(w.expiresAt<=Math.max(now,exploration().lastNow||0)){closeHub();updateExploration();stageMsg('That Tide has wandered away.',1800);return;}
  if(!frameFor(w.speciesId)||!frameFor(p.speciesId)){el('tideHubMessage').textContent='Your Tides are arriving. Try again in a moment.';return;}
  const result=Tides.beginBattle(S.tides,w,{now});if(!result.ok){el('tideHubMessage').textContent=result.reason==='injured'?'Your Tide is still recovering. Choose a ready companion.':'This companion cannot battle yet.';return;}
  TideExploration.take(exploration(),id,now);saveNow();closeHub();Mounts.reset(mountRide);updateMountButton();stopHero();
  session={owner:S.tides,battle:result.battle,oldZoom:zoom,oldCamX:camX,oldCamY:camY,time:0,animation:null,result:null,shownResult:false,logIndex:0};
  setZoom(Math.min(3,Math.max(2.1,zoom)));camX=(hero.x+w.x)/2-VW/zoom/2;camY=(hero.y+w.y)/2-VH/zoom/2;
  draw();const backdrop=document.createElement('canvas');backdrop.width=cv.width;backdrop.height=cv.height;backdrop.getContext('2d').drawImage(cv,0,0);session.backdrop=backdrop;
  showBattleControls();
  appendLog('Choose one attack or power each round. Both Tides complete their chosen action, even if knocked out. A double knockout is a draw.');battleHud();paintBattle();saveNow();
 }
 const actionMarks={
  attack:{label:'Attack',path:'<path d="m14 3 7-1-1 7-10 10-5-5Z"/><path d="m4 12 8 8M7 17l-4 4"/>'},
  healing:{label:'Healing',path:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>'},
  support:{label:'Support',path:'<path d="m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6Z"/><path d="M12 6v11M7 10h10"/>'}
 };
 function battleAction(id,move,kind,note=''){
  const button=el(id),mark=actionMarks[kind];button.dataset.actionType=kind;
  button.innerHTML='<span class="tide-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+mark.path+'</svg></span><span class="tide-action-copy"><b>'+html(move.name)+'</b><small>'+html(move.description+note)+'</small></span>';
  button.setAttribute('aria-label',mark.label+': '+move.name+'. '+move.description+note);
 }
 function battleHud(){
  if(!session)return;const b=session.animation?.display||session.battle;
  for(const [side,prefix]of [['player','tidePlayer'],['foe','tideFoe']]){const u=b[side],s=species(u.speciesId);el(prefix+'Name').innerHTML=html(s.name)+' · Lv '+u.level+stars(s,u);el(prefix+'Hp').style.width=Math.max(0,u.hp/u.maxHp*100)+'%';el(prefix+'HpText').textContent=Math.max(0,Math.round(u.hp))+' / '+u.maxHp;el(prefix+'Status').textContent=[u.shield>0?'Shield '+u.shield:'',u.buffTurns>0?'Empowered '+u.buffTurns+' turns':'',u.poisonTurns>0?'Lingering damage '+u.poisonTurns+' turns':'',u.weakenTurns>0?'Weakened '+u.weakenTurns+' turns':''].filter(Boolean).join(' · ');}
  const s=species(b.player.speciesId),skill=petSkill(b.player),busy=!!session.animation||!!session.result;
  if(session.guild){const series=session.guild;el('tideTurn').innerHTML='<span class="tide-guild-round">Match '+series.round+' / 3</span><b class="tide-guild-score">You '+series.score.player+' – '+series.score.foe+' '+html(series.trainer.name)+'</b><small>Turn '+b.turn+'</small>';}
  else el('tideTurn').textContent='Round '+b.turn;
  battleAction('tideAttack',s.attack,'attack');
  const powerKind=skill.heal>0||skill.drain>0?'healing':skill.damage>0||skill.poison>0?'attack':'support';
  battleAction('tidePower',skill,powerKind,b.player.powerCooldown?' · Ready in '+b.player.powerCooldown+' attacks':'');
  el('tideAttack').disabled=busy;el('tidePower').disabled=busy||b.player.powerCooldown>0;el('tideRetreat').disabled=busy;
 }
 function battleTimeline(raw,display){
  const moves=[],events=[];let eventTime=-.045;
  for(const e of raw){
   const previous=moves[moves.length-1];let at;
   if(e.type==='attack'||e.type==='power'){
    // Leave space for this actor's pre-action poison tick and the prior lunge.
    const start=Math.max(previous?previous.start+previous.duration+.05:0,eventTime+.035),move={...e,start,duration:.85};
    moves.push(move);at=start+.08;
   }else if(e.type==='result'||e.type==='limit')at=previous?previous.start+previous.duration+.05:.05;
   else if(e.type==='poison'&&(!previous||e.actionIndex!==previous.actionIndex))at=previous?previous.start+previous.duration+.05:.05;
   else at=previous?previous.start+.43:.05;
   eventTime=Math.max(eventTime+.045,at);events.push({...e,at:eventTime});
  }
  const last=moves[moves.length-1];
  return {elapsed:0,duration:Math.max(last?last.start+last.duration+.15:.3,eventTime+.1),moves,events,shown:0,display};
 }
 function animationMove(animation){
  const actor=animation?.moves.find(move=>animation.elapsed>=move.start&&animation.elapsed<move.start+move.duration)||null;
  return {actor,progress:actor?Math.max(0,Math.min(1,(animation.elapsed-actor.start)/actor.duration)):0};
 }
 function act(choice){
  if(!session||session.animation||session.result||gamePaused)return;
  const display={player:{...session.battle.player},foe:{...session.battle.foe},turn:session.battle.turn};
  const result=Tides.act(session.battle,choice);if(!result.ok)return;
  initAudio();
  session.animation=battleTimeline(result.events,display);
  if(result.outcome)session.pendingOutcome=result.outcome;
  battleHud();
 }
 function battleSound(e,a){
  if(!['attack','power','damage'].includes(e.type))return;
  const action=e.type==='damage'?a.moves.find(m=>m.side===e.side):e;
  if(!action)return;
  const unit=a.display[e.side],s=species(unit.speciesId),power=action.type==='power',move=power?petSkill(unit):s.attack;
  // Consume sounds with the combat timeline, so repainting cannot repeat a hit.
  if(e.type==='damage')sfx.tideImpact(move.style,power);
  else if(power&&!move.damage)sfx.tidePower();
  else sfx.tideCast(move.style,power);
 }
 function retreat(){
  if(!session||session.animation||session.result||gamePaused)return;
  if(session.guild){
   if(!session.retreatAsked){session.retreatAsked=true;appendLog('Leave the series? Click Retreat again to return to the guild. Your Tide will stay healthy.');return;}
   closeBattle();return;
  }
  if(!session.retreatAsked){session.retreatAsked=true;appendLog('Retreat counts as a defeat.'+(Tides.INJURY_MS?' Your Tide will need two hours of rest.':'')+' Click Retreat again to leave.');return;}
  session.result=Tides.abandonBattle(S.tides,session.battle);saveNow();entry();showResult();
 }
 function showResult(){
  if(!session||session.shownResult||!session.result?.ok)return;session.shownResult=true;
  const r=session.result,won=r.outcome==='win',drawn=r.outcome==='draw';el('tideActions').style.display='none';el('tideResult').hidden=false;
  if(session.guild){
   const series=session.guild,finished=series.status==='finished',victory=series.outcome==='win';
   el('tideResult').innerHTML=`<h3>${drawn?'Draw!':finished?victory?'Series victory!':'Series complete':won?'Match won!':'Match lost'}</h3><div class="tide-guild-result-score">You <b>${series.score.player} – ${series.score.foe}</b> ${html(series.trainer.name)}</div><div>${drawn?'Neither trainer earns a point. Replay this match against the same opponent at full health.':finished?victory?'Two victories. The guild salutes you.':'A new opponent awaits whenever you are ready.':'Both Tides return at full health for the next match.'}</div><button class="sbtn gold" id="tideGuildContinue">${drawn?'Replay match':finished?'Fight again':'Next match'}</button><button class="sbtn" id="tideGuildLeave">Return to guild</button>`;
   el('tideGuildContinue').onclick=finished?()=>{if(!guildAllowed()||gamePaused)return;closeBattle();if(openGuild())beginGuild();}:nextGuildRound;
   el('tideGuildLeave').onclick=closeBattle;sfx[drawn?'click':(finished?victory:won)?'loot':'warn']?.();battleHud();return;
  }
  if(drawn){
   el('tideResult').innerHTML='<h3>Draw!</h3><div>Neither Tide wins this battle.</div><div>No Tide was captured and no XP was awarded. Your companion is ready to battle again, with no injury.</div><button class="sbtn gold" id="tideContinue">Continue exploring</button><button class="sbtn" id="tideResultStorage">Tide storage</button>';
   el('tideContinue').onclick=closeBattle;el('tideResultStorage').onclick=()=>{closeBattle();openStorage();};sfx.click?.();battleHud();return;
  }
  el('tideResult').innerHTML=won?`<h3>A new bond!</h3><div><b>${html(species(r.captured.speciesId).name)}</b> · Level ${r.captured.level} joined your Tide storage.</div><div>${html(species(r.pet.speciesId).name)} earned ${r.xp} XP${r.levels?' and reached level '+r.pet.level:''}.</div><button class="sbtn gold" id="tideContinue">Continue exploring</button><button class="sbtn" id="tideResultStorage">Tide storage</button>`:`<h3>${Tides.INJURY_MS?'Time to recover':'Defeat'}</h3><div>${html(species(r.pet.speciesId).name)} ${Tides.INJURY_MS?'is injured and needs two hours of rest.':'is ready to battle again.'}</div><div>${Tides.INJURY_MS?'You can equip another healthy Tide from storage.':'Try again or choose another Tide from storage.'}</div><button class="sbtn gold" id="tideContinue">Return to Wasteland</button><button class="sbtn" id="tideResultStorage">Tide storage</button>`;
  el('tideContinue').onclick=closeBattle;el('tideResultStorage').onclick=()=>{closeBattle();openStorage();};sfx[won?'loot':'warn']?.();battleHud();
 }
 function closeBattle(){
  if(!session)return;
  if(session.guild){if(session.guild.status!=='finished'&&session.guild.status!=='abandoned'){TideGuild.abandon(session.owner,session.guild,session.battle);if(session.owner===S?.tides)saveNow();}}
  else if(!session.result){const owner=session.owner||S.tides;if(session.battle.outcome)Tides.finishBattle(owner,session.battle);else Tides.abandonBattle(owner,session.battle);if(owner===S?.tides)saveNow();}
  const old=session;session=null;el('tideBattleFx').hidden=true;el('tideBattleFx').classList.remove('tide-guild-battle');setZoom(old.oldZoom);camX=old.oldCamX;camY=old.oldCamY;stopHero();entry();
 }
 function leaveZone(){closeHub();if(session)closeBattle();}
 function awardKill(en){
  if(!S?.tides?.lassoOwned||!en||en.dungeonRetired)return;
  const r=Tides.awardWorldXp(S.tides,{amount:2});if(r.ok){if(r.levels){stageMsg(species(r.pet.speciesId).name+' reached Tide level '+r.pet.level+'!',1800);entry();}save();}
 }
 function paintBattle(){
  if(!session||el('tideBattleFx').hidden)return;
  const c=el('tideArena'),r=c.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h)return;
  const d=Math.min(2,devicePixelRatio||1);if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d);}
  const g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h);
  if(session.guild)TideGuildWorld.renderBattle(g,w,h,session.time,{images:guildImages()});
  else if(session.backdrop){const k=Math.max(w/session.backdrop.width,h/session.backdrop.height)*(1.035-Math.min(1,session.time/.65)*.035),bw=session.backdrop.width*k,bh=session.backdrop.height*k;g.drawImage(session.backdrop,(w-bw)/2,(h-bh)/2,bw,bh);}
  g.fillStyle='rgba(22,22,9,.12)';g.fillRect(0,0,w,h);
  const shade=g.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(4,8,5,.52)');shade.addColorStop(.35,'rgba(4,8,5,0)');shade.addColorStop(.75,'rgba(4,8,5,.1)');shade.addColorStop(1,'rgba(4,8,5,.55)');g.fillStyle=shade;g.fillRect(0,0,w,h);
  const hudBottom=el('tideTurn').parentElement.getBoundingClientRect().bottom-r.top;
  const controlsTop=el('tideActions').parentElement.getBoundingClientRect().top-r.top;
  const trainer=session.guild?.trainer,trainerFrame=trainer?paintedCharacterFrame(trainer.race,trainer.cls,trainer.fem,trainer.ice):null;
  const b=session.animation?.display||session.battle,anim=session.animation,layout=battleLayout(w,h,b.player.speciesId,b.foe.speciesId,hudBottom,controlsTop,paintedCharacterFrame(S.race,S.cls,S.gender==='f',isIce(S.gear.armor)),{guild:!!session.guild,trainerFrame}),{floor,left,right}=layout,ps=layout.player,fs=layout.foe;
  let lx=left,rx=right,ly=floor,ry=floor,actor=null,progress=0,style='melee',color='#ddd',hit=0;
  if(anim){({actor,progress}=animationMove(anim));if(actor){const unit=b[actor.side],s=species(unit.speciesId),move=actor.type==='power'?petSkill(unit):s.attack;style=move.style;color=move.color;hit=Math.sin(Math.PI*Math.max(0,(progress-.45)/.55));if(style==='melee'){const p=Math.sin(Math.PI*progress),travel=layout.travel*p;if(actor.side==='player'){lx+=travel;ly-=Math.sin(progress*Math.PI*3)*9*p;}else{rx-=travel;ry-=Math.sin(progress*Math.PI*3)*9*p;}}}}
  if(trainer)drawGuildTrainer(g,layout.foeHeroX,floor-5,trainer,layout.heroScale,-1,session.time,session.trainerEffects);
  // Use the same equipped cosmetics as the world hero, with battle-local particles.
  g.save();g.translate(layout.heroX,floor-5);g.scale(layout.heroScale,layout.heroScale);
  const f=paintedCharacterFrame(S.race,S.cls,S.gender==='f',isIce(S.gear.armor)),wRune=runeOf(S.gear.weapon),heroScene=g.getTransform().inverse();
  if(f)bootFeet({...f.boots,moving:false,walk:0,bob:0},g);
  const emission=drawChampionSprite(g,S.race,S.cls,1,0,0,isFK(S.gear.weapon),isFG(S.gear.weapon)?'felglaives':isFK(S.gear.weapon)?'rimfrost':null,S.gender==='f',1,isIce(S.gear.armor),wRune,null,session.time);
  drawEquippedRing(g,S.gear.trinket,f?f.headY:-30,session.time,hero.dead);
  const fx=session.heroEffects||(session.heroEffects={...createRuneEmissionState(),time:session.time});
  const fxDt=gamePaused?0:Math.max(0,Math.min(.05,session.time-fx.time));fx.time=session.time;
  if(fxDt>0)for(let i=fx.parts.length-1;i>=0;i--)if(stepRuneParticle(fx.parts[i],fxDt))fx.parts.splice(i,1);
  runeSpark(wRune,emission?{...emission,points:emission.points.map(p=>runePointTransform(heroScene,p))}:null,fxDt,f?f.groundY:8,fx);
  fx.parts.forEach(p=>drawRuneParticle(g,p));g.restore();
  drawAnimal(g,b.player.speciesId,lx,ly,ps.height,1,actor?.side==='player'&&style==='melee'?Math.sin(progress*Math.PI):0,progress*Math.PI*8,b.player.hp<=0&&session.shownResult?.6:1,session.time,b.player.hp>0||actor?.side==='player');
  drawAnimal(g,b.foe.speciesId,rx,ry,fs.height,-1,actor?.side==='foe'&&style==='melee'?Math.sin(progress*Math.PI):0,progress*Math.PI*8,b.foe.hp<=0&&session.shownResult?.5:1,session.time+1.7,b.foe.hp>0||actor?.side==='foe');
  if(actor&&style==='magic'){
   const friendly=actor.side==='player',self=actor.type==='power'&&!petSkill(b[actor.side]).damage,ownSize=friendly?ps:fs,targetSize=self?ownSize:friendly?fs:ps,ownX=friendly?left:right;
   const from=self?ownX:ownX+(friendly?1:-1)*ownSize.width*.28,to=self?from:(friendly?right-fs.width*.25:left+ps.width*.25),fromY=floor-ownSize.height*.58,toY=floor-targetSize.height*.5;
   const p=Math.min(1,progress*1.55),px=from+(to-from)*p,py=fromY+(toY-fromY)*p-Math.sin(p*Math.PI)*Math.min(ownSize.height,targetSize.height)*.28;
   g.save();g.strokeStyle=color;g.fillStyle=color;g.shadowColor=color;g.shadowBlur=15;g.globalAlpha=Math.sin(progress*Math.PI);g.lineWidth=3;
   if(self){g.beginPath();g.ellipse(from,floor-ownSize.height*.42,ownSize.width*.48,ownSize.height*.55,0,0,Math.PI*2);g.stroke();}else{g.beginPath();g.arc(px,py,8+Math.sin(progress*20)*2,0,Math.PI*2);g.fill();for(let i=1;i<5;i++){g.globalAlpha*=.72;g.beginPath();g.arc(px-(to-from)*.022*i,py+i*2,6-i,0,Math.PI*2);g.fill();}}g.restore();
  }
  if(actor&&progress>.5&&progress<.8&&(actor.type==='attack'||petSkill(b[actor.side]).damage)){const target=actor.side==='player'?fs:ps,x=actor.side==='player'?right-fs.width*.25:left+ps.width*.25,size=Math.min(target.height,target.width);g.save();g.strokeStyle=color;g.lineWidth=2;g.globalAlpha=hit*.7;for(let i=0;i<6;i++){const a=i*Math.PI/3;g.beginPath();g.moveTo(x+Math.cos(a)*size*.12,floor-target.height*.5+Math.sin(a)*size*.12);g.lineTo(x+Math.cos(a)*size*.3,floor-target.height*.5+Math.sin(a)*size*.3);g.stroke();}g.restore();}
 }
 function tick(dt){
  clockTick+=dt;motionClock+=dt;
  if(hubMode==='guild'&&!guildAllowed())closeHub();
  if(clockTick>=1&&hubMode==='wild'&&el('tideChallenge')){const p=owned();el('tideChallenge').disabled=!p||remaining(p)>0||Tides.isTraining(S.tides,p.id)||Tides.isBreedingParent(S.tides,p.id);if(el('tideWildReady'))el('tideWildReady').textContent=restText(p);}
  if(clockTick>=1){clockTick=0;if(typeof tickTraining==='function')tickTraining();refreshStorageValues();}
  if(!session)return;if(session.owner&&session.owner!==S?.tides||session.guild&&!guildAllowed()){closeBattle();return;}session.time+=dt;
  const a=session.animation;if(a){
   a.elapsed+=dt;
   while(a.shown<a.events.length&&a.events[a.shown].at<=a.elapsed){
    const e=a.events[a.shown++];appendLog(e.text);battleSound(e,a);
    // Both actions resolve together. Keep the starting bars while they animate;
    // replaying clipped event amounts would misrepresent simultaneous healing.
    // Clearing animation below commits both authoritative combatants at once.
    battleHud();
   }
   if(a.elapsed>=a.duration){while(a.shown<a.events.length)appendLog(a.events[a.shown++].text);session.animation=null;session.retreatAsked=false;finishRound();if(!session)return;battleHud();if(session.result)showResult();}
  }
  paintBattle();
 }
 function nearestWild(){return wildList().filter(w=>Math.hypot(hero.x-w.x,hero.y-w.y)<180).sort((a,b)=>Math.hypot(hero.x-a.x,hero.y-a.y)-Math.hypot(hero.x-b.x,hero.y-b.y))[0]||null;}
 function afterDraw(){
  if(!session?.backdrop||session.time>2||session.time<(session.nextBackdrop||0))return;
  session.nextBackdrop=session.time+.25;session.backdrop.getContext('2d').drawImage(cv,0,0);paintBattle();
 }
 return {entry,bagItem,bindBag,openChurch,churchInReach,openBreeding,openGuild,openTraining,visibleCompanion,drawCompanion,openStorage,renderStoragePage,storageOpen,storageBack,openWild,wildClick,nearestWild,updateExploration,addWildDrawables,modalOpen,isBattling:()=>!!session,begin,act,retreat,closeHub,closeBattle,leaveZone,awardKill,tick,paintBattle,afterDraw,frameFor,drawAnimal,paintIcons,animalVisual,wildBounds,battleLayout};
})();
