/* ☀ The day-and-night bar (2026-10-09), after Skyrim's compass: "en sånhär inspirerad natt cycle för dag och natt ... fast mitt
 * färgschema, den ska va ovanför gpsen", as wide as the minimap. A band in the game's bronze with knotted, pointed ends; behind
 * it the sky slides past a needle that stands at NOW - what is coming on the left, what has gone on the right, so the sun crosses
 * the bar from left to right just as it crosses the screen. The sun marks noon and the moon midnight; the colours are the game's
 * own darkness curve (sunDarkAt) as day, twilight and night, and the stars come out with the dark. The window is 45 minutes wide:
 * at noon, dawn and dusk lie just beyond its ends; the night (15 minutes) shows whole. Shown wherever the day comes and goes. */
(function(root){
 'use strict';
 const W=156,H=26,CX=W/2,X0=16,X1=W-16,Y0=6,Y1=20,SPAN=2700,PPS=(X1-X0)/SPAN;   /* its own units, scaled by CSS (6:1); PPS: units a second */
 const DAY=[150,112,58],TWILIGHT=[140,66,54],NIGHT=[22,30,60];   /* the sky, muted to sit in the bronze */
 const STARS=[[.05,.3],[.13,.72],[.22,.42],[.3,.18],[.7,.66],[.78,.28],[.86,.78],[.95,.45]];   /* [how far into the night, how far down]: none by the moon */
 const mix=(a,b,f)=>a.map((v,i)=>Math.round(v+(b[i]-v)*f));
 function skyRGB(d){return d<=.4?mix(DAY,TWILIGHT,d/.4):mix(TWILIGHT,NIGHT,Math.min(1,(d-.4)/.6));}
 /* where something e seconds into the day stands on the bar at t: ahead of now on the left */
 function place(e,t,cyc){let d=((e-t)%cyc+cyc)%cyc;if(d>cyc/2)d-=cyc;return CX-d*PPS;}
 function tipText(t,day,night){
  const up=t<day,left=Math.max(1,Math.ceil(((up?day:day+night)-t)/60));
  return up?'Day · dusk in '+left+' min':'Night · dawn in '+left+' min';
 }
 function sun(g,x,y){
  if(x<X0-16||x>X1+16)return;
  const glow=g.createRadialGradient(x,y,0,x,y,16);glow.addColorStop(0,'rgba(255,224,150,.55)');glow.addColorStop(1,'rgba(255,224,150,0)');
  g.fillStyle=glow;g.fillRect(x-16,Y0,32,Y1-Y0);
  g.strokeStyle='#f6cf74';g.lineWidth=1.1;g.lineCap='round';g.beginPath();
  for(let i=0;i<8;i++){const a=i*Math.PI/4;g.moveTo(x+Math.cos(a)*4.7,y+Math.sin(a)*4.7);g.lineTo(x+Math.cos(a)*6.3,y+Math.sin(a)*6.3);}
  g.stroke();
  const disc=g.createRadialGradient(x-1,y-1,0,x,y,3.6);disc.addColorStop(0,'#fff6d6');disc.addColorStop(.6,'#ffd77e');disc.addColorStop(1,'#e9a93e');
  g.fillStyle=disc;g.beginPath();g.arc(x,y,3.5,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(90,52,16,.7)';g.lineWidth=.6;g.stroke();
 }
 function moon(g,x,y){
  if(x<X0-14||x>X1+14)return;
  const glow=g.createRadialGradient(x,y,0,x,y,12);glow.addColorStop(0,'rgba(178,196,240,.38)');glow.addColorStop(1,'rgba(178,196,240,0)');
  g.fillStyle=glow;g.fillRect(x-12,Y0,24,Y1-Y0);
  g.save();g.beginPath();g.arc(x,y,4.4,0,Math.PI*2);g.clip();
  g.beginPath();g.rect(x-5,y-5,10,10);g.arc(x+2.3,y-1.3,3.8,0,Math.PI*2,true);   /* the square less the bite: a crescent inside the clip */
  g.fillStyle='#ece4cc';g.fill();g.restore();
 }
 function sky(g,t,day,night,dark){   /* the strip: the hours ahead and behind, the stars, the sun and the moon, fading at both ends */
  const cyc=day+night;
  for(let x=X0;x<X1;x++){
   const c=skyRGB(dark(((t+(CX-x-.5)/PPS)%cyc+cyc)%cyc));
   g.fillStyle='rgb('+c[0]+','+c[1]+','+c[2]+')';g.fillRect(x,Y0,1.05,Y1-Y0);
  }
  const sheen=g.createLinearGradient(0,Y0,0,Y1);
  sheen.addColorStop(0,'rgba(255,236,196,.16)');sheen.addColorStop(.5,'rgba(255,236,196,0)');sheen.addColorStop(1,'rgba(0,0,0,.3)');
  g.fillStyle=sheen;g.fillRect(X0,Y0,X1-X0,Y1-Y0);
  for(const [f,yf]of STARS){
   const e=day+f*night,x=place(e,t,cyc),a=Math.max(0,Math.min(1,(dark(e)-.5)/.35));
   if(!a||x<X0||x>X1)continue;
   g.fillStyle='rgba(238,234,216,'+(.85*a).toFixed(3)+')';g.beginPath();g.arc(x,Y0+2+yf*(Y1-Y0-4),.65,0,Math.PI*2);g.fill();
  }
  sun(g,place(day/2,t,cyc),(Y0+Y1)/2);
  moon(g,place(day+night/2,t,cyc),(Y0+Y1)/2);
  g.globalCompositeOperation='destination-in';
  const fade=g.createLinearGradient(X0,0,X1,0);
  fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(.11,'#000');fade.addColorStop(.89,'#000');fade.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=fade;g.fillRect(0,0,W,H);g.globalCompositeOperation='source-over';
 }
 function outline(g,pts){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();}
 function cap(g){   /* the left end - pointed, bronze, a knot of four rings in it; the right end is the same, mirrored */
  outline(g,[[18,2.4],[9.5,2.4],[1.2,13],[9.5,23.6],[18,23.6]]);
  const metal=g.createLinearGradient(0,2,0,24);metal.addColorStop(0,'#8a6438');metal.addColorStop(.45,'#4f3620');metal.addColorStop(1,'#241811');
  g.fillStyle=metal;g.fill();
  g.lineJoin='round';g.strokeStyle='#1d140d';g.lineWidth=1.6;g.stroke();g.strokeStyle='#c49a5a';g.lineWidth=.8;g.stroke();
  outline(g,[[16.2,4.6],[10.4,4.6],[3.9,13],[10.4,21.4],[16.2,21.4]]);g.strokeStyle='rgba(236,211,153,.5)';g.lineWidth=.6;g.stroke();
  for(const [x,y]of [[8.3,13],[10.6,10.7],[12.9,13],[10.6,15.3]]){   /* each ring dark, then gold, over the one before: woven */
   g.beginPath();g.arc(x,y,2,0,Math.PI*2);g.strokeStyle='#22170f';g.lineWidth=1.9;g.stroke();g.strokeStyle='#efcf8a';g.lineWidth=.9;g.stroke();
  }
 }
 function paint(g,s,strip,sg,t,o){
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,g.canvas.width,g.canvas.height);g.setTransform(s,0,0,s,0,0);
  const body=g.createLinearGradient(0,4,0,22);body.addColorStop(0,'#3a2b1c');body.addColorStop(1,'#16100b');
  g.fillStyle='#35281b';g.fillRect(9,3,W-18,H-6);g.fillStyle=body;g.fillRect(10,4,W-20,H-8);
  sg.setTransform(1,0,0,1,0,0);sg.clearRect(0,0,strip.width,strip.height);sg.setTransform(s,0,0,s,0,0);
  sky(sg,t,o.day,o.night,o.dark);
  g.drawImage(strip,0,0,W,H);
  g.strokeStyle='#ae8750';g.lineWidth=1.2;g.strokeRect(10.6,4.6,W-21.2,H-9.2);
  g.strokeStyle='rgba(236,211,153,.55)';g.lineWidth=.6;g.strokeRect(11.8,5.8,W-23.6,H-11.6);
  g.fillStyle='#f0d08a';g.strokeStyle='#2a1c10';g.lineWidth=.8;g.lineJoin='round';   /* the needle: now */
  for(const [y0,y1]of [[2.6,8.2],[23.4,17.8]]){g.beginPath();g.moveTo(CX-3.4,y0);g.lineTo(CX+3.4,y0);g.lineTo(CX,y1);g.closePath();g.fill();g.stroke();}
  cap(g);g.save();g.translate(W,0);g.scale(-1,1);cap(g);g.restore();
 }
 function create(el,opts={}){
  const canvas=el.querySelector('canvas'),g=canvas.getContext('2d'),tip=el.querySelector('.daybar-tip');
  const day=opts.day||2700,night=opts.night||900,o={day,night,dark:opts.dark||(t=>t<day?0:1)};
  const strip=document.createElement('canvas'),sg=strip.getContext('2d');
  let lastT=null,lastTime=-Infinity,lastLook=-Infinity,scale=1,text='';
  /* the bar owns its pointer area: a click on it must not walk the hero */
  for(const name of ['pointerdown','click','dblclick','contextmenu','wheel'])el.addEventListener(name,e=>{e.stopPropagation();if(name!=='pointerdown')e.preventDefault();});
  return {update(active,t,time){
   const visible=!!active&&Number.isFinite(t);
   if(el.hidden===visible)el.hidden=!visible;
   if(!visible){lastT=null;lastLook=-Infinity;return;}
   if(time-lastTime<33)return;   /* thirty times a second at most - the light test's fast day */
   let redraw=lastT==null||Math.abs(t-lastT)*PPS>=.08;   /* the sky creeps: a tenth of a unit every two seconds or so */
   if(time-lastLook>=1000){   /* the size, once a second: the window may have changed */
    lastLook=time;
    const px=Math.max(1,Math.round((el.clientWidth||W)*Math.min(2,root.devicePixelRatio||1)));
    if(canvas.width!==px){canvas.width=strip.width=px;canvas.height=strip.height=Math.max(1,Math.round(px*H/W));scale=px/W;redraw=true;}
   }
   if(!redraw)return;
   lastTime=time;lastT=t;
   paint(g,scale,strip,sg,t,o);
   const now=tipText(t,day,night);
   if(now!==text){text=now;if(tip)tip.textContent=now;el.setAttribute('aria-label','Day and night: '+now);}
  }};
 }
 root.DayBar=Object.freeze({create,place,skyRGB,tipText,W,H,CX,SPAN});
})(typeof window==='undefined'?globalThis:window);
