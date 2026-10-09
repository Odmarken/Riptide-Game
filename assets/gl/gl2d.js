/* 🎮 GL2D - the screen canvas drawn with WebGL2 behind the 2D canvas API the game already speaks (2026-10-09, asked for: "vi kör
   WebGL igenom allt" - less lag in the ports and the big raids, and the base for real light, shadows and weather in shaders).

   Why: measured on the player's PC (RTX 5080, 120 Hz), a busy port asked the browser's 2D canvas for ~1500 separate calls a frame
   (smoke puffs, ground tiles, NPC labels...). Each one costs a fixed price in the browser's own graphics process, and that price -
   not the game's logic, not the graphics card - held the ports at 55-66 frames a second. Here every call the game makes lands in
   one vertex batch instead: up to 14 pictures per batch, colours, gradients and the text atlas in the same shader, so a frame is a
   few dozen WebGL draws.

   Nothing about WHAT is drawn changes: the game's drawing code is untouched, and game.js picks this context instead of
   cv.getContext('2d') unless the player chose Canvas in Settings or WebGL2 is missing. How the 2D API is met:
   - transforms, globalAlpha and the save/restore stack live here and are applied to vertices on the CPU, in device pixels
   - drawImage: pictures and canvases become textures; a canvas is uploaded again when a 2D context drew into it since (every 2D
     context in the page bumps its canvas' __glv). The game's scaled copies (mip/crisp) carry __glSrc and the source is drawn
     instead, mip-mapped by the GPU
   - paths: curves are flattened at the screen's resolution; convex shapes go straight into the batch, the rest through the
     stencil; strokes are triangulated (joins, caps, dashes). Every draw gets its own depth, so a shape never blends over itself
   - fillStyle / strokeStyle: colours, any CanvasGradient (its geometry and stops are recorded when a 2D context makes it) and
     patterns; gradients run in the shader from a table of geometry and a strip of colour ramps
   - text: rasterised once by a 2D canvas into an atlas, then drawn as a picture
   - clip: rectangles by scissor, any other path by the stencil's top bit; save/restore puts the stencil back. A Path2D (the
     mounts clip their riders with one) is met through what was built into it, recorded as it was built - see installTracking
   - composite: source-over, lighter, screen, multiply and friends are blend functions; soft-light and the other non-separable
     modes draw the shape alone and blend it against a copy of the scene in a shader
   - shadowBlur: the shape is drawn alone, blurred on the GPU and laid under itself in the shadow colour
   The scene is drawn into a 4x multisampled framebuffer (it keeps its pixels between frames, as a 2D canvas does) and copied to
   the canvas at the end of every task that drew. The scene texture is also where the light and weather passes will start. */
