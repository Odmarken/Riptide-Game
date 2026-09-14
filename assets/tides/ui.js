/* Tides presentation and game integration. Rules and exploration remain independently testable. */
const TideUI=(()=>{
 const frames=new Map(),sheets=new Map();
 let session=null,hubMode='',wildChoice=null,storageLimit=48,clockTick=0,motionClock=0;
 let storagePetId=null,storageOwner=null,storageReturnTab='hero',storageReturnScroll=0,storageScroll=0,storageReturnHub=null;
 const el=id=>document.getElementById(id),html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const species=id=>Tides.getSpecies(id),owned=()=>Tides.equipped(S.tides),outdoors=()=>!!(S&&zoneOf().wasteland&&!zoneOf().dungeon);
 const stars=s=>`<span class="tide-stars${s.spectral?' spectral':''}">${'★'.repeat(s.stars)}${s.spectral?' · Spectral':''}</span>`;
 const icon=s=>`<canvas class="tide-sprite" width="320" height="280" data-tide-art="${s.id}" role="img" aria-label="${html(s.name)}"></canvas>`;
 const remaining=p=>Tides.remainingInjury(p);
 function restText(p){const secs=Math.ceil(remaining(p)/1000);return secs?'Resting · '+Math.floor(secs/3600)+':'+String(Math.floor(secs/60)%60).padStart(2,'0')+':'+String(secs%60).padStart(2,'0'):'Ready';}
 function imageFor(s){
  if(!sheets.has(s.sheet)){const im=new Image();im.onload=()=>paintIcons();im.src=s.sheet;sheets.set(s.sheet,im);}
  return sheets.get(s.sheet);
 }
 function frameFor(id){
  if(frames.has(id))return frames.get(id);
  const s=species(id);if(!s)return null;const im=imageFor(s);if(!im.complete||!im.naturalWidth)return null;
  const layout=typeof TideArtLayout==='object'?TideArtLayout[id]:null;
  const cw=im.naturalWidth/3,ch=im.naturalHeight/2;
  const rect=layout?.rect||[Math.floor(s.cell%3*cw),Math.floor(Math.floor(s.cell/3)*ch),Math.floor(cw),Math.floor(ch)];
  const c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,...rect,0,0,c.width,c.height);
  const data=g.getImageData(0,0,c.width,c.height).data;let left=c.width,right=-1,top=c.height,bottom=-1;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>=64){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)return null;const f={image:c,x:Math.max(0,left-3),y:Math.max(0,top-3),w:Math.min(c.width,right+4)-Math.max(0,left-3),h:Math.min(c.height,bottom+4)-Math.max(0,top-3)};
  frames.set(id,f);return f;
 }
 function paintIcons(){
  document.querySelectorAll('[data-tide-art]').forEach(c=>{const f=frameFor(c.dataset.tideArt);if(!f)return;const g=c.getContext('2d'),k=Math.min((c.width-12)/f.w,(c.height-12)/f.h);g.clearRect(0,0,c.width,c.height);g.drawImage(f.image,f.x,f.y,f.w,f.h,(c.width-f.w*k)/2,(c.height-f.h*k)/2,f.w*k,f.h*k);});
 }
 function drawAnimal(g,id,x,y,height,fx=1,motion=0,phase=0,alpha=1,time=motionClock,alive=true){
  const f=frameFor(id);if(!f)return false;
  TideMotion.draw(g,f,id,x,y,height,fx,motion,phase,alpha,time,alive);return true;
 }
 function animalVisual(id,base=36){
  const s=species(id),f=frameFor(id),bounds=typeof TideArtLayout==='object'?TideArtLayout[id]?.bounds:null;
  const height=base*(s?.visualScale||1),aspect=f?f.w/f.h:bounds?bounds[2]/bounds[3]:1;
  return {height,width:height*aspect};
 }
 function wildBounds(w){
  const size=animalVisual(w.speciesId),half=Math.max(26,size.width*.55+6),top=w.y+6-Math.max(52,size.height*1.08+8);
  return {...size,left:w.x-half,right:w.x+half,top,bottom:w.y+16};
 }
 function battleLayout(w,h,playerId,foeId){
  const floor=h*(h<600?.54:.58),heroX=w*.105,heroScale=w<650?Math.min(2.6,w*.27/58):Math.min(4.2,h*.3/58,w*.2/58);
  const start=Math.max(w*.22,heroX+heroScale*32+12),end=w-Math.max(12,w*.025),gap=Math.max(14,w*.1);
  const p=animalVisual(playerId,w<650?85:135),f=animalVisual(foeId,w<650?85:135);
  const fit=Math.min(1,Math.max(1,end-start-gap)/((p.width+f.width)*1.1),Math.max(40,floor-Math.min(130,h*.18))/(Math.max(p.height,f.height)*1.08));
  for(const size of [p,f]){size.height*=fit;size.width*=fit;}
  const extra=Math.max(0,end-start-p.width*1.1-f.width*1.1-gap);
  const left=start+p.width*.55+extra*.2,right=end-f.width*.55-extra*.2;
  return {floor,left,right,player:p,foe:f,heroX,heroScale,heroRight:heroX+heroScale*32,travel:Math.max(0,right-left-(p.width+f.width)*.42-8)};
 }
 function stopHero(){
  if(!hero)return;hero.moveTo=null;hero.pendingDoor=null;hero.target=null;hero.goPortal=false;hero.moving=false;hero.dance=0;holdMove=null;stopMining();
  for(const k in keys)keys[k]=false;
 }
 function openHub(mode,title,intro=''){
  if(!gameOn||session)return false;stopHero();hubMode=mode;el('tideHub').hidden=false;el('tideHubTitle').textContent=title;el('tideHubIntro').textContent=intro;el('tideHubTools').innerHTML='';el('tideHubBody').innerHTML='';el('tideHubBody').scrollTop=0;el('tideHubMessage').textContent='';el('tideHubClose').onclick=closeHub;return true;
 }
 function closeHub(){el('tideHub').hidden=true;hubMode='';wildChoice=null;el('tideHubBody').onscroll=null;}
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
 function petCard(p){
  const s=species(p.speciesId),equipped=S.tides.equippedId===p.id;
  return `<button class="tide-card${equipped?' equipped':''}" data-tide-pet="${html(p.id)}" aria-label="View ${html(s.name)} stats">${icon(s)}<span class="tide-card-name">${html(s.name)}</span>${stars(s)}<span class="cl">Level <span data-tide-level>${p.level}</span></span><span class="tide-state" data-tide-state>${restText(p)}</span><span class="tide-equipped-badge" data-tide-equipped>${equipped?'Equipped':''}</span></button>`;
 }
 function storageOpen(){return !!el('p-tides')?.classList.contains('open');}
 function filteredPets(){
  const query=(el('tideSearch')?.value||'').trim().toLowerCase(),filter=el('tideFilter')?.value||'all';
  return S.tides.pets.filter(p=>{const s=species(p.speciesId);return (!query||s.name.toLowerCase().includes(query))&&(filter==='all'||filter==='ready'&&!remaining(p)||filter==='spectral'&&s.spectral||String(s.stars)===filter);});
 }
 function renderStorage(reset=true){
  if(!storageOpen()||storagePetId)return;
  if(reset)storageLimit=48;
  const box=el('p-tides'),scroll=box.scrollTop,filtered=filteredPets(),shown=filtered.slice(0,storageLimit);
  el('tideStorageTools').hidden=false;
  el('tideStorageBody').innerHTML=`<div class="tide-grid">${shown.map(petCard).join('')}</div>${!shown.length?'<p class="cl">No Tides match this search.</p>':''}${shown.length<filtered.length?'<p class="cl">Scroll to see more companions…</p>':''}`;
  el('tideStorageBody').querySelectorAll('[data-tide-pet]').forEach(b=>b.onclick=()=>openPet(b.dataset.tidePet));
  box.scrollTop=reset?0:scroll;refreshStorageValues();paintIcons();
 }
 function updateStorageHeader(){
  const p=owned(),s=p&&species(p.speciesId);
  el('tideStorageIntro').textContent=`${S.tides.pets.length.toLocaleString()} companions · ${new Set(S.tides.pets.map(p=>p.speciesId)).size} / 25 species discovered`;
  el('tideEquipped').textContent=s?`Equipped: ${s.name} · Level ${p.level} · ${restText(p)}`:'Select a Tide to view its stats and equip it.';
 }
 function openStorage(){
  if(!gameOn||!S?.tides?.lassoOwned||session)return;
  const current=document.querySelector('.panel.open');
  if(current?.id!=='p-tides'){
   storageReturnTab=current?.id.slice(2)||'battle';storageReturnScroll=current?.scrollTop||0;storagePetId=null;storageScroll=0;storageOwner=null;
  }
  storageReturnHub=hubMode==='wild'?{mode:'wild',id:wildChoice}:hubMode==='church'?{mode:'church'}:null;
  closeHub();toggleSide(false);openTab('tides');
 }
 function renderStoragePage(){
  if(storageOwner!==S.tides){
   storageOwner=S.tides;storagePetId=null;storageLimit=48;storageScroll=0;
   el('tideStorageTools').innerHTML='<div class="tide-equipped-line" id="tideEquipped"></div><div class="tide-tools"><input id="tideSearch" type="search" placeholder="Find a Tide" aria-label="Find a Tide"><select id="tideFilter" aria-label="Filter Tides"><option value="all">All companions</option><option value="ready">Ready for battle</option><option value="1">★ Common</option><option value="2">★★ Uncommon</option><option value="3">★★★ Rare</option><option value="4">★★★★ Epic</option><option value="5">★★★★★ Legendary</option><option value="spectral">Spectral</option></select></div>';
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
  const s=species(p.speciesId);
  el('tideStorageTools').hidden=true;
  el('tideStorageBody').innerHTML=`<div class="card tide-detail" id="tideDetail">${icon(s)}<h3>${html(s.name)}</h3>${stars(s)}<p class="cl">${html(s.description)}</p><div class="tide-stat-grid"><div><span>Level</span><b data-tide-level></b></div><div><span>Health</span><b data-tide-hp></b></div><div><span>Attack</span><b data-tide-atk></b></div></div><div class="tide-xp"><i data-tide-xp-bar></i></div><div class="cl" data-tide-xp></div><div class="tide-state" data-tide-state></div><div class="tide-skills"><b>${html(s.attack.name)}</b><p>${html(s.attack.description)}</p><b>${html(s.skill.name)}</b><p>${html(s.skill.description)}</p></div><button class="sbtn" data-tide-equip="${html(p.id)}"></button><p class="cl">Your equipped Tide earns XP from mob kills and Tide battles.</p></div>`;
  el('tideDetail').querySelector('[data-tide-equip]').onclick=e=>{
   if(session||!storageOpen()||remaining(p))return;const result=Tides.equip(S.tides,p.id);if(!result.ok)return;
   save();entry();refreshStorageValues();sfx.click?.();e.currentTarget.blur();
  };
  refreshStorageValues();paintIcons();
 }
 function refreshStorageValues(){
  if(!storageOpen()||!S?.tides?.lassoOwned)return;
  const fill=(box,p)=>{
   const st=Tides.stats(p),next=Tides.xpToNext(p.level),ready=!remaining(p),equipped=S.tides.equippedId===p.id;
   for(const [key,value]of Object.entries({level:p.level,hp:st.maxHp,atk:st.atk,xp:next?`${p.xp} / ${next} XP`:'Maximum level',state:restText(p),equipped:equipped?'Equipped':''}))box.querySelectorAll('[data-tide-'+key+']').forEach(n=>n.textContent=value);
   box.querySelectorAll('[data-tide-state]').forEach(n=>n.classList.toggle('resting',!ready));
   box.querySelectorAll('[data-tide-xp-bar]').forEach(n=>n.style.width=(next?Math.min(100,p.xp/next*100):100)+'%');
   const button=box.querySelector('[data-tide-equip]');if(button){button.disabled=equipped||!ready;button.textContent=equipped?'Equipped':ready?'Equip':'Recovering';}
   box.classList.toggle('equipped',equipped);
  };
  el('tideStorageBody').querySelectorAll('[data-tide-pet]').forEach(card=>{const p=S.tides.pets.find(p=>p.id===card.dataset.tidePet);if(p)fill(card,p);});
  const p=S.tides.pets.find(p=>p.id===storagePetId);if(p&&el('tideDetail'))fill(el('tideDetail'),p);updateStorageHeader();
 }
 function storageBack(){
  if(!storageOpen())return;
  if(storagePetId){storagePetId=null;renderStorage(false);el('p-tides').scrollTop=storageScroll;return;}
  const back=storageReturnHub;storageReturnHub=null;openTab(storageReturnTab==='battle'&&isDesktopLayout()?'hero':storageReturnTab);
  const previous=el('p-'+storageReturnTab);if(previous)previous.scrollTop=storageReturnScroll;
  if(back?.mode==='wild')openWild(back.id);else if(back?.mode==='church')openChurch();
 }
 function exploration(){if(!S.tides.exploration)S.tides.exploration=TideExploration.create();return S.tides.exploration;}
 function updateExploration(dt=0){
  if(!S?.tides||!world||!hero)return;
  const view=typeof VW==='number'&&typeof zoom==='number'?{x:camX,y:camY,w:VW/zoom,h:VH/zoom}:null;
  TideExploration.advance(exploration(),{dt,view,worldKey:world.key,x:hero.x,y:hero.y,now:Date.now(),hasLasso:S.tides.lassoOwned,petLevel:owned()?.level||1,paused:gamePaused||modalOpen()||!!padPanelOpen()||hero.dead,
   isValidPosition:(x,y)=>!collide(hero,x,y)&&!expeditionDoors().some(d=>Math.hypot(d.x-x,d.y-y)<220)&&!(world.stable?.clearZones||[]).some(r=>x>r.x-50&&x<r.x+r.w+50&&y>r.y-50&&y<r.y+r.h+50)});
 }
 function wildList(){return outdoors()&&S.tides?.lassoOwned&&!session?exploration().wild:[];}
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
  const s=species(w.speciesId),p=owned(),ready=p&&!remaining(p);
  if(!openHub('wild','A wild Tide','Neutral · It will only fight if you challenge it'))return;wildChoice=id;
  el('tideHubBody').innerHTML=`<div class="tide-challenge">${icon(s)}<h3>${html(s.name)}</h3>${stars(s)}<p>Level ${w.level}<br>${html(s.description)}</p><p>${p?'Your companion: <b>'+html(species(p.speciesId).name)+'</b> · Level '+p.level+'<br><span id="tideWildReady">'+restText(p)+'</span>':'Equip a Tide from storage to challenge this animal.'}</p><button class="sbtn gold" id="tideChallenge" ${ready?'':'disabled'}>Tide battle</button><button class="sbtn" id="tideWildStorage">Choose a companion</button><p>Win to tame this Tide. ${Tides.INJURY_MS?'Defeat or leaving an unfinished battle means two hours of rest.':'After a defeat, your Tide can battle again immediately.'}</p></div>`;
  el('tideChallenge').onclick=()=>begin(id);el('tideWildStorage').onclick=openStorage;paintIcons();
 }
 function appendLog(text){const box=el('tideBattleLog'),row=document.createElement('div');row.textContent=text;box.append(row);while(box.children.length>18)box.firstChild.remove();box.scrollTop=box.scrollHeight;}
 function begin(id){
  if(session||!outdoors()||gamePaused||hero.dead||hubMode!=='wild'||wildChoice!==id)return;
  const w=exploration().wild.find(w=>w.id===id),p=owned();if(!w||!p||Math.hypot(hero.x-w.x,hero.y-w.y)>185)return;
  if(!frameFor(w.speciesId)||!frameFor(p.speciesId)){el('tideHubMessage').textContent='Your Tides are arriving. Try again in a moment.';return;}
  const result=Tides.beginBattle(S.tides,w);if(!result.ok){el('tideHubMessage').textContent=result.reason==='injured'?'Your Tide is still recovering. Choose a ready companion.':'This companion cannot battle yet.';return;}
  TideExploration.take(exploration(),id,Date.now());saveNow();closeHub();Mounts.reset(mountRide);updateMountButton();stopHero();
  session={battle:result.battle,oldZoom:zoom,oldCamX:camX,oldCamY:camY,time:0,animation:null,result:null,shownResult:false,logIndex:0};
  setZoom(Math.min(3,Math.max(2.1,zoom)));camX=(hero.x+w.x)/2-VW/zoom/2;camY=(hero.y+w.y)/2-VH/zoom/2;
  draw();const backdrop=document.createElement('canvas');backdrop.width=cv.width;backdrop.height=cv.height;backdrop.getContext('2d').drawImage(cv,0,0);session.backdrop=backdrop;
  el('tideBattleFx').hidden=false;el('tideBattleLog').innerHTML='';el('tideActions').hidden=false;el('tideActions').style.display='';el('tideResult').hidden=true;
  el('tideAttack').onclick=()=>act('attack');el('tidePower').onclick=()=>act('power');el('tideRetreat').onclick=retreat;
  appendLog('Choose one attack or power each round. The wild Tide then takes its turn.');battleHud();paintBattle();saveNow();
 }
 function battleHud(){
  if(!session)return;const b=session.animation?.display||session.battle;
  for(const [side,prefix]of [['player','tidePlayer'],['foe','tideFoe']]){const u=b[side],s=species(u.speciesId);el(prefix+'Name').innerHTML=html(s.name)+' · Lv '+u.level+stars(s);el(prefix+'Hp').style.width=Math.max(0,u.hp/u.maxHp*100)+'%';el(prefix+'HpText').textContent=Math.max(0,Math.round(u.hp))+' / '+u.maxHp;el(prefix+'Status').textContent=[u.shield>0?'Shield '+u.shield:'',u.buffTurns>0?'Empowered '+u.buffTurns+' turns':'',u.poisonTurns>0?'Lingering damage '+u.poisonTurns+' turns':'',u.weakenTurns>0?'Weakened '+u.weakenTurns+' turns':''].filter(Boolean).join(' · ');}
  const s=species(b.player.speciesId),busy=!!session.animation||!!session.result;
  el('tideTurn').textContent='Round '+b.turn;
  el('tideAttack').innerHTML='<b>'+html(s.attack.name)+'</b><small>'+html(s.attack.description)+'</small>';
  el('tidePower').innerHTML='<b>'+html(s.skill.name)+'</b><small>'+html(s.skill.description)+(b.player.powerCooldown?' · Ready in '+b.player.powerCooldown+' attacks':'')+'</small>';
  el('tideAttack').disabled=busy;el('tidePower').disabled=busy||b.player.powerCooldown>0;el('tideRetreat').disabled=busy;
 }
 function act(choice){
  if(!session||session.animation||session.result||gamePaused)return;
  const display={player:{...session.battle.player},foe:{...session.battle.foe},turn:session.battle.turn};
  const result=Tides.act(session.battle,choice);if(!result.ok)return;
  initAudio();
  const moves=result.events.filter(e=>e.type==='attack'||e.type==='power');
  let moveIndex=-1,eventTime=0;
  const events=result.events.map(e=>{
   if(e.type==='attack'||e.type==='power'){moveIndex++;eventTime=moveIndex*.85+.08;}
   else if(e.type==='result'||e.type==='limit')eventTime=Math.max(1,moves.length)*.85+.1;
   else eventTime=Math.max(eventTime+.035,Math.max(0,moveIndex)*.85+.43);
   return {...e,at:eventTime};
  });
  session.animation={elapsed:0,duration:Math.max(1,moves.length)*.85+.2,moves,events,shown:0,display};
  if(result.outcome){session.result=Tides.finishBattle(S.tides,session.battle);saveNow();entry();}
  battleHud();
 }
 function battleSound(e,a){
  if(!['attack','power','damage'].includes(e.type))return;
  const action=e.type==='damage'?a.moves.find(m=>m.side===e.side):e;
  if(!action)return;
  const s=species(a.display[e.side].speciesId),power=action.type==='power',move=power?s.skill:s.attack;
  // Consume sounds with the combat timeline, so repainting cannot repeat a hit.
  if(e.type==='damage')sfx.tideImpact(move.style,power);
  else if(power&&!move.damage)sfx.tidePower();
  else sfx.tideCast(move.style,power);
 }
 function retreat(){
  if(!session||session.animation||session.result||gamePaused)return;
  if(!session.retreatAsked){session.retreatAsked=true;appendLog('Retreat counts as a defeat.'+(Tides.INJURY_MS?' Your Tide will need two hours of rest.':'')+' Click Retreat again to leave.');return;}
  session.result=Tides.abandonBattle(S.tides,session.battle);saveNow();entry();showResult();
 }
 function showResult(){
  if(!session||session.shownResult||!session.result?.ok)return;session.shownResult=true;
  const r=session.result,won=r.outcome==='win';el('tideActions').style.display='none';el('tideResult').hidden=false;
  el('tideResult').innerHTML=won?`<h3>A new bond!</h3><div><b>${html(species(r.captured.speciesId).name)}</b> · Level ${r.captured.level} joined your Tide storage.</div><div>${html(species(r.pet.speciesId).name)} earned ${r.xp} XP${r.levels?' and reached level '+r.pet.level:''}.</div><button class="sbtn gold" id="tideContinue">Continue exploring</button><button class="sbtn" id="tideResultStorage">Tide storage</button>`:`<h3>${Tides.INJURY_MS?'Time to recover':'Defeat'}</h3><div>${html(species(r.pet.speciesId).name)} ${Tides.INJURY_MS?'is injured and needs two hours of rest.':'is ready to battle again.'}</div><div>${Tides.INJURY_MS?'You can equip another healthy Tide from storage.':'Try again or choose another Tide from storage.'}</div><button class="sbtn gold" id="tideContinue">Return to Wasteland</button><button class="sbtn" id="tideResultStorage">Tide storage</button>`;
  el('tideContinue').onclick=closeBattle;el('tideResultStorage').onclick=()=>{closeBattle();openStorage();};sfx[won?'loot':'warn']?.();battleHud();
 }
 function closeBattle(){
  if(!session)return;if(!session.result){Tides.abandonBattle(S.tides,session.battle);saveNow();}
  const old=session;session=null;el('tideBattleFx').hidden=true;setZoom(old.oldZoom);camX=old.oldCamX;camY=old.oldCamY;stopHero();entry();
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
  if(session.backdrop){const k=Math.max(w/session.backdrop.width,h/session.backdrop.height)*(1.035-Math.min(1,session.time/.65)*.035),bw=session.backdrop.width*k,bh=session.backdrop.height*k;g.drawImage(session.backdrop,(w-bw)/2,(h-bh)/2,bw,bh);}
  g.fillStyle='rgba(22,22,9,.12)';g.fillRect(0,0,w,h);
  const shade=g.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(4,8,5,.52)');shade.addColorStop(.35,'rgba(4,8,5,0)');shade.addColorStop(.75,'rgba(4,8,5,.1)');shade.addColorStop(1,'rgba(4,8,5,.55)');g.fillStyle=shade;g.fillRect(0,0,w,h);
  const b=session.animation?.display||session.battle,anim=session.animation,layout=battleLayout(w,h,b.player.speciesId,b.foe.speciesId),{floor,left,right}=layout,ps=layout.player,fs=layout.foe;
  let lx=left,rx=right,ly=floor,ry=floor,actor=null,progress=0,style='melee',color='#ddd',hit=0;
  if(anim){const index=Math.min(anim.moves.length-1,Math.floor(anim.elapsed/.85));actor=anim.moves[index];progress=Math.max(0,Math.min(1,(anim.elapsed-index*.85)/.85));if(actor){const s=species(b[actor.side].speciesId),move=actor.type==='power'?s.skill:s.attack;style=move.style;color=move.color;hit=Math.sin(Math.PI*Math.max(0,(progress-.45)/.55));if(style==='melee'){const p=Math.sin(Math.PI*progress),travel=layout.travel*p;if(actor.side==='player'){lx+=travel;ly-=Math.sin(progress*Math.PI*3)*9*p;}else{rx-=travel;ry-=Math.sin(progress*Math.PI*3)*9*p;}}}}
  // The player's own race, armor and weapon remain visible behind the left Tide.
  g.save();g.translate(layout.heroX,floor-5);g.scale(layout.heroScale,layout.heroScale);const f=paintedCharacterFrame(S.race,S.cls,S.gender==='f',isIce(S.gear.armor));if(f)bootFeet({...f.boots,moving:false,walk:0,bob:0},g);drawChampionSprite(g,S.race,S.cls,1,0,0,isFK(S.gear.weapon),isFG(S.gear.weapon)?'felglaives':isFK(S.gear.weapon)?'rimfrost':null,S.gender==='f',1,isIce(S.gear.armor),null);g.restore();
  drawAnimal(g,b.player.speciesId,lx,ly,ps.height,1,actor?.side==='player'&&style==='melee'?Math.sin(progress*Math.PI):0,progress*Math.PI*8,b.player.hp<=0&&session.shownResult?.6:1,session.time,b.player.hp>0);
  drawAnimal(g,b.foe.speciesId,rx,ry,fs.height,-1,actor?.side==='foe'&&style==='melee'?Math.sin(progress*Math.PI):0,progress*Math.PI*8,b.foe.hp<=0&&session.shownResult?.5:1,session.time+1.7,b.foe.hp>0);
  if(actor&&style==='magic'){
   const friendly=actor.side==='player',s=species(b[actor.side].speciesId),self=actor.type==='power'&&!s.skill.damage,ownSize=friendly?ps:fs,targetSize=self?ownSize:friendly?fs:ps,ownX=friendly?left:right;
   const from=self?ownX:ownX+(friendly?1:-1)*ownSize.width*.28,to=self?from:(friendly?right-fs.width*.25:left+ps.width*.25),fromY=floor-ownSize.height*.58,toY=floor-targetSize.height*.5;
   const p=Math.min(1,progress*1.55),px=from+(to-from)*p,py=fromY+(toY-fromY)*p-Math.sin(p*Math.PI)*Math.min(ownSize.height,targetSize.height)*.28;
   g.save();g.strokeStyle=color;g.fillStyle=color;g.shadowColor=color;g.shadowBlur=15;g.globalAlpha=Math.sin(progress*Math.PI);g.lineWidth=3;
   if(self){g.beginPath();g.ellipse(from,floor-ownSize.height*.42,ownSize.width*.48,ownSize.height*.55,0,0,Math.PI*2);g.stroke();}else{g.beginPath();g.arc(px,py,8+Math.sin(progress*20)*2,0,Math.PI*2);g.fill();for(let i=1;i<5;i++){g.globalAlpha*=.72;g.beginPath();g.arc(px-(to-from)*.022*i,py+i*2,6-i,0,Math.PI*2);g.fill();}}g.restore();
  }
  if(actor&&progress>.5&&progress<.8&&(actor.type==='attack'||species(b[actor.side].speciesId).skill.damage)){const target=actor.side==='player'?fs:ps,x=actor.side==='player'?right-fs.width*.25:left+ps.width*.25,size=Math.min(target.height,target.width);g.save();g.strokeStyle=color;g.lineWidth=2;g.globalAlpha=hit*.7;for(let i=0;i<6;i++){const a=i*Math.PI/3;g.beginPath();g.moveTo(x+Math.cos(a)*size*.12,floor-target.height*.5+Math.sin(a)*size*.12);g.lineTo(x+Math.cos(a)*size*.3,floor-target.height*.5+Math.sin(a)*size*.3);g.stroke();}g.restore();}
 }
 function tick(dt){
  clockTick+=dt;motionClock+=dt;
  if(clockTick>=1&&hubMode==='wild'&&el('tideChallenge')){const p=owned();el('tideChallenge').disabled=!p||remaining(p)>0;if(el('tideWildReady'))el('tideWildReady').textContent=restText(p);}
  if(clockTick>=1){clockTick=0;refreshStorageValues();}
  if(!session)return;session.time+=dt;
  const a=session.animation;if(a){
   a.elapsed+=dt;
   while(a.shown<a.events.length&&a.events[a.shown].at<=a.elapsed){
    const e=a.events[a.shown++],u=a.display[e.targetSide];appendLog(e.text);battleSound(e,a);
    if(u){if(['damage','poison','recoil'].includes(e.type))u.hp=Math.max(0,u.hp-e.amount);else if(e.type==='heal')u.hp=Math.min(u.maxHp,u.hp+e.amount);else if(e.type==='shield')u.shield+=e.amount;}
    battleHud();
   }
   if(a.elapsed>=a.duration){while(a.shown<a.events.length)appendLog(a.events[a.shown++].text);session.animation=null;session.retreatAsked=false;battleHud();if(session.result)showResult();}
  }
  paintBattle();
 }
 function nearestWild(){return wildList().filter(w=>Math.hypot(hero.x-w.x,hero.y-w.y)<180).sort((a,b)=>Math.hypot(hero.x-a.x,hero.y-a.y)-Math.hypot(hero.x-b.x,hero.y-b.y))[0]||null;}
 function afterDraw(){
  if(!session?.backdrop||session.time>2||session.time<(session.nextBackdrop||0))return;
  session.nextBackdrop=session.time+.25;session.backdrop.getContext('2d').drawImage(cv,0,0);paintBattle();
 }
 return {entry,bagItem,bindBag,openChurch,churchInReach,openStorage,renderStoragePage,storageOpen,storageBack,openWild,wildClick,nearestWild,updateExploration,addWildDrawables,modalOpen,isBattling:()=>!!session,begin,act,retreat,closeHub,closeBattle,leaveZone,awardKill,tick,paintBattle,afterDraw,frameFor,drawAnimal,paintIcons,animalVisual,wildBounds,battleLayout};
})();
