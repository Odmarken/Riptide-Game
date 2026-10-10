/* 🌳 The Skill Tree window (2026-10-10): the tree of assets/tree/skill-tree.js drawn the way the inspiration draws it - round
   talents change a number, square ones change a spell, an octagon is a choice of two, the star at the bottom of each side is its
   capstone; a badge counts the ranks, the lines between talents light up when the way is open, and a dashed line marks every gate.
   Pointing at a talent reads it in the panel beside the tree. A mouse click learns at once; a tap, the pad's A or a pen first
   shows the talent, and a second press (or the panel's button) learns it. A choice is made from its two options in the panel, or
   by clicking the half that shows the one wanted. Every rule lives in SkillTree: this file only draws and asks. */
(function(root){
 'use strict';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const shapeOf=(T,n)=>T.isCap(n)?'star':T.isChoice(n)?'oct':n.sp?'square':'round';
 /* the window's grid rows: the two shared rows, the 8 gate, the sides' names, their two upper rows, the 20 gate, the two lower rows,
    the 30 gate and the capstones */
 const ROW={0:1,1:2,2:5,3:6,4:8,5:9,6:11},GATE_ROW={2:3,4:7,6:10},SIDE_ROW=4;
 function create({doc=root.document,host,tree:T,get,onLearn,onReset,iconUrl,say}={}){
  /* get(): {state, cls, className, prestige, locked (a reason learning is barred now, or ''), sides: {def,off}} */
  let open=false,sel=null,drawn=null;
  const el=id=>doc.getElementById(id);
  function points(g){return T.points(g.prestige);}
  function stateOf(g,n){
   const st=g.state,r=T.rank(st,n.id),max=T.maxOf(n);
   if(r>=max)return 'full';
   const pts=points(g),c=T.check(st,g.cls,n.id,T.isChoice(n)?n.opts[0].id:undefined,pts);
   if(c.ok)return r?'part':'open';
   /* not learnable: blocked only by the points (dim gold), or by the tree itself (locked) */
   const free=T.check(st,g.cls,n.id,T.isChoice(n)?n.opts[0].id:undefined,T.CAP);
   if(free.ok&&!g.locked)return r?'part':'wait';
   if(T.isCap(n)&&T.nodes(g.cls).some(m=>T.isCap(m)&&m!==n&&T.rank(st,m.id)))return 'sealed';
   return r?'part':'locked';
  }
  function iconOf(id){return iconUrl?iconUrl(id):'';}
  function nodeHtml(g,n){
   const s=stateOf(g,n),shape=shapeOf(T,n),r=T.rank(g.state,n.id),max=T.maxOf(n),pick=T.pick(g.state,n.id);
   let face;
   if(T.isChoice(n)){
    const chosen=n.opts.find(o=>o.id===pick);
    face=chosen?`<img src="${iconOf(chosen.id)}" alt="" draggable="false">`
     :`<span class="tn-half l" data-opt="${n.opts[0].id}"><img src="${iconOf(n.opts[0].id)}" alt="" draggable="false"></span><span class="tn-half r" data-opt="${n.opts[1].id}"><img src="${iconOf(n.opts[1].id)}" alt="" draggable="false"></span>`;
   }else face=`<img src="${iconOf(n.id)}" alt="" draggable="false">`;
   const label=T.isChoice(n)?(pick?n.opts.find(o=>o.id===pick).n:n.opts.map(o=>o.n).join(' or ')):n.n;
   return `<button class="tn tn-${shape} tn-${s}${sel===n.id?' tn-sel':''}" data-node="${n.id}" style="grid-row:${ROW[n.row]};grid-column:${n.col+1}" aria-label="${esc(label)} ${r}/${max}">`
    +`<span class="tn-face">${face}</span>${T.isCap(n)?'<span class="tn-badge" aria-hidden="true">★</span>':''}<span class="tn-rank">${r}/${max}</span></button>`;
  }
  function gateHtml(g,row,label){
   const above=T.nodes(g.cls).filter(m=>m.row<row).reduce((t,m)=>t+T.rank(g.state,m.id),0),met=above>=T.GATES[row];
   return `<div class="tg${met?' tg-met':''}" style="grid-row:${GATE_ROW[row]};grid-column:1/-1" aria-hidden="true"><span>${label}</span></div>`;
  }
  function sideHtml(g,key,col){
   const s=g.sides[key];
   return `<div class="ts ts-${key}" style="grid-row:${SIDE_ROW};grid-column:${col}/span 3"><img src="${iconOf(s.emblem)}" alt="" draggable="false"><div><b>${esc(s.n)}</b><small>${esc(s.d)}</small></div></div>`;
  }
  function render(){
   if(!open)return;
   const g=get();if(!g||!g.cls)return;
   const box=el('treeGrid');if(!box)return;
   const list=T.nodes(g.cls),pts=points(g),spent=T.spent(g.state);
   el('treeClass').textContent=g.className;
   el('treePts').innerHTML=`Points spent <b>${spent}</b> / ${pts}`;
   el('treeReset').disabled=!spent;
   box.innerHTML=sideHtml(g,'def',1)+sideHtml(g,'off',5)
    +gateHtml(g,2,T.GATES[2]+' required')+gateHtml(g,4,T.GATES[4]+' required')+gateHtml(g,6,T.GATES[6]+' required')
    +list.map(n=>nodeHtml(g,n)).join('');
   box.classList.toggle('tree-empty',!pts);
   for(const b of box.querySelectorAll('[data-node]')){
    const id=b.dataset.node;
    b.addEventListener('mouseenter',()=>info(id));
    b.addEventListener('focus',()=>info(id));
    b.addEventListener('click',e=>press(id,e));
   }
   lines(g);
   info(sel||null);
  }
  /* the lines from each talent to the ones it opens, lit once the way is open */
  function lines(g){
   const box=el('treeGrid'),svg=el('treeLines');if(!box||!svg)return;
   const at={},o=box.getBoundingClientRect();
   for(const b of box.querySelectorAll('[data-node]')){const r=b.getBoundingClientRect();at[b.dataset.node]={x:r.left-o.left+r.width/2,y:r.top-o.top+r.height/2,h:r.height/2};}
   svg.setAttribute('width',box.scrollWidth);svg.setAttribute('height',box.scrollHeight);
   let h='';
   for(const n of T.nodes(g.cls)){
    if(!n.req)continue;
    for(const p of [].concat(n.req)){
     const a=at[p],b=at[n.id];if(!a||!b)continue;
     const lit=T.rank(g.state,p)>=T.maxOf(T.node(g.cls,p)),on=lit&&T.rank(g.state,n.id)>0;
     h+=`<line x1="${a.x}" y1="${a.y+a.h}" x2="${b.x}" y2="${b.y-b.h}" class="${on?'tl-on':lit?'tl-lit':'tl-off'}"/>`;
    }
   }
   svg.innerHTML=h;
   drawn={w:box.clientWidth,h:box.clientHeight};
  }
  function info(id){
   const g=get(),panel=el('treeInfo');if(!panel||!g)return;
   const n=id&&T.node(g.cls,id);
   if(!n){panel.innerHTML=`<p class="ti-hint">${points(g)?(g.touch?'Tap a talent to read it.':'Point at a talent to read it.'):'Every prestige gives one point, up to 40.'}</p>`;return;}
   const r=T.rank(g.state,n.id),max=T.maxOf(n),pts=points(g),why=g.locked||'';
   let h=`<div class="ti-head"><img src="${iconOf(T.isChoice(n)?(T.pick(g.state,n.id)||n.opts[0].id):n.id)}" alt="" draggable="false"><div><b>${esc(T.isChoice(n)?(n.opts.find(o=>o.id===T.pick(g.state,n.id))||{n:n.n}).n:n.n)}</b><span>Rank ${r}/${max}</span></div></div>`;
   if(T.isChoice(n)){
    const picked=T.pick(g.state,n.id);
    h+=`<p class="ti-note">Choose one of the two.</p>`;
    for(const o of n.opts){
     const c=T.check(g.state,g.cls,n.id,o.id,pts),mine=picked===o.id;
     h+=`<div class="ti-opt${mine?' ti-mine':''}"><img src="${iconOf(o.id)}" alt="" draggable="false"><div><b>${esc(o.n)}</b><p>${esc(o.d)}</p>`
      +(picked?'':`<button class="sbtn${c.ok&&!why?' gold':''}" data-pick="${o.id}"${c.ok&&!why?'':' disabled'}>Choose</button>`)+`</div></div>`;
    }
    const c=T.check(g.state,g.cls,n.id,n.opts[0].id,pts);
    if(!picked&&(why||!c.ok))h+=`<p class="ti-why">${esc(why||c.why)}</p>`;
   }else{
    h+=`<p class="ti-now">${esc(r?T.text(n,r):T.text(n,1))}</p>`;
    if(r&&r<max)h+=`<p class="ti-next">Next rank: ${esc(T.text(n,r+1))}</p>`;
    const c=T.check(g.state,g.cls,n.id,undefined,pts);
    if(r<max){
     if(why||!c.ok)h+=`<p class="ti-why">${esc(why||c.why)}</p>`;
     h+=`<button class="sbtn${c.ok&&!why?' gold':''}" data-learn="${n.id}"${c.ok&&!why?'':' disabled'}>${r?'Learn rank '+(r+1):'Learn'}</button>`;
    }
   }
   panel.innerHTML=h;
   panel.querySelector('[data-learn]')?.addEventListener('click',()=>learn(n.id));
   for(const b of panel.querySelectorAll('[data-pick]'))b.addEventListener('click',()=>learn(n.id,b.dataset.pick));
  }
  function learn(id,opt){
   const g=get();if(!g)return;
   if(g.locked){say&&say(g.locked);return;}
   const n=T.node(g.cls,id);if(!n)return;
   if(T.isChoice(n)&&!opt){sel=id;info(id);return;}
   const c=T.check(g.state,g.cls,id,opt,points(g));
   if(!c.ok){say&&say(c.why);return;}
   sel=id;onLearn&&onLearn(id,opt);
   render();
  }
  function press(id,e){
   const g=get();if(!g)return;
   const n=T.node(g.cls,id);if(!n)return;
   const mouse=e&&e.pointerType==='mouse'||(e&&e.detail>0&&!e.pointerType&&lastPointer==='mouse');
   const half=e&&e.target&&e.target.closest&&e.target.closest('[data-opt]');
   if(T.isChoice(n)){
    if(mouse&&half&&!T.pick(g.state,id)){learn(id,half.dataset.opt);return;}
    sel=id;render();return;
   }
   if(mouse||sel===id){learn(id);return;}
   sel=id;render();
  }
  let lastPointer='mouse';
  function wire(){
   const hostEl=host||el('treeFx');if(!hostEl||hostEl.__wired)return;hostEl.__wired=true;
   hostEl.addEventListener('pointerdown',e=>{lastPointer=e.pointerType||'mouse';},true);
   el('treeClose')?.addEventListener('click',close);
   el('treeReset')?.addEventListener('click',()=>{const g=get();if(!g)return;if(g.locked){say&&say(g.locked);return;}onReset&&onReset(()=>{sel=null;render();});});
   hostEl.addEventListener('click',e=>{if(e.target===hostEl)close();});   /* the dark round the window closes it, as the other windows do */
   root.addEventListener?.('resize',()=>{if(open){const g=get();if(g)lines(g);}});
  }
  function show(){
   wire();
   const h=host||el('treeFx');if(!h)return;
   open=true;sel=null;h.style.display='flex';
   const g=get();if(g)h.dataset.cls=g.cls;
   render();
   root.requestAnimationFrame?.(()=>{const g2=get();if(open&&g2)lines(g2);});   /* the lines once the grid has its size */
  }
  function close(){const h=host||el('treeFx');open=false;if(h)h.style.display='none';}
  return {open:show,close,render,isOpen:()=>open,select:id=>{sel=id;render();},_stateOf:(g,n)=>stateOf(g,n)};
 }
 const api={create,shapeOf,ROW,GATE_ROW,SIDE_ROW};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.SkillTreeUI=api;
})(typeof window!=='undefined'?window:globalThis);