const GL2D_DEBUG={uploads:false};
const GL2D=(()=>{
'use strict';

/* ================================================================== colours */
const colorCache=new Map();
let scratchCtx=null;
function scratch(){
 if(!scratchCtx){const c=document.createElement('canvas');c.width=c.height=4;scratchCtx=c.getContext('2d');}
 return scratchCtx;
}
const hexv=c=>c>=48&&c<=57?c-48:c>=97&&c<=102?c-87:c>=65&&c<=70?c-55:-1;
function parseColor(s){
 if(typeof s!=='string')return null;
 let c=colorCache.get(s);
 if(c!==undefined)return c;
 c=parseColorRaw(s,0);
 if(colorCache.size>20000)colorCache.clear();
 colorCache.set(s,c);
 return c;
}
function clamp01(v){return v<0?0:v>1?1:v;}
function hsl2rgb(h,s,l){
 h=((h%360)+360)%360/360;
 if(s===0)return [l,l,l];
 const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
 const f=t=>{t=t<0?t+1:t>1?t-1:t;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
 return [f(h+1/3),f(h),f(h-1/3)];
}
function parseColorRaw(s,depth){
 const t=s.trim();
 if(t.charCodeAt(0)===35){   /* # */
  const n=t.length-1,h=i=>hexv(t.charCodeAt(i));
  if(n===3||n===4){
   const r=h(1),g=h(2),b=h(3),a=n===4?h(4):15;
   if(r>=0&&g>=0&&b>=0&&a>=0)return [r*17/255,g*17/255,b*17/255,a*17/255];
  }else if(n===6||n===8){
   const v=[];for(let i=1;i<=n;i+=2){const hi=h(i),lo=h(i+1);if(hi<0||lo<0){v.length=0;break;}v.push((hi*16+lo)/255);}
   if(v.length===n/2)return [v[0],v[1],v[2],n===8?v[3]:1];
  }
  return depth?null:viaCanvas(t);
 }
 if((t.charCodeAt(0)|32)===114&&(t.charCodeAt(1)|32)===103&&(t.charCodeAt(2)|32)===98){const f=fastRGB(t);if(f)return f;}
 const open=t.indexOf('(');
 if(open>0&&t.charCodeAt(t.length-1)===41){
  const fn=t.slice(0,open).trim().toLowerCase();
  if(fn==='rgb'||fn==='rgba'||fn==='hsl'||fn==='hsla'){
   const parts=t.slice(open+1,-1).split(/[\s,\/]+/).filter(Boolean);
   if(parts.length===3||parts.length===4){
    const num=(p,full)=>p.endsWith('%')?parseFloat(p)/100*full:parseFloat(p);
    let r,g,b;
    if(fn[0]==='r'){r=num(parts[0],255)/255;g=num(parts[1],255)/255;b=num(parts[2],255)/255;}
    else{const hh=parseFloat(parts[0]),ss=num(parts[1],1)/(parts[1].endsWith('%')?1:100),ll=num(parts[2],1)/(parts[2].endsWith('%')?1:100);[r,g,b]=hsl2rgb(hh,clamp01(ss),clamp01(ll));}
    const a=parts.length===4?num(parts[3],1):1;
    if(Number.isFinite(r)&&Number.isFinite(g)&&Number.isFinite(b)&&Number.isFinite(a))return [clamp01(r),clamp01(g),clamp01(b),clamp01(a)];
   }
  }
 }
 if(t.toLowerCase()==='transparent')return [0,0,0,0];
 return depth?null:viaCanvas(t);
}
function fastRGB(t){   /* rgb(...) / rgba(...): up to four numbers, commas, spaces or a slash between, % allowed */
 let i=(t.charCodeAt(3)|32)===97?4:3;
 if(t.charCodeAt(i)!==40||t.charCodeAt(t.length-1)!==41)return null;
 i++;const L=t.length-1,v=[0,0,0,1];let k=0;
 while(i<L&&k<4){
  let c=t.charCodeAt(i);while(i<L&&(c===32||c===44||c===47)){i++;c=t.charCodeAt(i);}
  if(i>=L)break;
  let j=i;while(j<L){const d=t.charCodeAt(j);if(d===32||d===44||d===47)break;j++;}
  let pc=false,e=j;if(t.charCodeAt(j-1)===37){pc=true;e=j-1;}
  if(e<=i)return null;
  const num=+t.slice(i,e);if(!Number.isFinite(num))return null;
  v[k]=k<3?(pc?num/100:num/255):(pc?num/100:num);k++;i=j;
 }
 if(k<3)return null;
 return [clamp01(v[0]),clamp01(v[1]),clamp01(v[2]),clamp01(v[3])];
}
function viaCanvas(t){   /* named colours and anything else CSS knows: let a 2D context normalise it, or refuse it */
 if(typeof document==='undefined')return null;
 const g=scratch();
 g.fillStyle='#010203';g.fillStyle=t;
 const n=g.fillStyle;
 if(n==='#010203')return null;
 return typeof n==='string'?parseColorRaw(n,1):null;
}
/* premultiplied RGBA8 packed for a little-endian Uint32Array: bytes R,G,B,A */
function pack(c,alpha){
 const a=c[3]*alpha;
 if(!(a>0))return 0;
 const A=a>=1?255:Math.round(a*255);
 return ((A<<24)|(Math.round(c[2]*a*255)<<16)|(Math.round(c[1]*a*255)<<8)|Math.round(c[0]*a*255))>>>0;
}
function packGray(a){   /* white at alpha a, premultiplied: what a picture is multiplied by */
 if(!(a>0))return 0;const A=a>=1?255:Math.round(a*255);
 return ((A<<24)|(A<<16)|(A<<8)|A)>>>0;
}

/* ================================================================== the 2D API's own objects, recorded where they are made */
const gradInfo=new WeakMap(),patInfo=new WeakMap();
const pathOps=new WeakMap();   /* Path2D -> [op, args, op, args, ...] as it was built: the GL context lays it out from these */
let tracking=false;
function installTracking(){
 if(tracking||typeof window==='undefined')return;tracking=true;
 const protos=[window.CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype,window.OffscreenCanvasRenderingContext2D&&OffscreenCanvasRenderingContext2D.prototype].filter(Boolean);
 for(const P of protos){
  for(const m of ['fill','stroke','fillRect','strokeRect','clearRect','drawImage','putImageData','fillText','strokeText','reset']){
   const f=P[m];if(typeof f!=='function')continue;
   P[m]=function(){const c=this.canvas;if(c)c.__glv=(c.__glv|0)+1;return f.apply(this,arguments);};
  }
  const lg=P.createLinearGradient,rg=P.createRadialGradient,cp=P.createPattern;
  P.createLinearGradient=function(x0,y0,x1,y1){const g=lg.apply(this,arguments);gradInfo.set(g,{type:0,x0:+x0,y0:+y0,r0:0,x1:+x1,y1:+y1,r1:0,stops:[],key:null});return g;};
  P.createRadialGradient=function(x0,y0,r0,x1,y1,r1){const g=rg.apply(this,arguments);gradInfo.set(g,{type:1,x0:+x0,y0:+y0,r0:+r0,x1:+x1,y1:+y1,r1:+r1,stops:[],key:null});return g;};
  P.createPattern=function(img,rep){const p=cp.apply(this,arguments);if(p)patInfo.set(p,{img,rep:rep||'repeat',m:null});return p;};
 }
 if(window.CanvasGradient){
  const acs=CanvasGradient.prototype.addColorStop;
  CanvasGradient.prototype.addColorStop=function(o,c){acs.call(this,o,c);const i=gradInfo.get(this);if(i){i.stops.push(+o,String(c));i.key=null;}};
 }
 if(window.CanvasPattern&&CanvasPattern.prototype.setTransform){
  const pst=CanvasPattern.prototype.setTransform;
  CanvasPattern.prototype.setTransform=function(m){pst.call(this,m);const i=patInfo.get(this);if(i)i.m=m?{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f}:null;};
 }
 for(const C of [window.HTMLCanvasElement,window.OffscreenCanvas].filter(Boolean))for(const p of ['width','height']){
  const d=Object.getOwnPropertyDescriptor(C.prototype,p);if(!d||!d.set)continue;
  Object.defineProperty(C.prototype,p,{configurable:true,enumerable:d.enumerable,get:d.get,set(v){d.set.call(this,v);this.__glv=(this.__glv|0)+1;}});
 }
 /* Path2D: a browser path keeps its points to itself, so what goes into one is written down as it is built (pathOps), and
    clip/fill/stroke(path) on the GL context lay it out from that. The mounts clip their riders with Path2D masks - without
    this the rider vanished from every mount (2026-10-09, "min gubbe har försvunnit från mitt mount"). Paths are made through
    a subclass, so a path built from another or from SVG text is known too (SVG text itself is not laid out). */
 if(window.Path2D&&!pathOps.native){
  const Native=window.Path2D,P2=Native.prototype;pathOps.native=Native;
  for(const m of ['moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','arcTo','ellipse','rect','roundRect','closePath']){
   const f=P2[m];if(typeof f!=='function')continue;
   P2[m]=function(){const r=f.apply(this,arguments);const ops=pathOps.get(this);if(ops)ops.push(m,Array.prototype.slice.call(arguments));return r;};
  }
  const add=P2.addPath;
  if(typeof add==='function')P2.addPath=function(p,m){
   add.apply(this,arguments);const ops=pathOps.get(this);
   if(ops){const o=pathOps.get(p);ops.push('addPath',[o?o.slice():null,m?{a:m.a??1,b:m.b??0,c:m.c??0,d:m.d??1,e:m.e??0,f:m.f??0}:null]);}
  };
  window.Path2D=class Path2D extends Native{constructor(){
   super(...arguments);const a=arguments[0];
   pathOps.set(this,a===undefined?[]:typeof a==='string'?['svg',[a]]:pathOps.has(a)?['addPath',[pathOps.get(a).slice(),null]]:['svg',[null]]);
  }};
 }
}

/* ================================================================== shaders */
const VS=`#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec4 a_color;
layout(location=3) in uint a_info;
uniform vec2 u_res;
out vec2 v_uv;out vec4 v_color;flat out uint v_info;
void main(){
 v_uv=a_uv;v_color=a_color;v_info=a_info;
 gl_Position=vec4(a_pos.x/u_res.x*2.0-1.0,1.0-a_pos.y/u_res.y*2.0,a_pos.z*2.0-1.0,1.0);
}`;
function batchFS(n){
 let sw='';for(let i=0;i<n;i++)sw+=` case ${i}: return texture(u_tex[${i}],uv,u_bias);\n`;
 return `#version 300 es
precision highp float;precision highp int;
in vec2 v_uv;in vec4 v_color;flat in uint v_info;
uniform sampler2D u_tex[${n}];
uniform sampler2D u_grad;uniform sampler2D u_lut;uniform float u_lutH;uniform float u_bias;
out vec4 o;
vec4 tex(int i,vec2 uv){switch(i){
${sw} }return vec4(0.0);}
void main(){
 uint slot=v_info&255u;
 if(slot==0u){o=v_color;return;}
 if(slot==255u){
  int row=int(v_info>>16);
  vec4 g0=texelFetch(u_grad,ivec2(0,row),0),g1=texelFetch(u_grad,ivec2(1,row),0);
  float t=0.0;
  if(g0.x<0.5){vec2 d=g1.xy-g0.yz;float dd=dot(d,d);if(dd<=0.0){o=vec4(0.0);return;}t=dot(v_uv-g0.yz,d)/dd;}
  else{
   vec2 c0=g0.yz,cd=g1.xy-g0.yz,pd=v_uv-g0.yz;float r0=g0.w,dr=g1.z-g0.w;
   float a=dot(cd,cd)-dr*dr,b=dot(pd,cd)+r0*dr,c=dot(pd,pd)-r0*r0;
   if(abs(a)<1e-9){if(abs(b)<1e-12){o=vec4(0.0);return;}t=c/(2.0*b);if(r0+t*dr<0.0){o=vec4(0.0);return;}}
   else{float disc=b*b-a*c;if(disc<0.0){o=vec4(0.0);return;}float s=sqrt(disc),t1=(b+s)/a,t2=(b-s)/a,hi=max(t1,t2),lo=min(t1,t2);
    if(r0+hi*dr>=0.0)t=hi;else if(r0+lo*dr>=0.0)t=lo;else{o=vec4(0.0);return;}}
  }
  t=clamp(t,0.0,1.0);
  o=texture(u_lut,vec2((t*255.0+0.5)/256.0,(g1.w+0.5)/u_lutH))*v_color.a;
  return;
 }
 uint fl=(v_info>>8)&255u;
 vec2 uv=v_uv;
 if((fl&2u)!=0u&&(uv.y<0.0||uv.y>1.0)){o=vec4(0.0);return;}
 if((fl&4u)!=0u&&(uv.x<0.0||uv.x>1.0)){o=vec4(0.0);return;}
 o=tex(int(slot)-1,uv)*v_color;
}`;}
const QUAD_VS=`#version 300 es
layout(location=0) in vec2 a_p;
uniform vec4 u_rect;uniform vec2 u_res;uniform float u_z;
out vec2 v_px;
void main(){vec2 p=u_rect.xy+a_p*u_rect.zw;v_px=p;gl_Position=vec4(p.x/u_res.x*2.0-1.0,1.0-p.y/u_res.y*2.0,u_z*2.0-1.0,1.0);}`;
/* separable gaussian over a texture region; v_px is in device pixels, the texture is the scene-sized layer (row 0 at the bottom) */
const BLUR_FS=`#version 300 es
precision highp float;
in vec2 v_px;uniform sampler2D u_src;uniform vec2 u_dir;uniform float u_sigma;uniform vec2 u_res;
out vec4 o;
void main(){
 vec2 base=vec2(v_px.x,u_res.y-v_px.y);
 float s=max(u_sigma,0.3);int r=int(ceil(s*3.0));
 vec4 acc=vec4(0.0);float wsum=0.0;
 for(int i=-64;i<=64;i++){if(i<-r||i>r)continue;float w=exp(-float(i*i)/(2.0*s*s));acc+=texture(u_src,(base+u_dir*float(i))/u_res)*w;wsum+=w;}
 o=acc/wsum;
}`;
/* the blurred alpha laid down in the shadow colour (premultiplied), shifted by the shadow offset */
const SHADOW_FS=`#version 300 es
precision highp float;
in vec2 v_px;uniform sampler2D u_src;uniform vec4 u_color;uniform vec2 u_off;uniform vec2 u_res;
out vec4 o;
void main(){vec2 p=v_px-u_off;o=u_color*texture(u_src,vec2(p.x,u_res.y-p.y)/u_res).a;}`;
/* non-separable / non-blend-function composite modes: src = the shape drawn alone, dst = the scene under it */
const ADV_FS=`#version 300 es
precision highp float;
in vec2 v_px;uniform sampler2D u_src;uniform sampler2D u_dst;uniform int u_mode;uniform vec2 u_res;
out vec4 o;
float sl(float b,float s){if(s<=0.5)return b-(1.0-2.0*s)*b*(1.0-b);float d=b<=0.25?((16.0*b-12.0)*b+4.0)*b:sqrt(b);return b+(2.0*s-1.0)*(d-b);}
float lum(vec3 c){return dot(c,vec3(0.3,0.59,0.11));}
vec3 clipc(vec3 c){float l=lum(c),n=min(min(c.r,c.g),c.b),x=max(max(c.r,c.g),c.b);if(n<0.0)c=l+(c-l)*l/(l-n);if(x>1.0)c=l+(c-l)*(1.0-l)/(x-l);return c;}
vec3 setlum(vec3 c,float l){return clipc(c+(l-lum(c)));}
float sat(vec3 c){return max(max(c.r,c.g),c.b)-min(min(c.r,c.g),c.b);}
vec3 setsat(vec3 c,float s){float mx=max(max(c.r,c.g),c.b),mn=min(min(c.r,c.g),c.b);vec3 r=vec3(0.0);if(mx>mn){r=(c-mn)*s/(mx-mn);}return r;}
vec3 blend(vec3 b,vec3 s){
 if(u_mode==1)return vec3(sl(b.r,s.r),sl(b.g,s.g),sl(b.b,s.b));
 if(u_mode==2)return vec3(b.r<=0.5?2.0*s.r*b.r:1.0-2.0*(1.0-s.r)*(1.0-b.r),b.g<=0.5?2.0*s.g*b.g:1.0-2.0*(1.0-s.g)*(1.0-b.g),b.b<=0.5?2.0*s.b*b.b:1.0-2.0*(1.0-s.b)*(1.0-b.b));
 if(u_mode==3)return vec3(s.r<=0.5?2.0*s.r*b.r:1.0-2.0*(1.0-s.r)*(1.0-b.r),s.g<=0.5?2.0*s.g*b.g:1.0-2.0*(1.0-s.g)*(1.0-b.g),s.b<=0.5?2.0*s.b*b.b:1.0-2.0*(1.0-s.b)*(1.0-b.b));
 if(u_mode==4)return min(b,s);
 if(u_mode==5)return max(b,s);
 if(u_mode==6)return vec3(b.r==0.0?0.0:s.r>=1.0?1.0:min(1.0,b.r/(1.0-s.r)),b.g==0.0?0.0:s.g>=1.0?1.0:min(1.0,b.g/(1.0-s.g)),b.b==0.0?0.0:s.b>=1.0?1.0:min(1.0,b.b/(1.0-s.b)));
 if(u_mode==7)return vec3(b.r>=1.0?1.0:s.r<=0.0?0.0:1.0-min(1.0,(1.0-b.r)/s.r),b.g>=1.0?1.0:s.g<=0.0?0.0:1.0-min(1.0,(1.0-b.g)/s.g),b.b>=1.0?1.0:s.b<=0.0?0.0:1.0-min(1.0,(1.0-b.b)/s.b));
 if(u_mode==8)return abs(b-s);
 if(u_mode==9)return b+s-2.0*b*s;
 if(u_mode==10)return setlum(setsat(s,sat(b)),lum(b));
 if(u_mode==11)return setlum(setsat(b,sat(s)),lum(b));
 if(u_mode==12)return setlum(s,lum(b));
 if(u_mode==13)return setlum(b,lum(s));
 return s;
}
void main(){
 ivec2 q=ivec2(v_px.x,u_res.y-v_px.y);
 vec4 S=texelFetch(u_src,q,0),D=texelFetch(u_dst,q,0);
 vec3 s=S.a>0.0?S.rgb/S.a:vec3(0.0),b=D.a>0.0?D.rgb/D.a:vec3(0.0);
 vec3 m=(1.0-D.a)*s+D.a*clamp(blend(b,s),0.0,1.0);
 o=vec4(S.a*m+(1.0-S.a)*D.rgb,S.a+D.a*(1.0-S.a));
}`;
const ADV_MODES={'soft-light':1,'overlay':2,'hard-light':3,'darken':4,'lighten':5,'color-dodge':6,'color-burn':7,'difference':8,'exclusion':9,'hue':10,'saturation':11,'color':12,'luminosity':13};

/* ---- post-pass shaders (2026-10-09): full-screen quads over 0..1, textures the GL way up (row 0 at the bottom) */
const PP_VS=`#version 300 es
layout(location=0) in vec2 a_p;
out vec2 v_uv;
void main(){v_uv=a_p;gl_Position=vec4(a_p*2.0-1.0,0.0,1.0);}`;
/* one instance per light; the quad covers its pool on the ground and the light round its flame */
const LIGHT_VS=`#version 300 es
layout(location=0) in vec2 a_p;
layout(location=1) in vec4 i0;
layout(location=2) in vec4 i1;
layout(location=3) in vec4 i2;
layout(location=4) in vec4 i3;
uniform vec2 u_res;
out vec2 v_p;flat out vec4 v0;flat out vec4 v1;flat out vec4 v2;flat out vec4 v3;
void main(){
 float R=i1.x,Q=i1.y,fl=i1.z;
 vec2 lo=min(vec2(i0.x-R,i0.y-R*fl),vec2(i0.z-Q,i0.w-Q)),hi=max(vec2(i0.x+R,i0.y+R*fl),vec2(i0.z+Q,i0.w+Q));
 vec2 p=mix(lo,hi,a_p);
 v_p=p;v0=i0;v1=i1;v2=i2;v3=i3;
 gl_Position=vec4(p.x/u_res.x*2.0-1.0,1.0-p.y/u_res.y*2.0,0.0,1.0);
}`;
const LIGHT_FS=`#version 300 es
precision highp float;
in vec2 v_p;flat in vec4 v0;flat in vec4 v1;flat in vec4 v2;flat in vec4 v3;
out vec4 o;
float fall(float t,float hr){if(t>=1.0)return 0.0;float q=t/hr;return pow(1.0+q*q,-1.5)*(1.0-t*t);}
void main(){
 vec2 d=v_p-v0.xy;d.y/=v1.z;
 float pool=fall(length(d)/v1.x,v2.w);
 float head=fall(length(v_p-v0.zw)/v1.y,v3.x)*0.8;
 float f=(pool+head)*v1.w;
 o=vec4(v2.rgb*f,f);
}`;
/* the scene times the light: the ambient gives way to the lights' colour as far as they cover (as the 2D lamps laid their pools over
   the night), and where they cover more than once - near a flame, where lights overlap - a little more, under a soft shoulder */
const LMIX_FS=`#version 300 es
precision highp float;
in vec2 v_uv;uniform sampler2D u_scene;uniform sampler2D u_light;uniform vec3 u_amb;uniform float u_over;uniform float u_knee;uniform float u_max;
out vec4 o;
void main(){
 vec4 s=texelFetch(u_scene,ivec2(gl_FragCoord.xy),0),l=texture(u_light,v_uv);
 float a=l.a,cov=min(a,1.0);vec3 col=a>1e-4?l.rgb/a:vec3(1.0);
 vec3 L=u_amb*(1.0-cov)+col*cov+col*max(a-1.0,0.0)*u_over,x=max(L-1.0,0.0);
 L=min(L,1.0)+(u_max-1.0)*(1.0-exp(-x*u_knee));
 o=vec4(min(s.rgb*L,vec3(s.a)),s.a);
}`;
/* bloom: a 4-tap downsample of what is over the threshold (soft knee), a 13-tap chain down, a tent back up */
const BRIGHT_FS=`#version 300 es
precision highp float;
in vec2 v_uv;uniform sampler2D u_src;uniform vec2 u_px;uniform float u_thr;uniform float u_knee;uniform float u_white;
out vec4 o;
void main(){
 vec3 c=(texture(u_src,v_uv+u_px*vec2(-.5,-.5)).rgb+texture(u_src,v_uv+u_px*vec2(.5,-.5)).rgb+texture(u_src,v_uv+u_px*vec2(-.5,.5)).rgb+texture(u_src,v_uv+u_px*vec2(.5,.5)).rgb)*.25;
 float br=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),sat=br>0.0?(br-mn)/br:0.0;
 float soft=clamp(br-u_thr+u_knee,0.0,2.0*u_knee);soft=soft*soft/(4.0*u_knee+1e-5);
 o=vec4(c*max(soft,br-u_thr)/max(br,1e-5)*mix(u_white,1.0,sat),1.0);
}`;
/* emitters: soft round glows (a flame's heart, a lamp's glass) added straight into the bloom */
const EMIT_VS=`#version 300 es
layout(location=0) in vec2 a_p;
layout(location=1) in vec4 i0;
layout(location=2) in vec4 i1;
uniform vec2 u_res;
out vec2 v_d;flat out vec4 v1;
void main(){vec2 p=i0.xy+(a_p*2.0-1.0)*i0.z*2.2;v_d=(p-i0.xy)/i0.z;v1=i1;gl_Position=vec4(p.x/u_res.x*2.0-1.0,1.0-p.y/u_res.y*2.0,0.0,1.0);}`;
const EMIT_FS=`#version 300 es
precision highp float;
in vec2 v_d;flat in vec4 v1;
out vec4 o;
void main(){float r2=dot(v_d,v_d);o=vec4(v1.rgb*v1.a*exp(-r2*1.6),1.0);}`;
const DOWN_FS=`#version 300 es
precision highp float;
in vec2 v_uv;uniform sampler2D u_src;uniform vec2 u_px;
out vec4 o;
vec3 s(vec2 d){return texture(u_src,v_uv+d*u_px).rgb;}
void main(){
 vec3 a=s(vec2(-2,2)),b=s(vec2(0,2)),c=s(vec2(2,2)),d=s(vec2(-2,0)),e=s(vec2(0,0)),f=s(vec2(2,0)),g=s(vec2(-2,-2)),h=s(vec2(0,-2)),i=s(vec2(2,-2)),j=s(vec2(-1,1)),k=s(vec2(1,1)),l=s(vec2(-1,-1)),m=s(vec2(1,-1));
 o=vec4(e*.125+(a+c+g+i)*.03125+(b+d+f+h)*.0625+(j+k+l+m)*.125,1.0);
}`;
const UP_FS=`#version 300 es
precision highp float;
in vec2 v_uv;uniform sampler2D u_src;uniform vec2 u_px;uniform float u_k;
out vec4 o;
vec3 s(vec2 d){return texture(u_src,v_uv+d*u_px*u_k).rgb;}
void main(){
 vec3 r=s(vec2(0,0))*4.0+(s(vec2(-1,0))+s(vec2(1,0))+s(vec2(0,-1))+s(vec2(0,1)))*2.0+s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1));
 o=vec4(r/16.0,1.0);
}`;
/* a texture laid over the target in a colour; with u_px a tent upsample; u_flip for a canvas texture (top row first) */
const ADD_FS=`#version 300 es
precision highp float;
in vec2 v_uv;uniform sampler2D u_src;uniform vec4 u_color;uniform vec2 u_px;uniform float u_flip;uniform vec2 u_shift;
out vec4 o;
void main(){
 vec2 uv=(u_flip>.5?vec2(v_uv.x,1.0-v_uv.y):v_uv)+u_shift;
 vec4 t;
 if(u_px.x>0.0)t=(texture(u_src,uv)*4.0+(texture(u_src,uv+vec2(u_px.x,0))+texture(u_src,uv-vec2(u_px.x,0))+texture(u_src,uv+vec2(0,u_px.y))+texture(u_src,uv-vec2(0,u_px.y)))*2.0
  +texture(u_src,uv+u_px)+texture(u_src,uv-u_px)+texture(u_src,uv+vec2(u_px.x,-u_px.y))+texture(u_src,uv+vec2(-u_px.x,u_px.y)))/16.0;
 else t=texture(u_src,uv);
 o=vec4(t.rgb*u_color.rgb,t.a*u_color.a);
}`;
const BLUR1_FS=`#version 300 es
precision highp float;
in vec2 v_uv;uniform sampler2D u_src;uniform vec2 u_dir;uniform float u_sigma;uniform float u_flip;
out vec4 o;
void main(){
 vec2 uv=u_flip>.5?vec2(v_uv.x,1.0-v_uv.y):v_uv,dir=u_flip>.5?vec2(u_dir.x,-u_dir.y):u_dir;
 int r=int(ceil(u_sigma*3.0));vec4 acc=vec4(0.0);float ws=0.0;
 for(int i=-24;i<=24;i++){if(i<-r||i>r)continue;float w=exp(-float(i*i)/(2.0*u_sigma*u_sigma));acc+=texture(u_src,uv+dir*float(i))*w;ws+=w;}
 o=acc/ws;
}`;
/* light shafts: soft fans of beams out from the sun (slowly drifting), fading with distance, and dimmed where the line back to the
   sun crosses the shadow layer - so the town's houses and trees cut the beams */
const RAYS_FS=`#version 300 es
precision highp float;
in vec2 v_uv;uniform sampler2D u_shadow;uniform float u_hasShadow;uniform vec2 u_pos;uniform vec2 u_dir;uniform vec3 u_world;uniform vec2 u_res;uniform float u_time;uniform float u_reach;uniform float u_block;
out vec4 o;
float hash(float n){return fract(sin(n)*43758.5453);}
float noise(float x){float i=floor(x),f=fract(x);return mix(hash(i),hash(i+1.0),f*f*(3.0-2.0*f));}
/* shafts of a low sun: bands along the way the light runs (u_dir, the shadows' own direction), laid on the WORLD - so they stay on
   the ground as the view moves, not on the glass (2026-10-09: the first fan round a point on the screen "följer med skärmen
   konstigt") - strongest on the sun's side (u_pos), and cut where something casts a shadow toward the sun */
void main(){
 vec2 p=vec2(v_uv.x,1.0-v_uv.y)*u_res,w=(p-u_world.yz)/u_world.x,n=vec2(-u_dir.y,u_dir.x);
 float across=dot(w,n);
 float b=noise(across/70.0+u_time*.05)*.6+noise(across/29.0-u_time*.08)*.4;
 b=smoothstep(.36,.92,b)*(.55+.45*noise(dot(w,u_dir)/260.0+floor(across/70.0)*3.7));   /* each beam waxes and wanes along its length */
 float along=max(0.0,dot(p-u_pos,u_dir)),fall=exp(-along/(u_res.y*u_reach))*exp(-length(p-u_pos)/(u_res.y*u_reach*1.6));
 float T=1.0;
 if(u_hasShadow>.5){float acc=0.0;vec2 q=v_uv,st=vec2(-u_dir.x,u_dir.y)*(u_res.y*.4/28.0)/u_res;for(int i=1;i<=28;i++){q+=st;if(q.x<0.0||q.y<0.0||q.x>1.0||q.y>1.0)break;acc+=texture(u_shadow,vec2(q.x,1.0-q.y)).a;}T=exp(-acc*u_block);}
 o=vec4(vec3(b*fall*T),1.0);
}`;

/* heat haze (2026-10-09, "värmedis över eld och lava"): the scene fetched again through a slow shimmer wherever it is hot - a
   plume above each flame (u_src: x,y in device px, its size, its strength) and, in a hot land, drifting patches of hot air
   (u_global). The ripples are tied to the ground (u_org: where the world's 0,0 is on the screen, u_sc: device px a world
   unit), so they rise off the fire and do not slide along with the camera */
const HAZE_FS=`#version 300 es
precision highp float;
in vec2 v_uv;uniform sampler2D u_scene;uniform vec2 u_res;uniform float u_time;uniform float u_amp;uniform float u_global;uniform vec2 u_org;uniform float u_sc;uniform int u_n;uniform vec4 u_src[24];
out vec4 o;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){
 vec2 fc=gl_FragCoord.xy,p=vec2(fc.x,u_res.y-fc.y),wp=(p-u_org)/max(u_sc,.001);
 float w=0.0;
 if(u_global>0.0)w=u_global*1.8*smoothstep(.36,.84,vnoise(wp*.0042+vec2(u_time*.05,u_time*.09)));
 for(int i=0;i<24;i++){if(i>=u_n)break;vec4 s=u_src[i];vec2 d=p-s.xy;d.y+=s.z*.75;
  w+=s.w*exp(-(d.x*d.x)/(s.z*s.z*.3)-(d.y*d.y)/(s.z*s.z*1.6));}
 w=min(w,1.0);
 if(w<.004){o=texelFetch(u_scene,ivec2(fc),0);return;}
 vec2 q=wp*.035;
 vec2 off=vec2(vnoise(q+vec2(0.0,u_time*1.9))-.5,vnoise(q*1.3+vec2(9.7,u_time*2.6))-.5)*2.0*u_amp*w;
 o=texture(u_scene,(fc+off)/u_res);
}`;

/* ================================================================== geometry helpers (pure; also run headless in the tests) */
const TAU=Math.PI*2;
/* arc sweep as the 2D canvas defines it */
function arcSweep(a0,a1,ccw){   /* the browser's own rule (Blink's adjustEndAngle): arc(x,y,r,0,2π,true) is a whole circle backwards, not nothing */
 if(!ccw){if(a1-a0>=TAU)return TAU;if(a0>a1)return TAU-(a0-a1)%TAU;return a1-a0;}
 if(a0-a1>=TAU)return -TAU;if(a0<a1)return -(TAU-(a1-a0)%TAU);return a1-a0;
}
/* segments to keep a flattened circle of radius r (device px) within ~0.3 px */
function arcSegments(rDev,sweep){
 if(!(rDev>0))return 1;
 const tol=Math.min(0.3,rDev*0.5),step=2*Math.acos(1-tol/rDev);
 return Math.max(1,Math.min(256,Math.ceil(Math.abs(sweep)/(step||0.5))));
}
/* signed orientation of a closed polygon if it is convex and simple (+1 / -1), else 0 */
function convexity(p,start,n){
 if(n<3)return 0;
 let sign=0,turn=0,px=p[start+2*(n-1)],py=p[start+2*(n-1)+1],qx=p[start],qy=p[start+1];
 let ex=qx-px,ey=qy-py,k=0;
 while(ex*ex+ey*ey<1e-12&&k<n){px=qx;py=qy;k++;const i=start+2*(k%n);qx=p[i];qy=p[i+1];ex=qx-px;ey=qy-py;}
 for(let i=0;i<n;i++){
  const j=start+2*((k+i+1)%n),nx=p[j],ny=p[j+1],fx=nx-qx,fy=ny-qy;
  if(fx*fx+fy*fy<1e-12)continue;
  const cr=ex*fy-ey*fx,dt=ex*fx+ey*fy;
  if(Math.abs(cr)>1e-9*Math.sqrt((ex*ex+ey*ey)*(fx*fx+fy*fy))){const s=cr>0?1:-1;if(!sign)sign=s;else if(s!==sign)return 0;}
  else if(dt<0)return 0;   /* a hairpin back along itself */
  turn+=Math.atan2(cr,dt);
  ex=fx;ey=fy;qx=nx;qy=ny;
 }
 return sign&&Math.abs(Math.abs(turn)-TAU)<0.05?sign:0;
}
function signedArea(p,start,n){let a=0;for(let i=0;i<n;i++){const j=(i+1)%n;a+=p[start+2*i]*p[start+2*j+1]-p[start+2*j]*p[start+2*i+1];}return a/2;}
/* winding number of point (x,y) about a closed polygon */
function winding(p,start,n,x,y){
 let w=0;
 for(let i=0;i<n;i++){
  const ax=p[start+2*i],ay=p[start+2*i+1],j=(i+1)%n,bx=p[start+2*j],by=p[start+2*j+1];
  if(ay<=y){if(by>y&&(bx-ax)*(y-ay)-(x-ax)*(by-ay)>0)w++;}
  else if(by<=y&&(bx-ax)*(y-ay)-(x-ax)*(by-ay)<0)w--;
 }
 return w;
}
/* dashes: cut polyline pts (x,y pairs) into the on-runs of the pattern; returns arrays of x,y pairs */
function dashPolyline(pts,closed,pattern,offset){
 const out=[];let total=0;for(const d of pattern)total+=d;
 if(!(total>0))return [pts];
 const n=pts.length/2,segs=closed?n:n-1;
 let pi=0,left=pattern[0],on=true;
 let off=((offset%total)+total)%total;
 while(off>0){if(off>=left){off-=left;pi=(pi+1)%pattern.length;left=pattern[pi];on=!on;}else{left-=off;off=0;}}
 let cur=on?[pts[0],pts[1]]:null;
 for(let s=0;s<segs;s++){
  const ax=pts[2*s],ay=pts[2*s+1],j=(s+1)%n,bx=pts[2*j],by=pts[2*j+1];
  let len=Math.hypot(bx-ax,by-ay),pos=0;
  if(!(len>0))continue;
  while(len-pos>left){
   pos+=left;const t=pos/len,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
   if(on){cur.push(x,y);if(cur.length>=4)out.push(cur);cur=null;}else cur=[x,y];
   on=!on;pi=(pi+1)%pattern.length;left=pattern[pi];
  }
  left-=len-pos;
  if(on)cur.push(bx,by);
 }
 if(on&&cur&&cur.length>=4)out.push(cur);
 return out;
}
/* triangles collect here: x,y corner pairs, three to a triangle */
class TriBuf{
 constructor(){this.a=new Float32Array(1<<14);this.n=0;}
 t(x0,y0,x1,y1,x2,y2){let a=this.a,n=this.n;if(n+6>a.length){const b=new Float32Array(a.length*2);b.set(a);this.a=a=b;}
  a[n]=x0;a[n+1]=y0;a[n+2]=x1;a[n+3]=y1;a[n+4]=x2;a[n+5]=y2;this.n=n+6;}
}
let DP=new Float64Array(2048);
/* stroke outline triangles for one polyline (x,y pairs in an array-like, in the space where the pen is round) into out.t(...).
   Joins and caps overlap the segments freely: every draw has its own depth, so a stroke never blends over itself. */
function strokePolyline(pts,closed,hw,join,cap,miterLimit,out){
 const cnt=pts.length>>1;
 if(DP.length<cnt*2+4)DP=new Float64Array(cnt*2+256);
 const p=DP;let n=0;
 for(let i=0;i<cnt;i++){const x=pts[2*i],y=pts[2*i+1];if(n&&Math.abs(p[2*n-2]-x)<1e-7&&Math.abs(p[2*n-1]-y)<1e-7)continue;p[2*n]=x;p[2*n+1]=y;n++;}
 if(closed&&n>2&&Math.abs(p[0]-p[2*n-2])<1e-7&&Math.abs(p[1]-p[2*n-1])<1e-7)n--;
 const fine=hw<1.25;   /* a pen this thin shows no difference between a round join and a bevel */
 if(fine&&join==='round')join='bevel';
 if(n<2){
  if(n===1&&cap!=='butt'){const x=p[0],y=p[1];if(cap==='round')fanCircle(x,y,hw,out);else{out.t(x-hw,y-hw,x+hw,y-hw,x+hw,y+hw);out.t(x-hw,y-hw,x+hw,y+hw,x-hw,y+hw);}}
  return;
 }
 const segs=closed?n:n-1;
 for(let s=0;s<segs;s++){
  const ax=p[2*s],ay=p[2*s+1],j=(s+1)%n,bx=p[2*j],by=p[2*j+1];
  let dx=bx-ax,dy=by-ay;const L=Math.hypot(dx,dy);dx/=L;dy/=L;
  const nx=-dy*hw,ny=dx*hw;
  let sx=0,sy=0,ex=0,ey=0;
  if(!closed&&cap==='square'){if(s===0){sx=dx*hw;sy=dy*hw;}if(s===segs-1){ex=dx*hw;ey=dy*hw;}}
  const x0=ax-sx,y0=ay-sy,x1=bx+ex,y1=by+ey;
  out.t(x0+nx,y0+ny,x1+nx,y1+ny,x1-nx,y1-ny);out.t(x0+nx,y0+ny,x1-nx,y1-ny,x0-nx,y0-ny);
 }
 const first=closed?0:1,last=closed?n:n-1;
 for(let i=first;i<last;i++){
  const pi=(i-1+n)%n,ni=(i+1)%n,x=p[2*i],y=p[2*i+1];
  let d0x=x-p[2*pi],d0y=y-p[2*pi+1],d1x=p[2*ni]-x,d1y=p[2*ni+1]-y;
  const l0=Math.hypot(d0x,d0y),l1=Math.hypot(d1x,d1y);if(!(l0>0&&l1>0))continue;
  d0x/=l0;d0y/=l0;d1x/=l1;d1y/=l1;
  const cr=d0x*d1y-d0y*d1x,dt=d0x*d1x+d0y*d1y;
  if(dt>0.9996&&Math.abs(cr)<0.03)continue;   /* nearly straight on: the segments already meet */
  const side=cr>0?-1:1;   /* the outer side of the turn */
  const n0x=-d0y*hw*side,n0y=d0x*hw*side,n1x=-d1y*hw*side,n1y=d1x*hw*side;
  if(join==='round'){
   const a0=Math.atan2(n0y,n0x);let sw=Math.atan2(n1y,n1x)-a0;
   while(sw>Math.PI)sw-=TAU;while(sw<-Math.PI)sw+=TAU;
   const k=Math.max(1,Math.ceil(Math.abs(sw)/(2*Math.acos(Math.max(-1,1-Math.min(0.3,hw*.5)/hw)))||1));
   const st=sw/k,cs=Math.cos(st),ss=Math.sin(st);let c=n0x/hw,q=n0y/hw,px=x+n0x,py=y+n0y;
   for(let m=1;m<=k;m++){const nc=c*cs-q*ss;q=q*cs+c*ss;c=nc;const qx=x+c*hw,qy=y+q*hw;out.t(x,y,px,py,qx,qy);px=qx;py=qy;}
  }else{
   out.t(x,y,x+n0x,y+n0y,x+n1x,y+n1y);   /* the bevel, always: the miter is laid over it */
   if(join==='miter'){
    const cosHalf=Math.sqrt(Math.max(0,(1+dt)/2));
    if(cosHalf>1e-6&&1/cosHalf<=miterLimit){
     const mx=n0x+n1x,my=n0y+n1y,ml=Math.hypot(mx,my);
     if(ml>1e-9){const len=hw/cosHalf;out.t(x+n0x,y+n0y,x+mx/ml*len,y+my/ml*len,x+n1x,y+n1y);}
    }
   }
  }
 }
 if(!closed&&cap==='round'){
  const k=fine?2:Math.max(2,Math.ceil(Math.PI/(2*Math.acos(Math.max(-1,1-Math.min(0.3,hw*.5)/hw)))||2));
  const st=Math.PI/k,cs=Math.cos(st),ss=Math.sin(st);
  const cap1=(x,y,dx,dy)=>{let c=-dy,q=dx,px=x+c*hw,py=y+q*hw;for(let m=1;m<=k;m++){const nc=c*cs-q*ss;q=q*cs+c*ss;c=nc;const qx=x+c*hw,qy=y+q*hw;out.t(x,y,px,py,qx,qy);px=qx;py=qy;}};
  let dx=p[2]-p[0],dy=p[3]-p[1],l=Math.hypot(dx,dy);cap1(p[0],p[1],dx/l,dy/l);
  dx=p[2*n-4]-p[2*n-2];dy=p[2*n-3]-p[2*n-1];l=Math.hypot(dx,dy);cap1(p[2*n-2],p[2*n-1],dx/l,dy/l);
 }
}
function fanCircle(x,y,r,out){
 const k=Math.max(6,Math.min(64,Math.ceil(TAU/(2*Math.acos(Math.max(-1,1-Math.min(0.3,r*.5)/Math.max(r,1e-6))))||6)));
 const st=TAU/k,cs=Math.cos(st),ss=Math.sin(st);let c=1,q=0,px=x+r,py=y;
 for(let m=1;m<=k;m++){const nc=c*cs-q*ss;q=q*cs+c*ss;c=nc;const qx=x+c*r,qy=y+q*r;out.t(x,y,px,py,qx,qy);px=qx;py=qy;}
}
/* gradient ramp: 256 premultiplied RGBA8 texels from [offset,colour,...] stops, interpolated unpremultiplied as the spec asks */
function rampTexels(stops,out,at){
 const st=[];
 for(let i=0;i<stops.length;i+=2){const c=parseColor(stops[i+1]);if(c)st.push([clamp01(stops[i]),c]);}
 if(!st.length){out.fill(0,at,at+1024);return;}
 st.sort((a,b)=>a[0]-b[0]);   /* stable: equal offsets keep the order they were added in */
 for(let x=0;x<256;x++){
  const t=x/255;let c;
  if(t<=st[0][0])c=st[0][1];
  else if(t>=st[st.length-1][0])c=st[st.length-1][1];
  else{
   let k=0;while(k<st.length-1&&st[k+1][0]<t)k++;
   const [o0,c0]=st[k],[o1,c1]=st[k+1],f=o1>o0?(t-o0)/(o1-o0):1;
   c=[c0[0]+(c1[0]-c0[0])*f,c0[1]+(c1[1]-c0[1])*f,c0[2]+(c1[2]-c0[2])*f,c0[3]+(c1[3]-c0[3])*f];
  }
  const a=c[3],i=at+x*4;
  out[i]=Math.round(c[0]*a*255);out[i+1]=Math.round(c[1]*a*255);out[i+2]=Math.round(c[2]*a*255);out[i+3]=Math.round(a*255);
 }
}

/* ================================================================== the 2D state */
const BLACK=[0,0,0,1],CLEAR=[0,0,0,0],NODASH=[];
class St{
 constructor(){this.reset();}
 reset(){this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0;this.alpha=1;this.comp='source-over';this.fillV='#000000';this.fill=BLACK;this.strokeV='#000000';this.stroke=BLACK;
  this.lw=1;this.cap='butt';this.join='miter';this.miter=10;this.dash=NODASH;this.dashOff=0;this.font='10px sans-serif';this.align='start';this.baseline='alphabetic';
  this.direction='inherit';this.letterSpacing='0px';this.fontKerning='auto';this.shBlur=0;this.shColorV='rgba(0, 0, 0, 0)';this.shColor=CLEAR;this.shX=0;this.shY=0;
  this.filter='none';this.smooth=true;this.smoothQ='low';this.clipRect=null;this.clipPaths=null;return this;}
 copyFrom(o){this.a=o.a;this.b=o.b;this.c=o.c;this.d=o.d;this.e=o.e;this.f=o.f;this.alpha=o.alpha;this.comp=o.comp;this.fillV=o.fillV;this.fill=o.fill;
  this.strokeV=o.strokeV;this.stroke=o.stroke;this.lw=o.lw;this.cap=o.cap;this.join=o.join;this.miter=o.miter;this.dash=o.dash;this.dashOff=o.dashOff;
  this.font=o.font;this.align=o.align;this.baseline=o.baseline;this.direction=o.direction;this.letterSpacing=o.letterSpacing;this.fontKerning=o.fontKerning;
  this.shBlur=o.shBlur;this.shColorV=o.shColorV;this.shColor=o.shColor;this.shX=o.shX;this.shY=o.shY;this.filter=o.filter;this.smooth=o.smooth;this.smoothQ=o.smoothQ;
  this.clipRect=o.clipRect;this.clipPaths=o.clipPaths;return this;}
}

/* ================================================================== the context */
const COMPOSITE={   /* premultiplied blend functions: [srcRGB,dstRGB,srcA,dstA] as GL enums, filled in once gl exists */
 'source-over':['ONE','ONE_MINUS_SRC_ALPHA'],'lighter':['ONE','ONE'],'screen':['ONE','ONE_MINUS_SRC_COLOR'],
 'multiply':['DST_COLOR','ONE_MINUS_SRC_ALPHA','ONE','ONE_MINUS_SRC_ALPHA'],'destination-out':['ZERO','ONE_MINUS_SRC_ALPHA'],
 'destination-in':['ZERO','SRC_ALPHA'],'source-atop':['DST_ALPHA','ONE_MINUS_SRC_ALPHA'],'source-in':['DST_ALPHA','ZERO'],
 'source-out':['ONE_MINUS_DST_ALPHA','ZERO'],'destination-over':['ONE_MINUS_DST_ALPHA','ONE'],'destination-atop':['ONE_MINUS_DST_ALPHA','SRC_ALPHA'],
 'copy':['ONE','ZERO'],'xor':['ONE_MINUS_DST_ALPHA','ONE_MINUS_SRC_ALPHA'],'clear':['ZERO','ZERO']
};
const FLOATS=7;   /* x,y,z,u,v,colour,info */
const MAXV=1<<16,MAXI=MAXV*3;

function supported(){
 try{const c=document.createElement('canvas');return !!c.getContext('webgl2');}catch(e){return false;}
}

function create(canvas,opts={}){
 installTracking();
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
 if(!gl)return null;
 const R={gl,canvas,lost:false,warned:new Set(),lodBias:opts.lodBias==null?-0.5:opts.lodBias};   /* lodBias: a sharper mip level when pictures shrink; -0.5 measured closest to the game's own downscaling (Silverfjord: mean difference 5.3 -> 2.6) */
 const warn=m=>{if(opts.quiet||R.warned.has(m))return;R.warned.add(m);try{console.warn('GL2D: '+m);}catch(e){}};
 const E=n=>gl[n];
 for(const k in COMPOSITE)COMPOSITE[k]=COMPOSITE[k].map(v=>typeof v==='string'?gl[v]:v);
 const maxUnits=gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
 const NSLOT=Math.max(1,Math.min(14,maxUnits-2));
 const MAXTEX=gl.getParameter(gl.MAX_TEXTURE_SIZE);
 const SAMPLES=Math.max(0,Math.min(opts.samples==null?4:opts.samples,gl.getParameter(gl.MAX_SAMPLES)||0));

 /* ---- programs */
 function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('GL2D shader: '+gl.getShaderInfoLog(s));return s;}
 function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('GL2D link: '+gl.getProgramInfoLog(p));
  const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i),nm=a.name.replace(/\[0\]$/,'');u[nm]=gl.getUniformLocation(p,a.name);}
  return {p,u};}
 let P,PQ;
 function buildPrograms(){
  P={batch:program(VS,batchFS(NSLOT)),blur:program(QUAD_VS,BLUR_FS),shadow:program(QUAD_VS,SHADOW_FS),adv:program(QUAD_VS,ADV_FS)};
  gl.useProgram(P.batch.p);
  gl.uniform1iv(P.batch.u.u_tex,Array.from({length:NSLOT},(_,i)=>i));
  gl.uniform1i(P.batch.u.u_grad,NSLOT);gl.uniform1i(P.batch.u.u_lut,NSLOT+1);
 }

 /* ---- buffers */
 const vbuf=new ArrayBuffer(MAXV*FLOATS*4),vf=new Float32Array(vbuf),vu=new Uint32Array(vbuf);
 const ib=new Uint32Array(MAXI);
 let vcount=0,icount=0,vao=null,vbo=null,ibo=null,quadVao=null,quadVbo=null;
 function buildBuffers(){
  vao=gl.createVertexArray();gl.bindVertexArray(vao);
  vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,vbuf.byteLength,gl.STREAM_DRAW);
  const S=FLOATS*4;
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,S,0);
  gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,S,12);
  gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.UNSIGNED_BYTE,true,S,20);
  gl.enableVertexAttribArray(3);gl.vertexAttribIPointer(3,1,gl.UNSIGNED_INT,S,24);
  ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ib.byteLength,gl.STREAM_DRAW);
  quadVao=gl.createVertexArray();gl.bindVertexArray(quadVao);
  quadVbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadVbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
  gl.bindVertexArray(vao);
 }

 /* ---- samplers: smooth (with or without mip levels), pixel-sharp, repeating */
 let SMP;
 function buildSamplers(){
  const mk=(min,mag,wrap)=>{const s=gl.createSampler();gl.samplerParameteri(s,gl.TEXTURE_MIN_FILTER,min);gl.samplerParameteri(s,gl.TEXTURE_MAG_FILTER,mag);
   gl.samplerParameteri(s,gl.TEXTURE_WRAP_S,wrap);gl.samplerParameteri(s,gl.TEXTURE_WRAP_T,wrap);return s;};
  SMP={linear:mk(gl.LINEAR,gl.LINEAR,gl.CLAMP_TO_EDGE),mip:mk(gl.LINEAR_MIPMAP_LINEAR,gl.LINEAR,gl.CLAMP_TO_EDGE),
   nearest:mk(gl.NEAREST,gl.NEAREST,gl.CLAMP_TO_EDGE),repeat:mk(gl.LINEAR,gl.LINEAR,gl.REPEAT),repeatMip:mk(gl.LINEAR_MIPMAP_LINEAR,gl.LINEAR,gl.REPEAT)};
  try{const ext=gl.getExtension('EXT_texture_filter_anisotropic');if(ext){const m=Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT));gl.samplerParameterf(SMP.mip,ext.TEXTURE_MAX_ANISOTROPY_EXT,m);}}catch(e){}
 }

 /* ---- gradient table (geometry, RGBA32F, 2 texels a row) and colour ramps (RGBA8, 256 wide) */
 const GROWS=4096,LROWS=512;
 const gradData=new Float32Array(GROWS*8),lutData=new Uint8Array(256*4*LROWS);
 let gradTex=null,lutTex=null,gradN=0,gradUp=0,lutN=0,lutDirtyLo=LROWS,lutDirtyHi=-1;const lutRows=new Map();
 function buildGradTex(){
  gradTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,gradTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,2,GROWS,0,gl.RGBA,gl.FLOAT,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  lutTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,lutTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,256,LROWS,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gradN=gradUp=lutN=0;lutRows.clear();lutDirtyLo=LROWS;lutDirtyHi=-1;
 }
 function lutRow(info){
  if(!info.key){let k='';for(let i=0;i<info.stops.length;i+=2)k+=info.stops[i]+':'+info.stops[i+1]+';';info.key=k||'-';}
  let row=lutRows.get(info.key);
  if(row!==undefined)return row;
  if(lutN>=LROWS){flush('lut-full');lutRows.clear();lutN=0;lutDirtyLo=LROWS;lutDirtyHi=-1;}
  row=lutN++;rampTexels(info.stops,lutData,row*1024);lutRows.set(info.key,row);
  if(row<lutDirtyLo)lutDirtyLo=row;if(row>lutDirtyHi)lutDirtyHi=row;
  return row;
 }
 function gradRow(info,inv){   /* the gradient's geometry in the space its uv are given in (user space at paint time) */
  if(gradN>=GROWS)flush('grad-full');
  if(gradN>=GROWS){gradN=gradUp=0;}
  const r=gradN++,i=r*8;
  gradData[i]=info.type;gradData[i+1]=info.x0;gradData[i+2]=info.y0;gradData[i+3]=info.r0;
  gradData[i+4]=info.x1;gradData[i+5]=info.y1;gradData[i+6]=info.r1;gradData[i+7]=lutRow(info);
  return r;
 }
 function uploadGradients(){
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  if(gradN>gradUp){gl.bindTexture(gl.TEXTURE_2D,gradTex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,gradUp,2,gradN-gradUp,gl.RGBA,gl.FLOAT,gradData,gradUp*8);gradUp=gradN;}
  if(lutDirtyHi>=lutDirtyLo){gl.bindTexture(gl.TEXTURE_2D,lutTex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   gl.texSubImage2D(gl.TEXTURE_2D,0,0,lutDirtyLo,256,lutDirtyHi-lutDirtyLo+1,gl.RGBA,gl.UNSIGNED_BYTE,lutData,lutDirtyLo*1024);lutDirtyLo=LROWS;lutDirtyHi=-1;}
 }

 /* ---- render targets: the scene (multisampled, depth+stencil), a layer for shapes drawn alone, and single-sample copies */
 let W=0,H=0,sizeDirty=true;
 const T={scene:null,sceneRB:null,sceneDS:null,layer:null,layerRB:null,layerDS:null,res:null,resTex:null,res2:null,res2Tex:null,res3:null,res3Tex:null};
 function rb(fmt){const r=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,r);
  if(SAMPLES>0)gl.renderbufferStorageMultisample(gl.RENDERBUFFER,SAMPLES,fmt,W,H);else gl.renderbufferStorage(gl.RENDERBUFFER,fmt,W,H);return r;}
 function texTarget(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return [f,t];}
 function freeTargets(){
  for(const k of ['scene','layer','res','res2','res3'])if(T[k])gl.deleteFramebuffer(T[k]);
  for(const k of ['sceneRB','sceneDS','layerRB','layerDS'])if(T[k])gl.deleteRenderbuffer(T[k]);
  for(const k of ['resTex','res2Tex','res3Tex'])if(T[k])gl.deleteTexture(T[k]);
  for(const k in T)T[k]=null;
 }
 function msTarget(){const f=gl.createFramebuffer(),c=rb(gl.RGBA8),ds=rb(gl.DEPTH24_STENCIL8);gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,c);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,ds);return [f,c,ds];}
 function ensureSize(){
  if(!sizeDirty&&T.scene)return;
  const w=Math.max(1,canvas.width|0),h=Math.max(1,canvas.height|0);
  flushBatchOnly();
  freeTargets();W=w;H=h;sizeDirty=false;
  [T.scene,T.sceneRB,T.sceneDS]=msTarget();
  gl.bindFramebuffer(gl.FRAMEBUFFER,T.scene);
  gl.disable(gl.SCISSOR_TEST);gl.colorMask(true,true,true,true);gl.depthMask(true);gl.stencilMask(0xFF);
  gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clearStencil(0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
  depthN=0;appliedClip=null;cur.target=null;cur.scissor=undefined;cur.stencilKey=null;
  bindTarget('scene');
 }
 function ensureLayer(){
  if(T.layer)return;
  [T.layer,T.layerRB,T.layerDS]=msTarget();
  [T.res,T.resTex]=texTarget();[T.res2,T.res2Tex]=texTarget();[T.res3,T.res3Tex]=texTarget();
  cur.target=null;
 }

 /* ---- GL state cache; anything that changes it flushes the batch first */
 const cur={target:null,blend:null,scissor:undefined,stencilKey:null,program:null};
 function bindTarget(name){
  if(cur.target===name)return;
  gl.bindFramebuffer(gl.FRAMEBUFFER,T[name]);gl.viewport(0,0,W,H);cur.target=name;cur.stencilKey=null;
 }
 function setBlend(mode){
  if(cur.blend===mode)return;
  const b=COMPOSITE[mode]||COMPOSITE['source-over'];
  gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);
  gl.blendFuncSeparate(b[0],b[1],b.length>2?b[2]:b[0],b.length>2?b[3]:b[1]);
  cur.blend=mode;
 }
 function setScissor(r){   /* r: [x0,y0,x1,y1] in device px (top-left origin) or null; remembered by identity */
  if(cur.scissor===r)return;
  if(!r)gl.disable(gl.SCISSOR_TEST);
  else{gl.enable(gl.SCISSOR_TEST);const x0=Math.max(0,Math.floor(r[0])),y0=Math.max(0,Math.floor(r[1])),x1=Math.min(W,Math.ceil(r[2])),y1=Math.min(H,Math.ceil(r[3]));
   gl.scissor(x0,H-Math.max(y0,y1),Math.max(0,x1-x0),Math.max(0,y1-y0));}
  cur.scissor=r;
 }

 /* ---- textures */
 const texMap=new WeakMap(),live=new Set();let frameNo=0;
 const stats={frames:0,draws:0,flushes:0,uploads:0,uploadPx:0,textMiss:0,stencilFills:0,isolated:0,verts:0,reasons:{},upBy:{}};
 const STALE=900;
 function sourceSize(src){
  if(src instanceof HTMLImageElement)return src.complete&&src.naturalWidth?[src.naturalWidth,src.naturalHeight]:null;
  if(typeof HTMLVideoElement!=='undefined'&&src instanceof HTMLVideoElement)return src.videoWidth?[src.videoWidth,src.videoHeight]:null;
  if(typeof ImageBitmap!=='undefined'&&src instanceof ImageBitmap)return [src.width,src.height];
  const w=src.width,h=src.height;return w>0&&h>0?[w,h]:null;
 }
 function texFor(src,w,h){   /* the texture holding src as it is now (uploads on first use and after a 2D context drew into it) */
  let e=texMap.get(src);
  const isCanvas=!(src instanceof HTMLImageElement)&&!(typeof ImageBitmap!=='undefined'&&src instanceof ImageBitmap);
  const ver=isCanvas?(src.__glv|0):0;
  if(e&&e.tex&&e.gen===gen&&e.ver===ver&&e.w===w&&e.h===h){e.last=frameNo;return e;}
  if(!e){e={tex:null,w:0,h:0,ver:-1,mip:false,ups:0,last:0,gen:-1,tiles:null};texMap.set(src,e);}
  if(w>MAXTEX||h>MAXTEX)return tileFor(e,src,w,h,ver);
  if(e.tex&&e.gen!==gen)e.tex=null;
  /* draws already in the batch sample this texture as it was: they go first */
  if(e.tex&&nslot&&slotTex.indexOf(e.tex)>=0&&slotTex.indexOf(e.tex)<nslot)flush('reupload');
  const fresh=!e.tex||e.w!==w||e.h!==h;
  if(!e.tex)e.tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,e.tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  e.ups++;
  /* a canvas that keeps changing is not worth mip levels; pictures and caches drawn once are */
  const wantMip=!isCanvas||e.ups<=2;
  try{
   if(fresh||e.mip!==wantMip){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);}
   else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,src);
   if(wantMip)gl.generateMipmap(gl.TEXTURE_2D);
  }catch(err){warn('upload failed: '+err.message);return null;}
  e.mip=wantMip;e.w=w;e.h=h;e.ver=ver;e.gen=gen;e.last=frameNo;
  stats.uploads++;stats.uploadPx+=w*h;live.add(e);
  if(GL2D_DEBUG.uploads){const k=(src.id?'#'+src.id+' ':'')+(src.constructor&&src.constructor.name)+' '+w+'x'+h+(src.__glTag?' '+src.__glTag:'');stats.upBy[k]=(stats.upBy[k]|0)+1;}
  return e;
 }
 function tileFor(e,src,w,h,ver){   /* a source bigger than a texture may be: cut into 4096 tiles */
  if(e.tiles&&e.gen===gen&&e.ver===ver&&e.w===w&&e.h===h){e.last=frameNo;return e;}
  if(e.tiles)for(const t of e.tiles)gl.deleteTexture(t.tex);
  const S=4096;e.tiles=[];
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  for(let y=0;y<h;y+=S)for(let x=0;x<w;x+=S){
   const tw=Math.min(S,w-x),th=Math.min(S,h-y),tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
   gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,x);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,y);
   try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tw,th,0,gl.RGBA,gl.UNSIGNED_BYTE,src);gl.generateMipmap(gl.TEXTURE_2D);}catch(err){warn('tile upload failed: '+err.message);}
   e.tiles.push({x,y,w:tw,h:th,tex,mip:true});
  }
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,0);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,0);
  e.tex=null;e.w=w;e.h=h;e.ver=ver;e.gen=gen;e.last=frameNo;live.add(e);stats.uploads++;stats.uploadPx+=w*h;
  return e;
 }
 function sweep(){
  for(const e of live)if(frameNo-e.last>STALE){
   if(e.tex)gl.deleteTexture(e.tex);if(e.tiles)for(const t of e.tiles)gl.deleteTexture(t.tex);
   e.tex=null;e.tiles=null;e.ver=-1;live.delete(e);
  }
 }
 let gen=0;   /* bumps when the context is lost: every texture is uploaded again */

 /* ---- the batch */
 const slotTex=new Array(NSLOT).fill(null),slotSmp=new Array(NSLOT).fill(null);let nslot=0;
 function slotFor(tex,smp){
  for(let i=0;i<nslot;i++)if(slotTex[i]===tex&&slotSmp[i]===smp)return i;
  if(nslot>=NSLOT)return -1;
  slotTex[nslot]=tex;slotSmp[nslot]=smp;return nslot++;
 }
 let depthN=0;
 const DSTEP=1/(1<<22);
 function nextZ(){
  if(depthN>=(1<<22)-2){flush('depth-wrap');gl.depthMask(true);setScissor(null);gl.clear(gl.DEPTH_BUFFER_BIT);depthN=0;}
  return 1-(++depthN)*DSTEP;
 }
 function room(nv,ni){if(nv>MAXV||ni>MAXI)throw new Error('GL2D: primitive too large');if(vcount+nv>MAXV||icount+ni>MAXI)flush('full');}
 /* one vertex: device x,y; depth z; u,v; colour; info */
 function vtx(x,y,z,u,v,col,info){const o=vcount*FLOATS;vf[o]=x;vf[o+1]=y;vf[o+2]=z;vf[o+3]=u;vf[o+4]=v;vu[o+5]=col;vu[o+6]=info;return vcount++;}
 function flushBatchOnly(){
  if(!icount){vcount=0;nslot=0;return;}
  drawBatch();vcount=icount=0;nslot=0;
 }
 function drawBatch(){
  if(cur.program!=='batch'){gl.useProgram(P.batch.p);cur.program='batch';}
  gl.bindVertexArray(vao);
  gl.uniform2f(P.batch.u.u_res,W,H);gl.uniform1f(P.batch.u.u_lutH,LROWS);gl.uniform1f(P.batch.u.u_bias,R.lodBias);
  gl.activeTexture(gl.TEXTURE0+NSLOT);uploadGradients();
  for(let i=0;i<nslot;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,slotTex[i]);gl.bindSampler(i,slotSmp[i]);}
  gl.activeTexture(gl.TEXTURE0+NSLOT);gl.bindTexture(gl.TEXTURE_2D,gradTex);gl.bindSampler(NSLOT,null);
  gl.activeTexture(gl.TEXTURE0+NSLOT+1);gl.bindTexture(gl.TEXTURE_2D,lutTex);gl.bindSampler(NSLOT+1,null);
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferSubData(gl.ARRAY_BUFFER,0,vf,0,vcount*FLOATS);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,ib,0,icount);
  gl.drawElements(gl.TRIANGLES,icount,gl.UNSIGNED_INT,0);
  stats.draws++;stats.verts+=vcount;
 }
 function flush(reason){
  if(!icount){vcount=0;nslot=0;return;}
  stats.flushes++;if(reason)stats.reasons[reason]=(stats.reasons[reason]|0)+1;
  flushBatchOnly();
 }

 /* ---- state: one object, copied field by field into a pooled stack - save/restore run hundreds of times a frame */
 const S=new St(),pool=[];let depth=0;

 /* ---- clip: scissor rectangle and the stencil's top bit (bits 0-6 count winding for a fill) */
 let appliedClip=null;   /* the clipPaths array the stencil holds now */
 function prepareClip(){   /* make the GL clip state match S before drawing into the scene */
  if(S.clipPaths!==appliedClip)rebuildStencilClip();
  setScissor(S.clipRect);
 }
 function clipStencilFunc(){   /* the stencil test for ordinary draws */
  const key=S.clipPaths?'clip':'none';
  if(cur.stencilKey===key)return;
  if(S.clipPaths){gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0x80,0x80);gl.stencilMask(0x00);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);}
  else gl.disable(gl.STENCIL_TEST);
  cur.stencilKey=key;
 }
 function rebuildStencilClip(){
  flush('clip');
  bindTarget('scene');
  gl.disable(gl.SCISSOR_TEST);cur.scissor=undefined;gl.stencilMask(0xFF);gl.clearStencil(0);gl.clear(gl.STENCIL_BUFFER_BIT);
  const list=S.clipPaths;appliedClip=list;cur.stencilKey=null;
  if(!list)return;
  gl.enable(gl.STENCIL_TEST);gl.colorMask(false,false,false,false);gl.depthMask(false);gl.disable(gl.DEPTH_TEST);
  list.forEach((cp,idx)=>{
   /* winding of this path into bits 0-6 */
   windingPass(cp.tris,cp.rule);
   /* first path: set the clip bit where it covers; later paths: clear the bit where this one does not cover */
   coverQuad(cp.bbox,idx===0?'set':'intersect',cp.rule);
  });
  gl.colorMask(true,true,true,true);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);cur.stencilKey=null;
 }
 /* raw triangle draws for stencil work: positions only, through the batch program with blending of no consequence */
 function rawTris(tris,z){
  room(tris.length/2,tris.length/2);
  for(let i=0;i<tris.length;i+=6){const a=vtx(tris[i],tris[i+1],z,0,0,0,0),b=vtx(tris[i+2],tris[i+3],z,0,0,0,0),c=vtx(tris[i+4],tris[i+5],z,0,0,0,0);ib[icount++]=a;ib[icount++]=b;ib[icount++]=c;}
 }
 function windingPass(tris,rule){
  gl.stencilFunc(gl.ALWAYS,0,0xFF);
  if(rule==='evenodd'){gl.stencilMask(0x01);gl.stencilOp(gl.KEEP,gl.KEEP,gl.INVERT);}
  else{gl.stencilMask(0x7F);gl.stencilOpSeparate(gl.FRONT,gl.KEEP,gl.KEEP,gl.INCR_WRAP);gl.stencilOpSeparate(gl.BACK,gl.KEEP,gl.KEEP,gl.DECR_WRAP);}
  rawTris(tris,0);flushBatchOnly();
 }
 function coverQuad(bb,how,rule){
  const m=rule==='evenodd'?0x01:0x7F;
  if(how==='set'){gl.stencilFunc(gl.NOTEQUAL,0x80,m);gl.stencilMask(0xFF);gl.stencilOp(gl.ZERO,gl.ZERO,gl.REPLACE);rectTris(bb);}
  else{
   gl.stencilFunc(gl.EQUAL,0x80,0x80|m);gl.stencilMask(0x80);gl.stencilOp(gl.KEEP,gl.KEEP,gl.ZERO);rectTris([0,0,W,H]);   /* clip bit and no winding: outside the new path */
   gl.stencilFunc(gl.ALWAYS,0,0xFF);gl.stencilMask(0x7F);gl.stencilOp(gl.ZERO,gl.ZERO,gl.ZERO);rectTris(bb);
  }
 }
 function rectTris(bb){rawTris([bb[0],bb[1],bb[2],bb[1],bb[2],bb[3],bb[0],bb[1],bb[2],bb[3],bb[0],bb[3]],0);flushBatchOnly();}

 /* ---- paint: what fills a primitive. Returns {col, info, uvOf(x,y)->[u,v] or null} */
 const IDENT={a:1,b:0,c:0,d:1,e:0,f:0};
 function invert(m){const det=m.a*m.d-m.b*m.c;if(!det||!Number.isFinite(det))return null;const id=1/det;
  return {a:m.d*id,b:-m.b*id,c:-m.c*id,d:m.a*id,e:(m.c*m.f-m.d*m.e)*id,f:(m.b*m.e-m.a*m.f)*id};}
 function paintFor(style,colorArr,alpha){
  if(colorArr)return {col:pack(colorArr,alpha),info:0,map:null};
  const gi=gradInfo.get(style);
  if(gi){const inv=invert(S);if(!inv)return null;const row=gradRow(gi,inv);return {col:packGray(alpha),info:255|(row<<16),map:inv,scaleU:1,scaleV:1};}
  const pi=patInfo.get(style);
  if(pi){
   const real=pi.img&&pi.img.__glSrc?pi.img.__glSrc:pi.img;
   const rs=sourceSize(real),sz=real===pi.img?rs:[pi.img.width,pi.img.height];if(!rs||!sz)return null;
   const e=texFor(real,rs[0],rs[1]);if(!e||!e.tex)return null;
   let slot=slotFor(e.tex,e.mip?SMP.repeatMip:SMP.repeat);if(slot<0){flush('slots');slot=slotFor(e.tex,e.mip?SMP.repeatMip:SMP.repeat);}
   let m=S;if(pi.m){const p=pi.m;m={a:S.a*p.a+S.c*p.b,b:S.b*p.a+S.d*p.b,c:S.a*p.c+S.c*p.d,d:S.b*p.c+S.d*p.d,e:S.a*p.e+S.c*p.f+S.e,f:S.b*p.e+S.d*p.f+S.f};}
   const inv=invert(m);if(!inv)return null;
   const rep=pi.rep||'repeat',fl=1|(rep==='repeat-x'||rep==='no-repeat'?2:0)|(rep==='repeat-y'||rep==='no-repeat'?4:0);
   return {col:packGray(alpha),info:(slot+1)|(fl<<8),map:inv,scaleU:1/sz[0],scaleV:1/sz[1]};
  }
  return null;
 }
 /* triangles (device px) into the batch with a paint; z per call */
 function emitTris(t,len,paint,z){   /* long strokes go in pieces; the pieces share the depth, so they still never blend over each other */
  const col=paint.col,info=paint.info,m=paint.map,CH=6*8192;
  for(let at=0;at<len;at+=CH){
   const end=Math.min(len,at+CH),n=(end-at)/2;room(n,n);
   for(let i=at;i<end;i+=2){
    const x=t[i],y=t[i+1];let u=0,v=0;
    if(m){u=(m.a*x+m.c*y+m.e)*paint.scaleU;v=(m.b*x+m.d*y+m.f)*paint.scaleV;}
    ib[icount++]=vtx(x,y,z,u,v,col,info);
   }
  }
 }
 function emitFan(p,start,n,paint,z){
  room(n,(n-2)*3);
  const col=paint.col,info=paint.info,m=paint.map,base=vcount;
  for(let i=0;i<n;i++){const x=p[start+2*i],y=p[start+2*i+1];let u=0,v=0;if(m){u=(m.a*x+m.c*y+m.e)*paint.scaleU;v=(m.b*x+m.d*y+m.f)*paint.scaleV;}vtx(x,y,z,u,v,col,info);}
  for(let i=1;i<n-1;i++){ib[icount++]=base;ib[icount++]=base+i;ib[icount++]=base+i+1;}
 }

 /* ---- the draw pipeline: every primitive goes through here */
 function needsIsolation(){
  const c=S.comp;
  if(ADV_MODES[c])return 'adv';
  if(S.shColor[3]>0&&(S.shBlur>0||S.shX||S.shY))return 'shadow';
  return null;
 }
 function begin(){   /* before emitting into the scene: size, target, clip, blend */
  ensureSize();
  if(cur.target!=='scene'){flush('target');bindTarget('scene');}
  if(S.clipPaths!==appliedClip)rebuildStencilClip();
  if(cur.scissor!==S.clipRect){flush('scissor');setScissor(S.clipRect);}
  const want=S.clipPaths?'clip':'none';
  if(cur.stencilKey!==want){flush('stencil');clipStencilFunc();}
  const mode=COMPOSITE[S.comp]?S.comp:'source-over';
  if(cur.blend!==mode){flush('blend');setBlend(mode);}
  if(!depthOn){gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);depthOn=true;}
  dirty=true;if(!presentQueued){presentQueued=true;queueMicrotask(present);}
 }
 let depthOn=false,dirty=false;
 /* run emit() as one primitive; isolated primitives (shadow, advanced blends) are drawn alone and composited */
 function prim(emit,bbox){
  if(R.lost)return;
  const iso=needsIsolation();
  begin();
  if(!iso){emit(nextZ());return;}
  isolated(iso,emit,bbox);
 }
 function clipBox(bb){   /* device bbox clipped to the canvas and the clip rectangle */
  let x0=Math.max(0,bb[0]),y0=Math.max(0,bb[1]),x1=Math.min(W,bb[2]),y1=Math.min(H,bb[3]);
  if(S.clipRect){x0=Math.max(x0,S.clipRect[0]);y0=Math.max(y0,S.clipRect[1]);x1=Math.min(x1,S.clipRect[2]);y1=Math.min(y1,S.clipRect[3]);}
  return x1>x0&&y1>y0?[Math.floor(x0),Math.floor(y0),Math.ceil(x1),Math.ceil(y1)]:null;
 }
 function quadProg(pr,rect,z){
  if(cur.program!==pr){gl.useProgram(P[pr].p);cur.program=pr;}
  gl.bindVertexArray(quadVao);
  gl.uniform4f(P[pr].u.u_rect,rect[0],rect[1],rect[2]-rect[0],rect[3]-rect[1]);gl.uniform2f(P[pr].u.u_res,W,H);gl.uniform1f(P[pr].u.u_z,z);
 }
 function quadDraw(){gl.drawArrays(gl.TRIANGLE_STRIP,0,4);stats.draws++;gl.bindVertexArray(vao);}
 function blitRegion(from,to,r){
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T[from]);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,T[to]);
  const y0=H-r[3],y1=H-r[1];gl.disable(gl.SCISSOR_TEST);cur.scissor=undefined;
  gl.blitFramebuffer(r[0],y0,r[2],y1,r[0],y0,r[2],y1,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);cur.target=null;
 }
 function isolated(kind,emit,bbox){
  stats.isolated++;
  flush('isolate');
  ensureLayer();
  const shadowMargin=kind==='shadow'?Math.ceil(S.shBlur*1.5)+2:1;
  const bb0=bbox||[0,0,W,H];
  const draw=[Math.floor(bb0[0])-1,Math.floor(bb0[1])-1,Math.ceil(bb0[2])+1,Math.ceil(bb0[3])+1];
  const work=[Math.max(0,draw[0]-shadowMargin),Math.max(0,draw[1]-shadowMargin),Math.min(W,draw[2]+shadowMargin),Math.min(H,draw[3]+shadowMargin)];
  if(work[2]<=work[0]||work[3]<=work[1]){return;}
  /* the blur reads its kernel's radius around every pixel of work: everything it reads must be cleared or drawn */
  const kr=kind==='shadow'?Math.ceil(Math.max(S.shBlur/2,0.3)*3)+1:0;
  const ext=[Math.max(0,work[0]-kr),Math.max(0,work[1]-kr),Math.min(W,work[2]+kr),Math.min(H,work[3]+kr)];
  /* 1. the primitive alone, in the layer */
  bindTarget('layer');
  setScissor(ext);gl.colorMask(true,true,true,true);gl.depthMask(true);gl.stencilMask(0xFF);
  gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clearStencil(0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);cur.stencilKey=null;
  setBlend('source-over');gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);
  const saveDepth=depthN;depthN=0;
  layerMode=true;emit(nextZ());flushBatchOnly();layerMode=false;
  depthN=saveDepth;
  blitRegion('layer','res',ext);   /* resolve: res = the primitive, single-sampled */
  if(kind==='shadow'){
   /* 2. blur res -> res2 (horizontal) -> res3 (vertical) */
   const sigma=S.shBlur/2;
   gl.disable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);gl.disable(gl.BLEND);cur.blend=null;cur.stencilKey=null;
   if(sigma>0){
    const band=[work[0],ext[1],work[2],ext[3]];   /* the rows the vertical pass will read */
    bindTarget('res2');setScissor(band);quadProg('blur',band,0.5);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.resTex);gl.bindSampler(0,null);
    gl.uniform1i(P.blur.u.u_src,0);gl.uniform2f(P.blur.u.u_dir,1,0);gl.uniform1f(P.blur.u.u_sigma,sigma);quadDraw();
    bindTarget('res3');setScissor(work);quadProg('blur',work,0.5);gl.bindTexture(gl.TEXTURE_2D,T.res2Tex);
    gl.uniform1i(P.blur.u.u_src,0);gl.uniform2f(P.blur.u.u_dir,0,1);gl.uniform1f(P.blur.u.u_sigma,sigma);quadDraw();
   }
   const blurred=sigma>0?T.res3Tex:T.resTex;
   /* 3. the shadow into the scene, through the clip, in the composite mode */
   bindTarget('scene');gl.enable(gl.DEPTH_TEST);depthOn=true;
   prepareClip();clipStencilFunc();setBlend(COMPOSITE[S.comp]?S.comp:'source-over');
   const sr=clipBox([work[0]+S.shX,work[1]+S.shY,work[2]+S.shX,work[3]+S.shY]);
   if(sr){quadProg('shadow',sr,nextZ());gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,blurred);gl.bindSampler(0,null);gl.uniform1i(P.shadow.u.u_src,0);
    const c=S.shColor,a=c[3];gl.uniform4f(P.shadow.u.u_color,c[0]*a,c[1]*a,c[2]*a,a);gl.uniform2f(P.shadow.u.u_off,S.shX,S.shY);quadDraw();}
   /* 4. the primitive itself, normally (a shadowed draw in an advanced mode draws in source-over) */
   const keep=S.shColor;S.shColor=CLEAR;
   try{begin();emit(nextZ());}finally{S.shColor=keep;}
   return;
  }
  /* advanced composite: blend res (src) against a copy of the scene (dst) */
  const r=clipBox(work);if(!r)return;
  blitRegion('scene','res2',r);
  bindTarget('scene');gl.enable(gl.DEPTH_TEST);depthOn=true;
  prepareClip();clipStencilFunc();gl.disable(gl.BLEND);cur.blend=null;
  quadProg('adv',r,nextZ());
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,T.resTex);gl.bindSampler(0,null);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,T.res2Tex);gl.bindSampler(1,null);gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(P.adv.u.u_src,0);gl.uniform1i(P.adv.u.u_dst,1);gl.uniform1i(P.adv.u.u_mode,ADV_MODES[S.comp]);
  quadDraw();
 }
 let layerMode=false;

 /* ---- present: the scene onto the canvas, after every task that drew */
 let presentQueued=false;
 function present(){
  presentQueued=false;
  if(R.lost||!T.scene||!dirty)return;
  dirty=false;
  flush('present');
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T.scene);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
  gl.disable(gl.SCISSOR_TEST);cur.scissor=undefined;
  gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);cur.target=null;
  frameNo++;stats.frames++;
  if(frameNo%240===0)sweep();
 }

 /* ---- context loss: draw nothing until it is back, then rebuild everything (textures upload again on use) */
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();R.lost=true;warn('context lost');},false);
 canvas.addEventListener('webglcontextrestored',()=>{R.lost=false;gen++;init();sizeDirty=true;warn('context restored');},false);
 function init(){
  buildPrograms();buildBuffers();buildSamplers();buildGradTex();
  for(const k in T)T[k]=null;W=H=0;sizeDirty=true;cur.target=cur.blend=cur.stencilKey=cur.program=null;cur.scissor=undefined;depthOn=false;
  vcount=icount=0;nslot=0;live.clear();textAtlas=null;lightVao=null;emitVao=null;
 }

 /* ---- a web font that finishes loading: text cached in the fallback font is drawn again */
 try{document.fonts&&document.fonts.addEventListener('loadingdone',()=>{if(textAtlas){flush('fonts');textAtlas.map.clear();textAtlas.shelves=[];textAtlas.y=0;}});}catch(e){}

 /* ---- canvas resizes reset the 2D state, as they do for a 2D context */
 for(const p of ['width','height']){
  const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(canvas),p)||Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,p);
  Object.defineProperty(canvas,p,{configurable:true,get(){return d.get.call(this);},set(v){d.set.call(this,v);sizeDirty=true;S.reset();depth=0;resetPath();}});
 }

 /* ================================================================ paths */
 let pts=new Float64Array(4096),np=0;   /* x,y device pairs of every subpath */
 const subs=[];let sub=null;   /* {start,n,closed} - start is a pair index */
 function resetPath(){np=0;subs.length=0;sub=null;}
 function addPt(x,y){if(np*2+2>pts.length){const q=new Float64Array(pts.length*2);q.set(pts);pts=q;}pts[np*2]=x;pts[np*2+1]=y;np++;sub.n++;}
 function newSub(x,y){sub={start:np,n:0,closed:false};subs.push(sub);addPt(x,y);}
 const tx=(x,y)=>S.a*x+S.c*y+S.e,ty=(x,y)=>S.b*x+S.d*y+S.f;
 const F=Number.isFinite,fin=(...v)=>v.every(F);
 function lastPt(){return [pts[(np-1)*2],pts[(np-1)*2+1]];}
 function ensureSub(x,y){if(!sub)newSub(tx(x,y),ty(x,y));}
 function devScale(){return Math.sqrt(Math.abs(S.a*S.d-S.b*S.c))||1e-6;}
 function arcPoints(cx,cy,rx,ry,rot,a0,sweep,connect){
  const scale=devScale()*Math.max(rx,ry),n=arcSegments(scale,sweep),cr=rot?Math.cos(rot):1,sr=rot?Math.sin(rot):0;
  const step=sweep/n,cs=Math.cos(step),ss=Math.sin(step),A=S.a,B=S.b,Cc=S.c,D=S.d,E=S.e,Fv=S.f;
  let c=Math.cos(a0),s=Math.sin(a0);
  for(let i=0;i<=n;i++){
   if(i===n){c=Math.cos(a0+sweep);s=Math.sin(a0+sweep);}   /* the end lands exactly where it should */
   const ex=c*rx,ey=s*ry,ux=cx+ex*cr-ey*sr,uy=cy+ex*sr+ey*cr,X=A*ux+Cc*uy+E,Y=B*ux+D*uy+Fv;
   if(i===0){if(sub&&connect)addPt(X,Y);else newSub(X,Y);}else addPt(X,Y);
   const nc=c*cs-s*ss;s=s*cs+c*ss;c=nc;
  }
 }
 /* the subpaths' triangles for stencil work + their device bbox */
 function pathFan(){
  const tris=[];const bb=[Infinity,Infinity,-Infinity,-Infinity];
  for(const s of subs){if(s.n<3)continue;const o=s.start*2;
   for(let i=0;i<s.n;i++){const x=pts[o+2*i],y=pts[o+2*i+1];if(x<bb[0])bb[0]=x;if(y<bb[1])bb[1]=y;if(x>bb[2])bb[2]=x;if(y>bb[3])bb[3]=y;}
   for(let i=1;i<s.n-1;i++)tris.push(pts[o],pts[o+1],pts[o+2*i],pts[o+2*i+1],pts[o+2*i+2],pts[o+2*i+3]);}
  return {tris,bb};
 }
 function bboxOf(arr){const bb=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<arr.length;i+=2){const x=arr[i],y=arr[i+1];if(x<bb[0])bb[0]=x;if(y<bb[1])bb[1]=y;if(x>bb[2])bb[2]=x;if(y>bb[3])bb[3]=y;}return bb;}
 /* a Path2D: what was built into it (pathOps) laid into the current path under the transform of the moment, as the canvas
    does - false when it cannot be (made from SVG text, or before tracking) */
 function replayPath(ops){
  for(let i=0;i<ops.length;i+=2){
   const op=ops[i],a=ops[i+1];
   if(op==='svg')return false;
   if(op==='addPath'){
    if(!a[0])return false;
    if(!a[1]){if(!replayPath(a[0]))return false;continue;}
    const keep=[S.a,S.b,S.c,S.d,S.e,S.f],m=a[1];C.transform(m.a,m.b,m.c,m.d,m.e,m.f);
    const ok=replayPath(a[0]);[S.a,S.b,S.c,S.d,S.e,S.f]=keep;if(!ok)return false;continue;
   }
   C[op].apply(C,a);
  }
  return true;
 }
 function withPath(p,fn){   /* clip/fill/stroke/isPointInPath(path): p's own path for the call, the current path kept as it was */
  const ops=pathOps.get(p);
  if(!ops){warn('a Path2D made before tracking is not laid out');return false;}
  const keepNp=np,keepPts=pts.slice(0,np*2),keepSubs=subs.slice(),keepSub=sub;
  resetPath();
  const ok=replayPath(ops);
  if(ok)fn();else warn('a Path2D made from SVG text is not laid out');
  np=keepNp;pts.set(keepPts);subs.length=0;for(const s of keepSubs)subs.push(s);sub=keepSub;
  return ok;
 }
 /* a clip path that comes back every frame - the riders' masks are thousands of one-pixel-high spans - is laid out once into
    triangles of its own units; each clip then only moves them through the transform. Straight edges only: curves are
    flattened for the scale they are drawn at, so a path with any goes through withPath every time. */
 const fanCache=new WeakMap(),STRAIGHT=new Set(['moveTo','lineTo','rect','closePath']);
 function localFan(p,ops){
  let c=fanCache.get(p);
  if(c&&c.n===ops.length)return c;
  c={n:ops.length,tris:null};
  let plain=true;for(let i=0;i<ops.length;i+=2)if(!STRAIGHT.has(ops[i])){plain=false;break;}
  if(plain){
   const keep=[S.a,S.b,S.c,S.d,S.e,S.f];S.a=1;S.b=0;S.c=0;S.d=1;S.e=0;S.f=0;
   withPath(p,()=>{c.tris=Float64Array.from(pathFan().tris);});
   [S.a,S.b,S.c,S.d,S.e,S.f]=keep;
  }
  fanCache.set(p,c);return c;
 }
 function clipCurrent(rule){
  const usable=subs.filter(s=>s.n>=3);
  if(!usable.length){S.clipRect=[0,0,0,0];return;}
  /* an axis-aligned rectangle on screen is a scissor */
  if(usable.length===1&&usable[0].n>=4&&usable[0].n<=5){
   const o=usable[0].start*2,xs=[],ys=[];for(let i=0;i<4;i++){xs.push(pts[o+2*i]);ys.push(pts[o+2*i+1]);}
   const axis=(xs[0]===xs[1]&&ys[1]===ys[2]&&xs[2]===xs[3]&&ys[3]===ys[0])||(ys[0]===ys[1]&&xs[1]===xs[2]&&ys[2]===ys[3]&&xs[3]===xs[0]);
   if(axis&&(usable[0].n===4||(pts[o+8]===pts[o]&&pts[o+9]===pts[o+1]))){
    const r=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
    const c=S.clipRect;S.clipRect=c?[Math.max(c[0],r[0]),Math.max(c[1],r[1]),Math.min(c[2],r[2]),Math.min(c[3],r[3])]:r;
    if(S.clipRect[2]<S.clipRect[0])S.clipRect[2]=S.clipRect[0];if(S.clipRect[3]<S.clipRect[1])S.clipRect[3]=S.clipRect[1];
    return;
   }
  }
  const {tris,bb}=pathFan();
  S.clipPaths=(S.clipPaths||[]).concat([{tris,rule,bbox:bb}]);
 }
 function clipWith(p,rule){   /* clip(path, rule) */
  const ops=pathOps.get(p);
  if(!ops){warn('a Path2D made before tracking is not laid out');return;}   /* unclipped rather than gone */
  const c=localFan(p,ops);
  if(!c.tris){withPath(p,()=>clipCurrent(rule));return;}
  const t=c.tris,n=t.length;
  if(!n){S.clipRect=[0,0,0,0];return;}
  const out=new Float64Array(n),bb=[Infinity,Infinity,-Infinity,-Infinity],A=S.a,B=S.b,Cc=S.c,D=S.d,E=S.e,Fv=S.f;
  for(let i=0;i<n;i+=2){
   const x=t[i],y=t[i+1],X=A*x+Cc*y+E,Y=B*x+D*y+Fv;out[i]=X;out[i+1]=Y;
   if(X<bb[0])bb[0]=X;if(Y<bb[1])bb[1]=Y;if(X>bb[2])bb[2]=X;if(Y>bb[3])bb[3]=Y;
  }
  S.clipPaths=(S.clipPaths||[]).concat([{tris:out,rule,bbox:bb}]);
 }

 function fillPath(rule){
  const usable=subs.filter(s=>s.n>=3);
  if(!usable.length)return;
  const paint=paintFor(S.fillV,typeof S.fillV==='string'?S.fill:null,S.alpha);
  if(!paint||(!paint.info&&!paint.col&&!ADV_MODES[S.comp]&&S.comp==='source-over'))return;
  /* convex subpaths of one orientation fill straight into the batch: overlaps share the draw's depth, so nonzero holds */
  let fast=rule!=='evenodd'||usable.length===1,orient=0;
  if(fast)for(const s of usable){const c=convexity(pts,s.start*2,s.n);if(!c||(orient&&c!==orient)){fast=false;break;}orient=c;}
  let bb=[Infinity,Infinity,-Infinity,-Infinity];
  for(const s of usable)for(let i=0;i<s.n;i++){const x=pts[s.start*2+2*i],y=pts[s.start*2+2*i+1];if(x<bb[0])bb[0]=x;if(y<bb[1])bb[1]=y;if(x>bb[2])bb[2]=x;if(y>bb[3])bb[3]=y;}
  if(fast){prim(z=>{for(const s of usable)emitFan(pts,s.start*2,s.n,paint,z);},bb);return;}
  const {tris}=pathFan();
  prim(z=>stencilFill(tris,bb,rule,paint,z),bb);
 }
 function stencilFill(tris,bb,rule,paint,z){   /* winding into bits 0-6, then the bbox in the paint where it is non-zero */
  stats.stencilFills++;
  flushBatchOnly();
  gl.enable(gl.STENCIL_TEST);gl.colorMask(false,false,false,false);gl.depthMask(false);gl.disable(gl.DEPTH_TEST);
  windingPass(tris,rule);
  gl.colorMask(true,true,true,true);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
  const clip=!layerMode&&S.clipPaths;
  if(rule==='evenodd')gl.stencilFunc(gl.EQUAL,clip?0x81:0x01,clip?0x81:0x01);
  else if(clip)gl.stencilFunc(gl.LESS,0x80,0xFF);
  else gl.stencilFunc(gl.NOTEQUAL,0,0x7F);
  gl.stencilMask(0x7F);gl.stencilOp(gl.ZERO,gl.ZERO,gl.ZERO);
  const q=[bb[0]-1,bb[1]-1,bb[2]+1,bb[1]-1,bb[2]+1,bb[3]+1,bb[0]-1,bb[1]-1,bb[2]+1,bb[3]+1,bb[0]-1,bb[3]+1];
  emitTris(q,q.length,paint,z);flushBatchOnly();
  cur.stencilKey=null;if(!layerMode)clipStencilFunc();else gl.disable(gl.STENCIL_TEST);
 }
 function strokePath(){
  const lines=[];for(const s of subs)if(s.n)lines.push({p:pts.subarray(s.start*2,(s.start+s.n)*2),closed:s.closed});
  strokeLines(lines);
 }
 const TB=new TriBuf();let LS=new Float64Array(1024);
 function strokeLines(lines){   /* lines: [{p: x,y pairs in device px, closed}] */
  const paint=paintFor(S.strokeV,typeof S.strokeV==='string'?S.stroke:null,S.alpha);
  if(!paint)return;
  const lw=S.lw;if(!(lw>0))return;
  /* the pen is round in user space; when the transform is a similarity it stays round on screen and we stroke in device px */
  const sim=Math.abs(S.a-S.d)<1e-9*Math.max(1,Math.abs(S.a))&&Math.abs(S.b+S.c)<1e-9*Math.max(1,Math.abs(S.b))||Math.abs(S.a+S.d)<1e-9*Math.max(1,Math.abs(S.a))&&Math.abs(S.b-S.c)<1e-9*Math.max(1,Math.abs(S.b));
  const k=devScale(),inv=sim?null:invert(S);
  if(!sim&&!inv)return;
  TB.n=0;
  const hw=sim?lw*k/2:lw/2,dash=S.dash.length?(sim?S.dash.map(d=>d*k):S.dash):null,dOff=sim?S.dashOff*k:S.dashOff;
  for(const s of lines){
   let line=s.p;
   if(!sim){const L=line.length;if(LS.length<L)LS=new Float64Array(L*2);for(let i=0;i<L;i+=2){const x=line[i],y=line[i+1];LS[i]=inv.a*x+inv.c*y+inv.e;LS[i+1]=inv.b*x+inv.d*y+inv.f;}line=LS.subarray(0,L);}
   if(dash){for(const d of dashPolyline(line,s.closed,dash,dOff))strokePolyline(d,false,hw,S.join,S.cap,S.miter,TB);}
   else strokePolyline(line,s.closed,hw,S.join,S.cap,S.miter,TB);
  }
  const a=TB.a,n=TB.n;if(!n)return;
  if(!sim)for(let i=0;i<n;i+=2){const x=a[i],y=a[i+1];a[i]=S.a*x+S.c*y+S.e;a[i+1]=S.b*x+S.d*y+S.f;}
  if(!needsIsolation()){begin();emitTris(a,n,paint,nextZ());return;}
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<n;i+=2){const x=a[i],y=a[i+1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  const copy=a.slice(0,n);prim(z=>emitTris(copy,n,paint,z),[x0,y0,x1,y1]);
 }

 /* ================================================================ text: a 2D canvas rasterises, an atlas keeps it */
 let textAtlas=null;
 const TA=2048;
 function atlas(){
  if(textAtlas&&textAtlas.gen===gen)return textAtlas;
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,TA,TA,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  textAtlas={tex,gen,map:new Map(),shelves:[],y:0};
  return textAtlas;
 }
 function atlasAlloc(w,h){
  const A=atlas();
  if(w>TA||h>TA)return null;
  for(const s of A.shelves)if(h<=s.h&&h>=s.h*0.6&&s.x+w<=TA){const r=[s.x,s.y];s.x+=w+1;return r;}
  if(A.y+h>TA){flush('atlas-full');A.map.clear();A.shelves=[];A.y=0;}
  const s={x:w+1,y:A.y,h};A.shelves.push(s);A.y+=h+1;return [0,s.y];
 }
 let tcan=null,tctx=null;
 function textCtx(){if(!tctx){tcan=document.createElement('canvas');tcan.width=tcan.height=64;tctx=tcan.getContext('2d');}return tctx;}
 function drawText(text,x,y,maxW,stroke){
  if(R.lost)return;
  text=String(text).replace(/[\t\n\f\r]/g,' ');
  if(!text||!F(x)||!F(y))return;
  const style=stroke?S.strokeV:S.fillV,col=stroke?S.stroke:S.fill;
  let colStr;
  if(typeof style==='string'){if(!col||!(col[3]>0))return;colStr=style;}
  else{const gi=gradInfo.get(style);colStr=gi&&gi.stops.length?gi.stops[1]:'#000';warn('gradient or pattern text drawn in one colour');}
  const k=Math.max(0.25,Math.round(devScale()*8)/8);
  const sh=S.shColor[3]>0&&(S.shBlur>0||S.shX||S.shY);
  const key=S.font+'|'+text+'|'+(stroke?'s'+S.lw+S.join:'f')+'|'+colStr+'|'+k+'|'+S.align+'|'+S.baseline+'|'+S.direction+'|'+S.letterSpacing+(sh?'|'+S.shBlur+','+S.shColorV+','+S.shX+','+S.shY:'');
  let A=atlas(),ent=A.map.get(key);
  if(!ent){
   stats.textMiss++;
   const g=textCtx();g.setTransform(1,0,0,1,0,0);
   g.font=S.font;g.textAlign=S.align;g.textBaseline=S.baseline;try{g.direction=S.direction;}catch(e){}try{if('letterSpacing' in g)g.letterSpacing=S.letterSpacing;}catch(e){}
   const m=g.measureText(text);
   const L=Math.max(0,m.actualBoundingBoxLeft||0),Rr=Math.max(0,m.actualBoundingBoxRight||m.width||0),As=Math.max(0,m.actualBoundingBoxAscent||0),Ds=Math.max(0,m.actualBoundingBoxDescent||0);
   const extra=(stroke?S.lw*k/2:0)+(sh?S.shBlur+Math.max(Math.abs(S.shX),Math.abs(S.shY)):0);
   const pad=Math.ceil(2+extra);
   const w=Math.max(1,Math.ceil((L+Rr)*k)+pad*2),h=Math.max(1,Math.ceil((As+Ds)*k)+pad*2);
   if(tcan.width<w||tcan.height<h){tcan.width=Math.max(tcan.width,w);tcan.height=Math.max(tcan.height,h);}
   g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,tcan.width,tcan.height);
   g.font=S.font;g.textAlign=S.align;g.textBaseline=S.baseline;try{g.direction=S.direction;}catch(e){}try{if('letterSpacing' in g)g.letterSpacing=S.letterSpacing;}catch(e){}
   const ox=pad+L*k,oy=pad+As*k;
   g.setTransform(k,0,0,k,ox,oy);
   if(sh){g.shadowBlur=S.shBlur;g.shadowColor=S.shColorV;g.shadowOffsetX=S.shX;g.shadowOffsetY=S.shY;}else{g.shadowBlur=0;g.shadowColor='rgba(0,0,0,0)';}
   if(stroke){g.strokeStyle=colStr;g.lineWidth=S.lw;g.lineJoin=S.join;g.miterLimit=S.miter;g.strokeText(text,0,0);}
   else{g.fillStyle=colStr;g.fillText(text,0,0);}
   const at=atlasAlloc(w,h);if(!at)return;
   A=atlas();
   gl.bindTexture(gl.TEXTURE_2D,A.tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
   gl.texSubImage2D(gl.TEXTURE_2D,0,at[0],at[1],w,h,gl.RGBA,gl.UNSIGNED_BYTE,tcan);
   ent={x:at[0],y:at[1],w,h,ox,oy,k,adv:m.width};A.map.set(key,ent);
  }
  /* the cached raster, in user space: its anchor at (x,y), squeezed to maxWidth if asked */
  let sx=1;if(maxW!==undefined&&Number.isFinite(+maxW)){if(+maxW<=0)return;if(ent.adv>+maxW)sx=+maxW/ent.adv;}
  const x0=x-ent.ox/ent.k*sx,y0=y-ent.oy/ent.k,x1=x0+ent.w/ent.k*sx,y1=y0+ent.h/ent.k;
  const keep=S.shColor;if(sh)S.shColor=CLEAR;   /* the shadow is in the raster */
  try{
   const c=[tx(x0,y0),ty(x0,y0),tx(x1,y0),ty(x1,y0),tx(x1,y1),ty(x1,y1),tx(x0,y1),ty(x0,y1)];
   const bb=bboxOf(c);
   prim(z=>{
    let slot=slotFor(A.tex,SMP.linear);if(slot<0){flush('slots');slot=slotFor(A.tex,SMP.linear);}
    room(4,6);const col=packGray(S.alpha),info=slot+1,u0=ent.x/TA,v0=ent.y/TA,u1=(ent.x+ent.w)/TA,v1=(ent.y+ent.h)/TA;
    const i0=vtx(c[0],c[1],z,u0,v0,col,info),i1=vtx(c[2],c[3],z,u1,v0,col,info),i2=vtx(c[4],c[5],z,u1,v1,col,info),i3=vtx(c[6],c[7],z,u0,v1,col,info);
    ib[icount++]=i0;ib[icount++]=i1;ib[icount++]=i2;ib[icount++]=i0;ib[icount++]=i2;ib[icount++]=i3;
   },bb);
  }finally{S.shColor=keep;}
 }

 /* ================================================================ drawImage */
 function drawImage(src,a1,a2,a3,a4,a5,a6,a7,a8,argc){
  if(R.lost||!src)return;
  /* the game's scaled copies point at their source: draw that, mip-mapped */
  let sx=0,sy=0,sw,sh,dx,dy,dw,dh;
  let real=src;
  if(src.__glSrc){real=src.__glSrc;}
  const size=sourceSize(real);if(!size)return;
  const [iw,ih]=size;
  const fx=real===src?1:iw/src.width,fy=real===src?1:ih/src.height;
  if(argc===3){dx=a1;dy=a2;dw=src.width||iw;dh=src.height||ih;sw=iw;sh=ih;if(real===src){dw=iw;dh=ih;}}
  else if(argc===5){dx=a1;dy=a2;dw=a3;dh=a4;sw=iw;sh=ih;}
  else{sx=a1*fx;sy=a2*fy;sw=a3*fx;sh=a4*fy;dx=a5;dy=a6;dw=a7;dh=a8;}
  if(!F(sx)||!F(sy)||!F(sw)||!F(sh)||!F(dx)||!F(dy)||!F(dw)||!F(dh))return;
  if(!sw||!sh||!dw||!dh)return;
  if(sw<0){sx+=sw;sw=-sw;}if(sh<0){sy+=sh;sh=-sh;}if(dw<0){dx+=dw;dw=-dw;}if(dh<0){dy+=dh;dh=-dh;}
  /* clip the source to the picture, the destination in proportion */
  if(sx<0){const c=-sx/sw*dw;dx+=c;dw-=c;sw+=sx;sx=0;}
  if(sy<0){const c=-sy/sh*dh;dy+=c;dh-=c;sh+=sy;sy=0;}
  if(sx+sw>iw){const c=(sx+sw-iw)/sw*dw;dw-=c;sw=iw-sx;}
  if(sy+sh>ih){const c=(sy+sh-ih)/sh*dh;dh-=c;sh=ih-sy;}
  if(!(sw>0&&sh>0&&dw>0&&dh>0))return;
  const e=texFor(real,iw,ih);if(!e)return;
  const A=S.a,B=S.b,Cc=S.c,D=S.d,E=S.e,Fv=S.f,x1=dx+dw,y1=dy+dh;
  const ax=A*dx+Cc*dy+E,ay=B*dx+D*dy+Fv,bx=A*x1+Cc*dy+E,by=B*x1+D*dy+Fv,cx=A*x1+Cc*y1+E,cy=B*x1+D*y1+Fv,qx=A*dx+Cc*y1+E,qy=B*dx+D*y1+Fv;
  const bx0=Math.min(ax,bx,cx,qx),by0=Math.min(ay,by,cy,qy),bx1=Math.max(ax,bx,cx,qx),by1=Math.max(ay,by,cy,qy);
  const iso=needsIsolation();
  if(bx1<0||by1<0||bx0>(W||canvas.width)||by0>(H||canvas.height)){if(!iso||!(S.shX||S.shY||S.shBlur))return;}
  if(!iso&&!e.tiles&&!R.lost){   /* the common case: one quad straight into the batch */
   begin();const z=nextZ(),smp=!S.smooth?SMP.nearest:e.mip?SMP.mip:SMP.linear;
   let slot=slotFor(e.tex,smp);if(slot<0){flush('slots');slot=slotFor(e.tex,smp);}
   room(4,6);const col=packGray(S.alpha),info=slot+1,u0=sx/iw,v0=sy/ih,u1=(sx+sw)/iw,v1=(sy+sh)/ih;
   const i0=vtx(ax,ay,z,u0,v0,col,info),i1=vtx(bx,by,z,u1,v0,col,info),i2=vtx(cx,cy,z,u1,v1,col,info),i3=vtx(qx,qy,z,u0,v1,col,info);
   ib[icount++]=i0;ib[icount++]=i1;ib[icount++]=i2;ib[icount++]=i0;ib[icount++]=i2;ib[icount++]=i3;
   return;
  }
  const bb=[bx0,by0,bx1,by1];
  prim(z=>{
   if(e.tiles){
    for(const t of e.tiles){
     const ix0=Math.max(sx,t.x),iy0=Math.max(sy,t.y),ix1=Math.min(sx+sw,t.x+t.w),iy1=Math.min(sy+sh,t.y+t.h);
     if(ix1<=ix0||iy1<=iy0)continue;
     const ddx=dx+(ix0-sx)/sw*dw,ddy=dy+(iy0-sy)/sh*dh,ddw=(ix1-ix0)/sw*dw,ddh=(iy1-iy0)/sh*dh;
     quad(t.tex,t.mip,ddx,ddy,ddw,ddh,(ix0-t.x)/t.w,(iy0-t.y)/t.h,(ix1-t.x)/t.w,(iy1-t.y)/t.h,z);
    }
    return;
   }
   quad(e.tex,e.mip,dx,dy,dw,dh,sx/iw,sy/ih,(sx+sw)/iw,(sy+sh)/ih,z);
  },bb);
 }
 function quad(tex,mip,dx,dy,dw,dh,u0,v0,u1,v1,z){
  const smp=!S.smooth?SMP.nearest:mip?SMP.mip:SMP.linear;
  let slot=slotFor(tex,smp);if(slot<0){flush('slots');slot=slotFor(tex,smp);}
  room(4,6);
  const col=packGray(S.alpha),info=slot+1;
  const x1=dx+dw,y1=dy+dh;
  const i0=vtx(tx(dx,dy),ty(dx,dy),z,u0,v0,col,info),i1=vtx(tx(x1,dy),ty(x1,dy),z,u1,v0,col,info),i2=vtx(tx(x1,y1),ty(x1,y1),z,u1,v1,col,info),i3=vtx(tx(dx,y1),ty(dx,y1),z,u0,v1,col,info);
  ib[icount++]=i0;ib[icount++]=i1;ib[icount++]=i2;ib[icount++]=i0;ib[icount++]=i2;ib[icount++]=i3;
 }

 /* ================================================================ rectangles */
 function rectPoly(x,y,w,h){return [tx(x,y),ty(x,y),tx(x+w,y),ty(x+w,y),tx(x+w,y+h),ty(x+w,y+h),tx(x,y+h),ty(x,y+h)];}
 function fillRectImpl(x,y,w,h){
  if(R.lost||!F(x)||!F(y)||!F(w)||!F(h)||!w||!h)return;
  if(typeof S.fillV==='string'&&!needsIsolation()){   /* a plain colour: four vertices straight into the batch */
   const col=pack(S.fill,S.alpha);if(!col&&S.comp==='source-over')return;
   begin();room(4,6);const z=nextZ(),A=S.a,B=S.b,Cc=S.c,D=S.d,E=S.e,Fv=S.f,x1=x+w,y1=y+h;
   const i0=vtx(A*x+Cc*y+E,B*x+D*y+Fv,z,0,0,col,0),i1=vtx(A*x1+Cc*y+E,B*x1+D*y+Fv,z,0,0,col,0),i2=vtx(A*x1+Cc*y1+E,B*x1+D*y1+Fv,z,0,0,col,0),i3=vtx(A*x+Cc*y1+E,B*x+D*y1+Fv,z,0,0,col,0);
   ib[icount++]=i0;ib[icount++]=i1;ib[icount++]=i2;ib[icount++]=i0;ib[icount++]=i2;ib[icount++]=i3;
   return;
  }
  const paint=paintFor(S.fillV,typeof S.fillV==='string'?S.fill:null,S.alpha);
  if(!paint)return;
  if(!paint.col&&!paint.info&&S.comp==='source-over'&&!needsIsolation())return;
  const p=rectPoly(x,y,w,h);
  prim(z=>emitFan(p,0,4,paint,z),bboxOf(p));
 }
 function clearRectImpl(x,y,w,h){
  if(R.lost||!fin(x,y,w,h)||!w||!h)return;
  ensureSize();
  const p=rectPoly(x,y,w,h),bb=bboxOf(p);
  if(!S.clipPaths&&!S.clipRect&&bb[0]<=0&&bb[1]<=0&&bb[2]>=W&&bb[3]>=H){   /* the whole canvas: a real clear */
   flush('clear');bindTarget('scene');setScissor(null);gl.colorMask(true,true,true,true);gl.depthMask(true);
   gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);depthN=0;
   dirty=true;if(!presentQueued){presentQueued=true;queueMicrotask(present);}
   return;
  }
  const keepComp=S.comp,keepSh=S.shColor;S.comp='clear';S.shColor=CLEAR;
  try{prim(z=>emitFan(p,0,4,{col:0,info:0,map:null},z),bb);}finally{S.comp=keepComp;S.shColor=keepSh;}
 }

 /* ================================================================ post passes: light, bloom, rays, soft layers (2026-10-09)
    Each pass flushes, copies the scene so far into a texture, works in targets of its own and writes back into the scene, so the
    game keeps drawing on top of the result (the HUD, the weather and the vignette stay out of the light). Light and bloom work in
    half floats where the GPU can render them, so a lamp may light a wall past white before the soft shoulder brings it back. */
 const FLOATRT=!!gl.getExtension('EXT_color_buffer_float');
 const PP={};
 function ppTarget(name,w,h,hdr){
  w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));
  let t=PP[name];
  const hd=!!(hdr&&FLOATRT);
  if(t&&t.w===w&&t.h===h&&t.gen===gen&&t.hdr===hd)return t;
  if(t&&t.gen===gen){gl.deleteFramebuffer(t.fbo);gl.deleteTexture(t.tex);}
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,hd?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,hd?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  t=PP[name]={fbo,tex,w,h,gen,hdr:hd};cur.target=null;return t;
 }
 function ppProgram(name,fs,vs){
  if(P[name]&&P[name].gen===gen)return P[name];
  const p=program(vs||PP_VS,fs);p.gen=gen;P[name]=p;return p;
 }
 function into(t){gl.bindFramebuffer(gl.FRAMEBUFFER,t?t.fbo:T.scene);gl.viewport(0,0,t?t.w:W,t?t.h:H);cur.target=null;}
 function texUnit(i,tex){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);gl.bindSampler(i,null);}
 function fullQuad(p){if(cur.program!==p){gl.useProgram(P[p].p);cur.program=p;}gl.bindVertexArray(quadVao);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);stats.draws++;gl.bindVertexArray(vao);}
 /* begin: the batch drawn, the scene resolved into T.resTex, no depth, stencil or scissor in the way */
 function postBegin(resolve=true){
  flush('post');ensureSize();ensureLayer();
  if(resolve)blitRegion('scene','res',[0,0,W,H]);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);gl.disable(gl.SCISSOR_TEST);gl.colorMask(true,true,true,true);
  depthOn=false;cur.stencilKey=null;cur.scissor=undefined;cur.blend=null;stats.isolated++;
 }
 function postEnd(){gl.activeTexture(gl.TEXTURE0);cur.target=null;cur.blend=null;cur.program=null;dirty=true;if(!presentQueued){presentQueued=true;queueMicrotask(present);}}
 function blendAdd(){gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE);}
 function blendOver(){gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}

 /* ---- the light map: ambient everywhere, every light added in, then the scene multiplied by it.
    A light (device px): x,y the ground under it, fx,fy its flame, reach/head the radii of the pool on the ground and of the light
    round the flame, color rgb 0-1, level 0-1. Falloff as the 2D lamps have it: (1+(r/h)^2)^-1.5 brought to nothing at the edge. */
 let lightVao=null,lightBuf=null,lightData=new Float32Array(16*64),emitVao=null,emitBuf=null,emitData=new Float32Array(8*64);
 function lightMap(o){
  if(R.lost)return;
  postBegin();
  const s=o.scale||.5,lt=ppTarget('light',W*s,H*s,true);
  ppProgram('light',LIGHT_FS,LIGHT_VS);ppProgram('lmix',LMIX_FS);
  into(lt);gl.disable(gl.BLEND);
  const a=o.ambient||[1,1,1];gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  const L=o.lights||[],n=L.length;
  if(n){
   if(lightData.length<n*16)lightData=new Float32Array(n*32);
   const inten=o.intensity==null?1:o.intensity;
   for(let i=0;i<n;i++){const l=L[i],j=i*16,c=l.color||[1,.84,.61],v=(l.level==null?1:l.level)*inten;
    lightData[j]=l.x;lightData[j+1]=l.y;lightData[j+2]=l.fx==null?l.x:l.fx;lightData[j+3]=l.fy==null?l.y:l.fy;
    lightData[j+4]=l.reach;lightData[j+5]=l.head||l.reach*.55;lightData[j+6]=o.flat||.8;lightData[j+7]=v;
    lightData[j+8]=c[0];lightData[j+9]=c[1];lightData[j+10]=c[2];lightData[j+11]=o.poolH||.335;
    lightData[j+12]=o.headH||.33;lightData[j+13]=0;lightData[j+14]=0;lightData[j+15]=0;}
   if(!lightVao){
    lightVao=gl.createVertexArray();gl.bindVertexArray(lightVao);
    gl.bindBuffer(gl.ARRAY_BUFFER,quadVbo);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
    lightBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,lightBuf);
    for(let k=0;k<4;k++){gl.enableVertexAttribArray(1+k);gl.vertexAttribPointer(1+k,4,gl.FLOAT,false,64,k*16);gl.vertexAttribDivisor(1+k,1);}
   }
   gl.bindVertexArray(lightVao);gl.bindBuffer(gl.ARRAY_BUFFER,lightBuf);gl.bufferData(gl.ARRAY_BUFFER,lightData.subarray(0,n*16),gl.STREAM_DRAW);
   gl.useProgram(P.light.p);cur.program='light';gl.uniform2f(P.light.u.u_res,W,H);
   blendAdd();gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,n);stats.draws++;
   gl.bindVertexArray(vao);
  }
  /* the scene times the light, with a soft shoulder above white */
  into(null);gl.disable(gl.BLEND);
  gl.useProgram(P.lmix.p);cur.program='lmix';texUnit(0,T.resTex);texUnit(1,lt.tex);
  gl.uniform1i(P.lmix.u.u_scene,0);gl.uniform1i(P.lmix.u.u_light,1);gl.uniform3f(P.lmix.u.u_amb,a[0],a[1],a[2]);gl.uniform1f(P.lmix.u.u_over,o.over==null?.15:o.over);
  gl.uniform1f(P.lmix.u.u_knee,o.knee==null?1.5:o.knee);gl.uniform1f(P.lmix.u.u_max,o.max==null?1.15:o.max);
  fullQuad('lmix');
  postEnd();
 }

 /* ---- bloom: what is brighter than the threshold, blurred down a chain of halving targets and back up, added onto the scene */
 function bloom(o){
  if(R.lost)return;
  postBegin();
  const levels=Math.max(1,Math.min(7,o.levels||5)),s0=o.scale||.5;
  ppProgram('bright',BRIGHT_FS);ppProgram('down',DOWN_FS);ppProgram('up',UP_FS);ppProgram('addmix',ADD_FS);
  const B=[];for(let i=0;i<levels;i++)B.push(ppTarget('bloom'+i,W*s0/(1<<i),H*s0/(1<<i),true));
  gl.disable(gl.BLEND);
  into(B[0]);gl.useProgram(P.bright.p);cur.program='bright';texUnit(0,T.resTex);
  gl.uniform1i(P.bright.u.u_src,0);gl.uniform2f(P.bright.u.u_px,1/W,1/H);gl.uniform1f(P.bright.u.u_thr,o.threshold==null?.8:o.threshold);gl.uniform1f(P.bright.u.u_knee,o.knee==null?.25:o.knee);
  gl.uniform1f(P.bright.u.u_white,o.white==null?.25:o.white);
  fullQuad('bright');
  const E=o.emit||[],ne=E.length;
  if(ne){   /* the emitters straight into the bright level */
   ppProgram('emit',EMIT_FS,EMIT_VS);
   if(emitData.length<ne*8)emitData=new Float32Array(ne*16);
   for(let i=0;i<ne;i++){const e=E[i],j=i*8,c=e.color||[1,1,1];emitData[j]=e.x;emitData[j+1]=e.y;emitData[j+2]=Math.max(1,e.r);emitData[j+3]=0;emitData[j+4]=c[0];emitData[j+5]=c[1];emitData[j+6]=c[2];emitData[j+7]=e.k==null?1:e.k;}
   if(!emitVao){emitVao=gl.createVertexArray();gl.bindVertexArray(emitVao);
    gl.bindBuffer(gl.ARRAY_BUFFER,quadVbo);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
    emitBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,emitBuf);
    for(let k=0;k<2;k++){gl.enableVertexAttribArray(1+k);gl.vertexAttribPointer(1+k,4,gl.FLOAT,false,32,k*16);gl.vertexAttribDivisor(1+k,1);}}
   gl.bindVertexArray(emitVao);gl.bindBuffer(gl.ARRAY_BUFFER,emitBuf);gl.bufferData(gl.ARRAY_BUFFER,emitData.subarray(0,ne*8),gl.STREAM_DRAW);
   gl.useProgram(P.emit.p);cur.program='emit';gl.uniform2f(P.emit.u.u_res,W,H);blendAdd();
   gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,ne);stats.draws++;gl.bindVertexArray(vao);gl.disable(gl.BLEND);
  }
  for(let i=1;i<levels;i++){into(B[i]);gl.useProgram(P.down.p);cur.program='down';texUnit(0,B[i-1].tex);gl.uniform1i(P.down.u.u_src,0);gl.uniform2f(P.down.u.u_px,1/B[i-1].w,1/B[i-1].h);fullQuad('down');}
  blendAdd();
  for(let i=levels-1;i>0;i--){into(B[i-1]);gl.useProgram(P.up.p);cur.program='up';texUnit(0,B[i].tex);gl.uniform1i(P.up.u.u_src,0);gl.uniform2f(P.up.u.u_px,1/B[i].w,1/B[i].h);gl.uniform1f(P.up.u.u_k,o.spread==null?1:o.spread);fullQuad('up');}
  into(null);gl.useProgram(P.addmix.p);cur.program='addmix';texUnit(0,B[0].tex);gl.uniform1i(P.addmix.u.u_src,0);
  const c=o.tint||[1,1,1],k=o.strength==null?.6:o.strength;gl.uniform4f(P.addmix.u.u_color,c[0]*k,c[1]*k,c[2]*k,0);gl.uniform2f(P.addmix.u.u_px,1/B[0].w,1/B[0].h);gl.uniform2f(P.addmix.u.u_shift,0,0);gl.uniform1f(P.addmix.u.u_flip,0);
  fullQuad('addmix');
  postEnd();
 }

 /* ---- light shafts: beams out of the sun at (x,y) device px - on or off the screen - in a colour, cut by a shadow layer if given */
 function rays(o){
  if(R.lost)return;
  postBegin(false);
  const s=o.scale||.5,A=ppTarget('raysA',W*s,H*s,true);
  ppProgram('rays',RAYS_FS);ppProgram('addmix',ADD_FS);
  let shadowTex=null;
  if(o.shadow){const sz=sourceSize(o.shadow);const e=sz&&texFor(o.shadow,sz[0],sz[1]);shadowTex=e&&e.tex;}
  gl.disable(gl.BLEND);
  into(A);gl.useProgram(P.rays.p);cur.program='rays';texUnit(0,shadowTex||T.resTex);
  const dir=o.dir||[1,0],dl=Math.hypot(dir[0],dir[1])||1,wm=o.world||{a:1,e:0,f:0};   /* the light's way, and world -> device px */
  gl.uniform1i(P.rays.u.u_shadow,0);gl.uniform1f(P.rays.u.u_hasShadow,shadowTex?1:0);gl.uniform2f(P.rays.u.u_pos,o.x,o.y);gl.uniform2f(P.rays.u.u_res,W,H);
  gl.uniform2f(P.rays.u.u_dir,dir[0]/dl,dir[1]/dl);gl.uniform3f(P.rays.u.u_world,wm.a||1,wm.e||0,wm.f||0);
  gl.uniform1f(P.rays.u.u_time,o.time||0);gl.uniform1f(P.rays.u.u_reach,o.reach==null?.9:o.reach);gl.uniform1f(P.rays.u.u_block,o.block==null?.22:o.block);
  fullQuad('rays');
  into(null);blendAdd();gl.useProgram(P.addmix.p);cur.program='addmix';texUnit(0,A.tex);gl.uniform1i(P.addmix.u.u_src,0);
  const c=o.color||[1,.85,.6],k=o.strength==null?.3:o.strength;gl.uniform4f(P.addmix.u.u_color,c[0]*k,c[1]*k,c[2]*k,0);gl.uniform2f(P.addmix.u.u_px,1/A.w,1/A.h);gl.uniform2f(P.addmix.u.u_shift,0,0);gl.uniform1f(P.addmix.u.u_flip,0);
  fullQuad('addmix');
  postEnd();
 }

 /* ---- heat haze: the scene redrawn through HAZE_FS - sources {x,y (device px), r, k}, up to 24; global: a hot land's own shimmer;
    world {x,y,s}: the world's 0,0 on the screen and its scale, so the ripples stay on the ground */
 const hazeData=new Float32Array(96);
 function heatHaze(o){
  if(R.lost)return;
  const src=o.sources||[],n=Math.min(24,src.length),g0=Math.max(0,Math.min(1,o.global||0));
  if(!n&&!(g0>0))return;
  postBegin();
  ppProgram('haze',HAZE_FS);
  into(null);gl.disable(gl.BLEND);
  hazeData.fill(0);
  for(let i=0;i<n;i++){const q=src[i];hazeData[i*4]=q.x;hazeData[i*4+1]=q.y;hazeData[i*4+2]=Math.max(4,q.r||0);hazeData[i*4+3]=q.k??1;}
  gl.useProgram(P.haze.p);cur.program='haze';texUnit(0,T.resTex);
  gl.uniform1i(P.haze.u.u_scene,0);gl.uniform2f(P.haze.u.u_res,W,H);gl.uniform1f(P.haze.u.u_time,o.time||0);gl.uniform1f(P.haze.u.u_amp,o.amp||2.2);
  const wo=o.world||{};gl.uniform2f(P.haze.u.u_org,wo.x||0,wo.y||0);gl.uniform1f(P.haze.u.u_sc,wo.s||1);
  gl.uniform1f(P.haze.u.u_global,g0);gl.uniform1i(P.haze.u.u_n,n);gl.uniform4fv(P.haze.u.u_src,hazeData);
  fullQuad('haze');
  postEnd();
 }

 /* ---- a screen-sized layer (a 2D canvas, any resolution) laid over the whole view, gaussian-blurred first: the sun's shadows */
 function drawBlurred(src,alpha,sigma,dx=0,dy=0){   /* dx,dy: the layer laid that many device px over (a phone's kept shadows following the camera) */
  if(R.lost||!src)return;
  const sz=sourceSize(src);if(!sz)return;
  postBegin(false);
  const e=texFor(src,sz[0],sz[1]);if(!e||!e.tex){postEnd();return;}
  ppProgram('blur1',BLUR1_FS);ppProgram('addmix',ADD_FS);
  const A=ppTarget('sbA',sz[0],sz[1],false),Bt=ppTarget('sbB',sz[0],sz[1],false);
  gl.disable(gl.BLEND);
  const pass=(dst,tex,dx,dy,flip)=>{into(dst);gl.useProgram(P.blur1.p);cur.program='blur1';texUnit(0,tex);gl.uniform1i(P.blur1.u.u_src,0);
   gl.uniform2f(P.blur1.u.u_dir,dx/sz[0],dy/sz[1]);gl.uniform1f(P.blur1.u.u_sigma,Math.max(.01,sigma));gl.uniform1f(P.blur1.u.u_flip,flip?1:0);fullQuad('blur1');};
  pass(A,e.tex,1,0,true);   /* the canvas texture has its top row first: turn it the GL way up here */
  pass(Bt,A.tex,0,1,false);
  into(null);blendOver();gl.useProgram(P.addmix.p);cur.program='addmix';texUnit(0,Bt.tex);gl.uniform1i(P.addmix.u.u_src,0);
  gl.uniform4f(P.addmix.u.u_color,alpha,alpha,alpha,alpha);gl.uniform2f(P.addmix.u.u_px,0,0);gl.uniform1f(P.addmix.u.u_flip,0);gl.uniform2f(P.addmix.u.u_shift,-(+dx||0)/W,(+dy||0)/H);
  fullQuad('addmix');
  postEnd();
 }

 init();

 /* ================================================================ the object the game holds as ctx */
 const C={
  get canvas(){return canvas;},
  isGL:true,
  /* state */
  save(){const t=pool[depth]||(pool[depth]=new St());t.copyFrom(S);depth++;},
  restore(){if(depth>0){depth--;S.copyFrom(pool[depth]);}},
  reset(){S.reset();depth=0;resetPath();sizeDirty=true;},
  getContextAttributes(){return {alpha:true,desynchronized:false,colorSpace:'srgb',willReadFrequently:false};},
  isContextLost(){return R.lost;},
  /* transforms */
  scale(x,y){if(!F(x)||!F(y))return;S.a*=x;S.b*=x;S.c*=y;S.d*=y;},
  translate(x,y){if(!F(x)||!F(y))return;S.e+=S.a*x+S.c*y;S.f+=S.b*x+S.d*y;},
  rotate(t){if(!F(t))return;const c=Math.cos(t),s=Math.sin(t),a=S.a,b=S.b;S.a=a*c+S.c*s;S.b=b*c+S.d*s;S.c=S.c*c-a*s;S.d=S.d*c-b*s;},
  transform(a,b,c,d,e,f){if(!fin(a,b,c,d,e,f))return;const A=S.a,B=S.b,Cc=S.c,D=S.d;
   S.a=A*a+Cc*b;S.b=B*a+D*b;S.c=A*c+Cc*d;S.d=B*c+D*d;S.e=A*e+Cc*f+S.e;S.f=B*e+D*f+S.f;},
  setTransform(a,b,c,d,e,f){
   if(arguments.length===0){S.a=1;S.b=0;S.c=0;S.d=1;S.e=0;S.f=0;return;}
   if(typeof a==='object'&&a){const m=a;const v=[m.a??m.m11??1,m.b??m.m12??0,m.c??m.m21??0,m.d??m.m22??1,m.e??m.m41??0,m.f??m.m42??0];if(!fin(...v))return;[S.a,S.b,S.c,S.d,S.e,S.f]=v;return;}
   if(!fin(a,b,c,d,e,f))return;S.a=a;S.b=b;S.c=c;S.d=d;S.e=e;S.f=f;},
  resetTransform(){S.a=1;S.b=0;S.c=0;S.d=1;S.e=0;S.f=0;},
  getTransform(){return new DOMMatrix([S.a,S.b,S.c,S.d,S.e,S.f]);},
  /* paths */
  beginPath(){resetPath();},
  moveTo(x,y){if(!F(x)||!F(y))return;newSub(tx(x,y),ty(x,y));},
  lineTo(x,y){if(!F(x)||!F(y))return;if(!sub){newSub(tx(x,y),ty(x,y));return;}addPt(tx(x,y),ty(x,y));},
  closePath(){if(!sub||!sub.n)return;sub.closed=true;const o=sub.start*2;newSub(pts[o],pts[o+1]);},
  quadraticCurveTo(cx,cy,x,y){if(!F(cx)||!F(cy)||!F(x)||!F(y))return;ensureSub(cx,cy);
   const [x0,y0]=lastPt(),X1=tx(cx,cy),Y1=ty(cx,cy),X2=tx(x,y),Y2=ty(x,y);
   const L=Math.hypot(X1-x0,Y1-y0)+Math.hypot(X2-X1,Y2-Y1),n=Math.max(2,Math.min(64,Math.ceil(L/6)));
   for(let i=1;i<=n;i++){const t=i/n,u=1-t;addPt(u*u*x0+2*u*t*X1+t*t*X2,u*u*y0+2*u*t*Y1+t*t*Y2);}},
  bezierCurveTo(c1x,c1y,c2x,c2y,x,y){if(!fin(c1x,c1y,c2x,c2y,x,y))return;ensureSub(c1x,c1y);
   const [x0,y0]=lastPt(),X1=tx(c1x,c1y),Y1=ty(c1x,c1y),X2=tx(c2x,c2y),Y2=ty(c2x,c2y),X3=tx(x,y),Y3=ty(x,y);
   const L=Math.hypot(X1-x0,Y1-y0)+Math.hypot(X2-X1,Y2-Y1)+Math.hypot(X3-X2,Y3-Y2),n=Math.max(2,Math.min(96,Math.ceil(L/6)));
   for(let i=1;i<=n;i++){const t=i/n,u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;addPt(a*x0+b*X1+c*X2+d*X3,a*y0+b*Y1+c*Y2+d*Y3);}},
  arc(x,y,r,a0,a1,ccw){if(!F(x)||!F(y)||!F(r)||!F(a0)||!F(a1))return;if(r<0)throw new DOMException('negative radius','IndexSizeError');
   arcPoints(x,y,r,r,0,a0,arcSweep(a0,a1,!!ccw),true);},
  ellipse(x,y,rx,ry,rot,a0,a1,ccw){if(!F(x)||!F(y)||!F(rx)||!F(ry)||!F(rot)||!F(a0)||!F(a1))return;if(rx<0||ry<0)throw new DOMException('negative radius','IndexSizeError');
   arcPoints(x,y,rx,ry,rot,a0,arcSweep(a0,a1,!!ccw),true);},
  arcTo(x1,y1,x2,y2,r){if(!fin(x1,y1,x2,y2,r))return;ensureSub(x1,y1);
   const inv=invert(S),[dx0,dy0]=lastPt(),x0=inv?inv.a*dx0+inv.c*dy0+inv.e:x1,y0=inv?inv.b*dx0+inv.d*dy0+inv.f:y1;
   const v1x=x0-x1,v1y=y0-y1,v2x=x2-x1,v2y=y2-y1,l1=Math.hypot(v1x,v1y),l2=Math.hypot(v2x,v2y);
   const cr=v1x*v2y-v1y*v2x;
   if(!l1||!l2||Math.abs(cr)<1e-9||!r){addPt(tx(x1,y1),ty(x1,y1));return;}
   const cos=(v1x*v2x+v1y*v2y)/(l1*l2),ang=Math.acos(Math.max(-1,Math.min(1,cos))),d=r/Math.tan(ang/2);
   const p1x=x1+v1x/l1*d,p1y=y1+v1y/l1*d,p2x=x1+v2x/l2*d,p2y=y1+v2y/l2*d;
   const bx=(v1x/l1+v2x/l2),by=(v1y/l1+v2y/l2),bl=Math.hypot(bx,by),dc=r/Math.sin(ang/2),cx=x1+bx/bl*dc,cy=y1+by/bl*dc;
   const s0=Math.atan2(p1y-cy,p1x-cx),s1=Math.atan2(p2y-cy,p2x-cx);
   addPt(tx(p1x,p1y),ty(p1x,p1y));arcPoints(cx,cy,r,r,0,s0,arcSweep(s0,s1,cr>0),true);},
  rect(x,y,w,h){if(!fin(x,y,w,h))return;newSub(tx(x,y),ty(x,y));addPt(tx(x+w,y),ty(x+w,y));addPt(tx(x+w,y+h),ty(x+w,y+h));addPt(tx(x,y+h),ty(x,y+h));sub.closed=true;newSub(tx(x,y),ty(x,y));},
  roundRect(x,y,w,h,radii){if(!fin(x,y,w,h))return;let r=radii===undefined?[0]:Array.isArray(radii)?radii:[radii];
   r=r.map(v=>typeof v==='object'&&v?Math.max(0,+(v.x??0)):Math.max(0,+v||0));
   const [tl,tr,br,bl]=r.length===1?[r[0],r[0],r[0],r[0]]:r.length===2?[r[0],r[1],r[0],r[1]]:r.length===3?[r[0],r[1],r[2],r[1]]:r;
   const f=Math.min(1,Math.abs(w)/Math.max(1e-9,tl+tr,bl+br),Math.abs(h)/Math.max(1e-9,tl+bl,tr+br));
   const R0=tl*f,R1=tr*f,R2=br*f,R3=bl*f,sx=w<0?-1:1,sy=h<0?-1:1;
   newSub(tx(x+R0*sx,y),ty(x+R0*sx,y));
   arcPoints(x+w-R1*sx,y+R1*sy,R1,R1,0,-Math.PI/2,Math.PI/2*sx*sy,true);
   arcPoints(x+w-R2*sx,y+h-R2*sy,R2,R2,0,0,Math.PI/2*sx*sy,true);
   arcPoints(x+R3*sx,y+h-R3*sy,R3,R3,0,Math.PI/2,Math.PI/2*sx*sy,true);
   arcPoints(x+R0*sx,y+R0*sy,R0,R0,0,Math.PI,Math.PI/2*sx*sy,true);
   sub.closed=true;newSub(tx(x,y),ty(x,y));},
  fill(a,b){if(a&&typeof a==='object'){withPath(a,()=>fillPath(typeof b==='string'?b:'nonzero'));return;}fillPath(typeof a==='string'?a:'nonzero');},
  stroke(a){if(a&&typeof a==='object'){withPath(a,strokePath);return;}strokePath();},
  clip(a,b){if(a&&typeof a==='object'){clipWith(a,typeof b==='string'?b:'nonzero');return;}clipCurrent(typeof a==='string'?a:'nonzero');},
  isPointInPath(a,b,c){
   if(a&&typeof a==='object'){let r=false;const rule=arguments[3];withPath(a,()=>{r=C.isPointInPath(b,c,rule);});return r;}
   const X=a,Y=b,rule=c;let w=0,odd=0;for(const s of subs){if(s.n<3)continue;const n=winding(pts,s.start*2,s.n,X,Y);w+=n;odd+=Math.abs(n)%2;}
   return rule==='evenodd'?odd%2===1:w!==0;},
  isPointInStroke(){return false;},
  /* drawing */
  fillRect(x,y,w,h){fillRectImpl(x,y,w,h);},
  strokeRect(x,y,w,h){if(!fin(x,y,w,h))return;strokeLines([{p:rectPoly(x,y,w,h),closed:true}]);},
  clearRect(x,y,w,h){clearRectImpl(x,y,w,h);},
  drawImage(src,a1,a2,a3,a4,a5,a6,a7,a8){drawImage(src,a1,a2,a3,a4,a5,a6,a7,a8,arguments.length);},
  fillText(t,x,y,m){drawText(t,x,y,m,false);},
  strokeText(t,x,y,m){drawText(t,x,y,m,true);},
  measureText(t){const g=textCtx();g.setTransform(1,0,0,1,0,0);g.font=S.font;g.textAlign=S.align;g.textBaseline=S.baseline;try{if('letterSpacing' in g)g.letterSpacing=S.letterSpacing;}catch(e){}return g.measureText(String(t));},
  createLinearGradient(...a){return scratch().createLinearGradient(...a);},
  createRadialGradient(...a){return scratch().createRadialGradient(...a);},
  createConicGradient(...a){warn('conic gradients are not supported');return scratch().createConicGradient?scratch().createConicGradient(...a):null;},
  createPattern(img,rep){return scratch().createPattern(img,rep);},
  createImageData(a,b){return scratch().createImageData(a,b);},
  getImageData(x,y,w,h){
   ensureSize();present();ensureLayer();
   const out=new ImageData(Math.max(1,w|0),Math.max(1,h|0));
   gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T.scene);
   gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,T.res);gl.disable(gl.SCISSOR_TEST);cur.scissor=undefined;
   gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT,gl.NEAREST);
   gl.bindFramebuffer(gl.FRAMEBUFFER,T.res);
   const buf=new Uint8Array(out.width*out.height*4);gl.readPixels(x|0,H-((y|0)+out.height),out.width,out.height,gl.RGBA,gl.UNSIGNED_BYTE,buf);
   for(let r=0;r<out.height;r++){const src=(out.height-1-r)*out.width*4;for(let i=0;i<out.width*4;i+=4){const a=buf[src+i+3];const k=a?255/a:0;
    out.data[r*out.width*4+i]=Math.min(255,Math.round(buf[src+i]*k));out.data[r*out.width*4+i+1]=Math.min(255,Math.round(buf[src+i+1]*k));out.data[r*out.width*4+i+2]=Math.min(255,Math.round(buf[src+i+2]*k));out.data[r*out.width*4+i+3]=a;}}
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);cur.target=null;return out;},
  putImageData(img,x,y){const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').putImageData(img,0,0);
   const keep=new St().copyFrom(S);S.a=1;S.b=0;S.c=0;S.d=1;S.e=0;S.f=0;S.alpha=1;S.comp='copy';S.shColor=CLEAR;S.clipPaths=null;S.clipRect=null;
   try{drawImage(c,x,y,0,0,0,0,0,0,3);}finally{S.copyFrom(keep);}},
  setLineDash(a){if(!Array.isArray(a)&&!(a&&typeof a.length==='number'))return;const v=Array.from(a,Number);if(v.some(x=>!Number.isFinite(x)||x<0))return;S.dash=v.length%2?v.concat(v):v;},
  getLineDash(){return S.dash.slice();},
  drawFocusIfNeeded(){},
  /* GL2D's own */
  flush(){present();},
  present,
  stats(){return {...stats,reasons:{...stats.reasons},textures:live.size,slots:NSLOT,samples:SAMPLES,maxTexture:MAXTEX,size:[W,H]};},
  resetStats(){stats.frames=stats.draws=stats.flushes=stats.uploads=stats.uploadPx=stats.textMiss=stats.stencilFills=stats.isolated=stats.verts=0;stats.reasons={};stats.upBy={};},
  sceneTexture(){ensureLayer();blitRegion('scene','res',[0,0,W,H]);return T.resTex;},
  set lodBias(v){flush('bias');R.lodBias=+v||0;},get lodBias(){return R.lodBias;},
  /* the post passes (light, bloom, light shafts, a blurred screen layer) and whether light can go past white */
  lightMap(o){lightMap(o);},bloom(o){bloom(o);},rays(o){rays(o);},heatHaze(o){heatHaze(o);},drawBlurred(src,alpha,sigma,dx,dy){drawBlurred(src,alpha,sigma,dx,dy);},
  get hdr(){return FLOATRT;},
  gl
 };
 /* properties with the 2D API's validation */
 const prop=(name,get,set)=>Object.defineProperty(C,name,{enumerable:true,configurable:true,get,set});
 prop('globalAlpha',()=>S.alpha,v=>{v=+v;if(Number.isFinite(v)&&v>=0&&v<=1)S.alpha=v;});
 prop('globalCompositeOperation',()=>S.comp,v=>{v=String(v);if(COMPOSITE[v]||ADV_MODES[v])S.comp=v;});
 prop('fillStyle',()=>S.fillV,v=>{if(typeof v==='string'){const c=parseColor(v);if(c){S.fillV=v;S.fill=c;}}else if(v&&(gradInfo.has(v)||patInfo.has(v))){S.fillV=v;S.fill=null;}});
 prop('strokeStyle',()=>S.strokeV,v=>{if(typeof v==='string'){const c=parseColor(v);if(c){S.strokeV=v;S.stroke=c;}}else if(v&&(gradInfo.has(v)||patInfo.has(v))){S.strokeV=v;S.stroke=null;}});
 prop('lineWidth',()=>S.lw,v=>{v=+v;if(Number.isFinite(v)&&v>0)S.lw=v;});
 prop('lineCap',()=>S.cap,v=>{if(v==='butt'||v==='round'||v==='square')S.cap=v;});
 prop('lineJoin',()=>S.join,v=>{if(v==='miter'||v==='round'||v==='bevel')S.join=v;});
 prop('miterLimit',()=>S.miter,v=>{v=+v;if(Number.isFinite(v)&&v>0)S.miter=v;});
 prop('lineDashOffset',()=>S.dashOff,v=>{v=+v;if(Number.isFinite(v))S.dashOff=v;});
 /* a font is parsed once (the measuring canvas does it) and remembered: the game sets one per label every frame, and the
    parse was a twentieth of a phone's frame (2026-10-10). A sentinel tells a refused font from one already set */
 const fontNorm=new Map();
 prop('font',()=>S.font,v=>{v=String(v);let n=fontNorm.get(v);
  if(n===undefined){const g=textCtx();g.font='1px __gl2d__';g.font=v;n=g.font==='1px __gl2d__'?null:g.font;if(fontNorm.size>512)fontNorm.clear();fontNorm.set(v,n);}
  if(n)S.font=n;});
 prop('textAlign',()=>S.align,v=>{if(['start','end','left','right','center'].includes(v))S.align=v;});
 prop('textBaseline',()=>S.baseline,v=>{if(['top','hanging','middle','alphabetic','ideographic','bottom'].includes(v))S.baseline=v;});
 prop('direction',()=>S.direction,v=>{if(['ltr','rtl','inherit'].includes(v))S.direction=v;});
 prop('letterSpacing',()=>S.letterSpacing,v=>{S.letterSpacing=String(v);});
 prop('fontKerning',()=>S.fontKerning,v=>{S.fontKerning=String(v);});
 prop('wordSpacing',()=>'0px',()=>{});
 prop('shadowBlur',()=>S.shBlur,v=>{v=+v;if(Number.isFinite(v)&&v>=0)S.shBlur=v;});
 prop('shadowColor',()=>S.shColorV,v=>{const c=parseColor(String(v));if(c){S.shColorV=String(v);S.shColor=c;}});
 prop('shadowOffsetX',()=>S.shX,v=>{v=+v;if(Number.isFinite(v))S.shX=v;});
 prop('shadowOffsetY',()=>S.shY,v=>{v=+v;if(Number.isFinite(v))S.shY=v;});
 prop('filter',()=>S.filter,v=>{S.filter=String(v);if(S.filter!=='none')warn('ctx.filter is ignored on the screen canvas ('+S.filter+')');});
 prop('imageSmoothingEnabled',()=>S.smooth,v=>{S.smooth=!!v;});
 prop('imageSmoothingQuality',()=>S.smoothQ,v=>{if(v==='low'||v==='medium'||v==='high')S.smoothQ=v;});
 R.ctx=C;
 return C;
}

