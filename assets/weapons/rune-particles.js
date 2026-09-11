/* Painted material accents shared by weapon runes and liquid combat effects.
 * Call before the generic particle fade. This renderer applies its own age fade,
 * preserves the caller's canvas state, and leaves ordinary particles untouched.
 */
const runeParticleSprites = new Map();
const runeParticleKinds = new Set(['ember', 'water', 'blood', 'venom', 'spark', 'gold',
 'water-splash', 'blood-splash', 'venom-splash']);

function runeParticleSprite(kind) {
 if(runeParticleSprites.has(kind))return runeParticleSprites.get(kind);
 const cv=document.createElement('canvas');cv.width=96;cv.height=96;
 const g=cv.getContext('2d');g.translate(48,64);g.scale(20,20);
 if(kind==='water'||kind==='blood'||kind==='venom'){
  const colours=kind==='water'?['#264f70','#4999b5','#b8e8ed','#e9ffff']:
                kind==='blood'?['#3f101c','#841e32','#bf4450','#e8a4a2']:
                               ['#193e29','#34884d','#87c079','#d8edb9'];
  // The head leads along +X; the narrow tail stays within 2.1 radii behind it.
  const body=()=>{
   g.beginPath();g.moveTo(-2.1,0);
   g.bezierCurveTo(-1.05,-.13,-.65,-.86,.08,-.86);
   g.bezierCurveTo(.66,-.86,.96,-.49,.98,0);
   g.bezierCurveTo(.96,.59,.51,.91,-.04,.86);
   g.bezierCurveTo(-.83,.79,-1.16,.12,-2.1,0);g.closePath();
  };
  const grad=g.createLinearGradient(0,-.9,0,.9);
  grad.addColorStop(0,colours[2]);grad.addColorStop(.42,colours[1]);grad.addColorStop(1,colours[0]);
  g.globalAlpha=kind==='water'?.73:.95;g.fillStyle=grad;body();g.fill();
  g.globalAlpha=kind==='water'?.75:.85;g.strokeStyle=colours[0];g.lineWidth=.10;body();g.stroke();
  g.globalAlpha=kind==='water'?.9:.72;g.strokeStyle=colours[3];g.lineWidth=.12;g.lineCap='round';
  g.beginPath();g.moveTo(-.27,-.48);g.quadraticCurveTo(.04,-.65,.27,-.44);g.stroke();
  g.globalAlpha=.32;g.strokeStyle=colours[2];g.lineWidth=.08;
  g.beginPath();g.moveTo(.50,.28);g.quadraticCurveTo(.35,.52,.12,.56);g.stroke();
 }else if(kind==='ember'){
  // An uneven flame tongue, not the rounded leading head used by liquids.
  const grad=g.createLinearGradient(0,.55,0,-2.9);
  grad.addColorStop(0,'#862918');grad.addColorStop(.28,'#e96728');
  grad.addColorStop(.62,'#f6b34e');grad.addColorStop(1,'rgba(238,91,27,0)');
  g.fillStyle=grad;g.beginPath();g.moveTo(-.52,.45);
  g.bezierCurveTo(-1.0,-.15,-.35,-.8,-.54,-1.65);
  g.quadraticCurveTo(-.14,-1.32,.20,-2.85);
  g.quadraticCurveTo(.17,-1.57,.62,-.81);
  g.bezierCurveTo(1.0,-.04,.46,.65,-.52,.45);g.closePath();g.fill();
  g.globalAlpha=.80;g.fillStyle='#ffe3a0';g.beginPath();g.moveTo(-.22,.18);
  g.quadraticCurveTo(-.39,-.26,.05,-1.14);
  g.quadraticCurveTo(.02,-.45,.30,-.12);
  g.quadraticCurveTo(.32,.34,-.22,.18);g.fill();
 }else if(kind==='coal'){
  g.fillStyle='#682b20';g.beginPath();g.moveTo(-.48,-.15);g.lineTo(-.09,-.62);
  g.lineTo(.45,-.14);g.lineTo(.26,.44);g.lineTo(-.33,.35);g.closePath();g.fill();
  g.fillStyle='#c36634';g.beginPath();g.moveTo(-.09,-.49);g.lineTo(.23,-.10);
  g.lineTo(-.20,-.03);g.closePath();g.fill();
 }else if(kind==='gold'){
  const grad=g.createLinearGradient(-.6,-.6,.6,.6);
  grad.addColorStop(0,'#fff0b9');grad.addColorStop(.42,'#e4b64e');grad.addColorStop(1,'#85541f');
  g.fillStyle=grad;g.beginPath();g.moveTo(0,-.85);g.lineTo(.56,-.08);
  g.lineTo(.18,.59);g.lineTo(-.51,.12);g.closePath();g.fill();
  g.strokeStyle='#ffedb0';g.lineWidth=.09;g.beginPath();g.moveTo(-.38,-.05);g.lineTo(.08,-.56);g.stroke();
 }
 runeParticleSprites.set(kind,cv);return cv;
}

