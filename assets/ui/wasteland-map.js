/* A north-up, non-interactive overview for the existing Map panel. All terrain,
 * roads and positions come from the current world. No DOM, images or cache. */
(function(root){
 'use strict';
 const WIDTH=600,HEIGHT=360,PAD=30;
 const names={wasteland:'Wasteland',briarhollow:'Briarhollow',cindervein:'Cindervein',frostveil:'Frostveil'};
 const colors={wasteland:['#283425','#75825b'],briarhollow:['#202e23','#657852'],cindervein:['#35251f','#9a7250'],frostveil:['#243441','#7692a4']};
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const point=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const n=v=>Number(v.toFixed(2));
 function projection(world){
  if(!world||!Number.isFinite(world.w)||!Number.isFinite(world.h)||world.w<=0||world.h<=0)return null;
  const scale=Math.min((WIDTH-2*PAD)/world.w,(HEIGHT-2*PAD)/world.h);
  if(!Number.isFinite(scale)||scale<=0)return null;
  const x=(WIDTH-world.w*scale)/2,y=(HEIGHT-world.h*scale)/2;
  return {scale,x,y,at:p=>point(p)?{x:n(x+clamp(p.x,0,world.w)*scale),y:n(y+clamp(p.y,0,world.h)*scale)}:null};
 }
 function label(p,text){
  const anchor=p.x>WIDTH*.64?'end':p.x<WIDTH*.24?'start':'middle';
  const y=p.y>HEIGHT-65?p.y-23:p.y+34;
  return `<text x="${p.x}" y="${n(y)}" text-anchor="${anchor}" fill="#f3e2bc" stroke="#1d211a" stroke-width="5" paint-order="stroke" font-size="24" font-family="Georgia,serif">${escape(text)}</text>`;
 }
 function badge(p,kind,text,color){
  const icon=kind==='home'?'<path d="M-11 1L0-9L11 1M-8-1V10H8V-1M-2 10V3H3V10"/>':
   kind==='cave'?'<path d="M-12 9L-7-4L1-11L9-4L13 9ZM-4 9V3Q0-5 5 3V9"/>':
   kind==='dead'?'<path d="M-7 0L-2 6L8-7"/>':`<text y="7" fill="${color}" stroke="none" font-family="Georgia,serif" font-size="21" text-anchor="middle">${text}</text>`;
  return `<g transform="translate(${p.x} ${p.y})" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle r="17" fill="#24241f" stroke-width="2"/>${icon}</g>`;
 }
 function render(world,hero,enemies=[]){
  const key=world&&(world.dungeon||world.key||(world.wasteland?'wasteland':null)),map=projection(world);
  if(!names[key]||!map)return '';
  const dungeon=key!=='wasteland',palette=colors[key],id='wasteland-map-'+key;
  const layers=[],legend=[],description=['North is up.'];
  const bounds={x:n(map.x),y:n(map.y),w:n(world.w*map.scale),h:n(world.h*map.scale)};
  layers.push(`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" rx="4" fill="${palette[0]}" stroke="#a28b61" stroke-opacity=".45"/>`);
  if(dungeon){
   for(const r of world.floors||[]){
    if(!point(r)||!Number.isFinite(r.w)||!Number.isFinite(r.h)||r.w<=0||r.h<=0)continue;
    const a=map.at(r),b=map.at({x:r.x+r.w,y:r.y+r.h});if(!a||!b)continue;
    layers.push(`<rect data-floor="true" x="${a.x}" y="${a.y}" width="${n(b.x-a.x)}" height="${n(b.y-a.y)}" fill="${palette[1]}"/>`);
   }
   for(const e of world.wallEdges||[]){
    if(!point(e)||!Number.isFinite(e.w)||!Number.isFinite(e.h))continue;
    const a=map.at(e),b=map.at({x:e.x+e.w,y:e.y+e.h});if(a&&b)layers.push(`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#d4c29a" stroke-opacity=".45" stroke-width="1"/>`);
   }
   const def=root.WastelandDungeons&&root.WastelandDungeons.definitions[key];
   for(const room of world.bossRooms||[]){
    const en=(Array.isArray(enemies)?enemies:[]).find(e=>e&&e.boss&&e.dungeon===key&&e.dungeonIndex===room.index);
    const p=map.at(point(en)?en:{x:room.cx,y:room.cy});if(!p)continue;
    const name=en&&en.name||def&&def.bosses[room.index]&&def.bosses[room.index].name||'Boss '+(room.index+1);
    const dead=!!(en&&en.dead),status=dead?'Defeated':'Alive',color=dead?'#b0d6a1':'#f1b18c';
    layers.push(`<g data-boss="${room.index}" data-status="${status.toLowerCase()}"><title>${escape(name+' — '+status)}</title>${badge(p,dead?'dead':'boss',room.index+1,color)}</g>`);
    legend.push(`<li><span style="color:${color}">${room.index+1} · ${escape(name)}</span> <span style="color:#d8c7aa">— ${status}</span></li>`);
    description.push(name+': '+status+'.');
   }
  }else{
   for(const [i,road] of (world.paths||[]).entries()){
    // Break at an invalid point; never invent a connecting road across a gap.
    let segment=[];
    const emit=()=>{if(segment.length>1)layers.push(`<polyline data-road="${i}" points="${segment.join(' ')}" fill="none" stroke="#d4ba83" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);segment=[];};
    for(const p of road.points||[]){const q=map.at(p);if(q)segment.push(q.x+','+q.y);else emit();}emit();
   }
   const entrances=world.entrances||root.WastelandWorld&&root.WastelandWorld.ENTRANCES||[];
   for(const [i,e] of entrances.entries()){
    const p=map.at(e);if(!p)continue;
    const name=names[e.id||e.key]||e.name||'Cave';
    layers.push(`<g data-entrance="${escape(e.id||e.key||i)}"><title>${escape(name)}</title>${badge(p,'cave','', '#e1c18a')}${label(p,name)}</g>`);
    legend.push(`<li><span style="color:#e1c18a">◇</span> ${escape(name)}</li>`);description.push(name+' entrance.');
   }
  }
  const exit=map.at(world.exit||world.spawn),exitName=dungeon?'Wasteland':'Home';
  if(exit){layers.push(`<g data-exit="true"><title>${exitName}</title>${badge(exit,'home','','#e9dcb8')}${label(exit,exitName)}</g>`);description.push('Exit to '+exitName+'.');}
  const player=map.at(hero);
  if(player){
   layers.push(`<g data-player="true" transform="translate(${player.x} ${player.y})"><title>You are here</title><circle r="12" fill="#65dce5" fill-opacity=".24"/><circle r="6.5" fill="#edffff" stroke="#26737c" stroke-width="2.5"/></g>`);
   description.push('Your current position is the pale blue dot.');
  }else description.push('Player position unavailable.');
  const subtitle=dungeon?'Dungeon overview':'Wilderness overview';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="${id}-title ${id}-desc" style="display:block;width:100%;height:auto;margin:8px 0;background:#1b201a;border:1px solid #796242;border-radius:7px;box-sizing:border-box"><title id="${id}-title">${names[key]} — ${subtitle}</title><desc id="${id}-desc">${escape(description.join(' '))}</desc>${layers.join('')}<g transform="translate(567 23)" fill="#dfcda4" stroke="#dfcda4"><path d="M0 25V8M-5 14L0 7L5 14" fill="none" stroke-width="1.6"/><text y="2" text-anchor="middle" stroke="none" font-size="17" font-family="Georgia,serif">N</text></g></svg>`;
  const keyText=`<div style="display:flex;flex-wrap:wrap;gap:5px 14px;color:#d8c7aa;font-size:12px"><span><span style="color:#a2edf2">●</span> ${player?'You':'Position unavailable'}</span><span>⌂ ${exitName}</span><span>${dungeon?'Number · boss; ✓ defeated':'━ Road; ◇ cave'}</span></div>`;
  return `<figure class="card wasteland-map" style="margin:0 0 12px;padding:12px;box-sizing:border-box;max-width:760px;background:linear-gradient(160deg,#3a3023,#25241b);border-color:#977b50"><figcaption style="font-family:var(--display,Georgia,serif);font-size:17px;color:#f0dfbb">${names[key]} <span style="font-family:inherit;font-size:11px;color:#cab996">· ${subtitle}</span></figcaption>${svg}${keyText}<ul aria-label="${dungeon?'Bosses':'Cave entrances'}" style="list-style:none;padding:0;margin:9px 0 0;display:grid;gap:5px;font-size:13px;line-height:1.4;color:#ecddbf">${legend.join('')}</ul></figure>`;
 }
 const api=Object.freeze({render});root.WastelandMap=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