/* everything create() does, on a small canvas of its own, and the pixels read back: only when this passes does the game hand its
   screen canvas to WebGL (a canvas that has a WebGL context can never get a 2D one again) */
function probe(){
 let c=null,g=null;
 try{
  c=document.createElement('canvas');c.width=64;c.height=32;
  g=create(c,{samples:4,quiet:true});if(!g)return false;
  g.fillStyle='#ff0000';g.fillRect(0,0,32,32);
  g.fillStyle='rgba(0,0,255,0.5)';g.beginPath();g.arc(48,16,12,0,Math.PI*2);g.fill();
  const lg=g.createLinearGradient(0,0,32,0);lg.addColorStop(0,'#000000');lg.addColorStop(1,'#ffffff');
  g.save();g.beginPath();g.rect(0,24,32,8);g.clip();g.fillStyle=lg;g.fillRect(0,0,32,32);g.restore();
  g.fillStyle='#ffffff';g.font='10px sans-serif';g.fillText('Ab',36,30);
  const red=g.getImageData(8,8,1,1).data,blue=g.getImageData(48,16,1,1).data,grad=g.getImageData(30,28,1,1).data,top=g.getImageData(30,4,1,1).data;
  const ok=red[0]>240&&red[1]<10&&red[3]>240 && blue[2]>240&&blue[0]<10&&blue[3]>110&&blue[3]<145 && grad[0]>200&&Math.abs(grad[0]-grad[1])<3 && top[0]>240&&top[1]<10;
  return ok;
 }catch(e){try{console.warn('GL2D probe: '+(e&&e.message||e));}catch(_){}return false;}
 finally{try{const gl=g&&g.gl;const ext=gl&&gl.getExtension('WEBGL_lose_context');if(ext)ext.loseContext();}catch(e){}}
}

return {create,supported,probe,parseColor,debug:GL2D_DEBUG,_track:installTracking,_pathOps:p=>pathOps.get(p),
 _test:{arcSweep,arcSegments,convexity,signedArea,winding,dashPolyline,strokePolyline,fanCircle,TriBuf,rampTexels,pack,parseColorRaw:s=>parseColorRaw(s,1)}};
})();
/* record gradients and patterns from the start: the screen is handed to WebGL later in the load */
if(typeof window!=='undefined'&&typeof document!=='undefined')GL2D._track();
if(typeof module!=='undefined'&&module.exports)module.exports=GL2D;