function drawRuneParticle(g,p) {
 if(!p||!runeParticleKinds.has(p.runeFx))return false;
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.r)||p.r<=0||
    !Number.isFinite(p.t)||!Number.isFinite(p.life)||p.life<=0||p.t>=p.life)return true;
 const age=Math.max(0,p.t/p.life),r=p.r;
 const vx=Number.isFinite(p.vx)?p.vx:0,vy=Number.isFinite(p.vy)?p.vy:0;
 const speed=Math.hypot(vx,vy),fade=Math.pow(1-age,.8);
 g.save();
 g.globalAlpha*=fade;g.globalCompositeOperation='source-over';g.translate(p.x,p.y);
 // All cached art uses the same origin: (48,64), at 20 pixels per radius.
 const sprite=(kind,size=r)=>g.drawImage(runeParticleSprite(kind),-2.4*size,-3.2*size,4.8*size,4.8*size);
 if(p.runeFx==='water'||p.runeFx==='blood'||p.runeFx==='venom'){
  if(speed>.01)g.rotate(Math.atan2(vy,vx));
  const thinning=1-Math.min(.30,speed/500);
  g.scale(1,thinning);sprite(p.runeFx,r*(1-age*.10));
 }else if(p.runeFx==='ember'){
  const angle=speed>.01?Math.atan2(vy,vx)+Math.PI/2:0;
  g.rotate(angle);
  const baseAlpha=g.globalAlpha,heat=Math.max(0,Math.min(1,(.82-age)/.44));
  if(heat>0){g.globalAlpha=baseAlpha*heat;sprite('ember',r*(1-age*.38));}
  if(heat<1){g.globalAlpha=baseAlpha*(1-heat);sprite('coal',r*(1-age*.28));}
 }else if(p.runeFx==='spark'){
  if(speed>.01)g.rotate(Math.atan2(vy,vx));
  const length=Math.min(r*3.8,r*1.6+speed*.012),side=r*.30;
  g.lineCap='butt';g.lineJoin='miter';
  g.beginPath();g.moveTo(-length,side*.6);g.lineTo(-length*.52,-side);
  g.lineTo(-length*.28,side*.7);g.lineTo(r*.45,0);
  g.strokeStyle='#8455b8';g.lineWidth=r*.53;g.stroke();
  g.globalAlpha*=.88;g.strokeStyle='#eee5ff';g.lineWidth=r*.23;g.stroke();
 }else if(p.runeFx==='gold'){
  g.rotate(age*1.7+vx*.025);sprite('gold',r*(1-age*.18));
 }else{
  const water=p.runeFx==='water-splash';
  const radius=Math.min(2,r*(water?.85+age*2.2:.95+age*.55));
  g.globalAlpha*=water?.45:.68;
  g.fillStyle=water?'#365e6a':p.runeFx==='blood-splash'?'#531d2a':'#244b30';
  g.beginPath();g.ellipse(0,0,radius,radius*.27,0,0,Math.PI*2);g.fill();
  if(water){
   g.strokeStyle='#a9d4db';g.lineWidth=.12;
   g.beginPath();g.ellipse(0,0,radius,radius*.30,0,0,Math.PI*2);g.stroke();
  }
 }
 g.restore();return true;
}
