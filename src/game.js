// ===== GAME: the pond, the cell, the always-visible brain, lessons, sound, save =====
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const PAL={deep:'#0b1026',fluid:'#1c2a5a',glim:'#28e0c8',food:'#ffd86b',danger:'#ff4f6d',mind:'#b48cff'};
const FONT="system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO="ui-monospace,'Cascadia Mono',Consolas,'Courier New',monospace";
function mono(t,x,y,size,col,al){ctx.font='500 '+size+'px '+MONO;ctx.fillStyle=col;ctx.textAlign=al||'left';ctx.textBaseline='middle';ctx.fillText(t,x,y);}
const TOUCHY=window.matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
const LR={a:0.6,v:0.5}, TRAIN_TEMP=1, TEST_TEMP=0.25;
// the eight light signals and what each is meant to teach (TARGET in the core)
const SIG=[
  {col:'#ffd86b',shape:'sun'},{col:'#28e0c8',shape:'tri'},{col:'#b48cff',shape:'square'},{col:'#7fb2ff',shape:'moon'},
  {col:'#ff8fd0',shape:'spiral'},{col:'#ffffff',shape:'up'},{col:'#ffa24f',shape:'left'},{col:'#9be56b',shape:'right'}
];
const MOVE_NAME=['float','shrink','sleep','spin','hop','come to you','glow','go left','go right','wander'];

let W=1,H=1,S=1,SW=1280,SH=720,dpr=1,portrait=false,L={};
const st={
  screen:'title',paused:false,confirm:false,speed:1,brain:null,birth:null,pup:null,
  unlocked:1,stars:[0,0,0,0,0,0,0,0],cur:0,tries:[0,0,0,0,0,0,0,0],recent:[[],[],[],[],[],[],[],[]],series:[],
  test:null,result:null,t:0,saved:null,hasSave:false,dirty:false,lastSave:0,
  flash:{good:0,bad:0},backwave:0,backsign:1,parts:[],ripples:[],hover:null,
  blink:3,sigT:-1,sigCue:-1,lastUpdates:0,completed:false,press:null,longTimer:null,moved:false,mood:{good:0,bad:0,eat:0,yuck:0},
  trail:[],eye:{x:0,y:0},streak:0,lastR:0,dragCell:null,grab:0,help:-1
};

// ---------- layout ----------
function resize(){
  W=Math.max(1,innerWidth);H=Math.max(1,innerHeight);portrait=H>W*1.05;
  S=portrait?Math.min(W/760,H/1180):Math.min(W/1500,H/780);
  SW=W/S;SH=H/S;
  dpr=Math.max(1,Math.min(devicePixelRatio||1,Math.sqrt(2600000/(W*H))));
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.width=W+'px';cv.style.height=H+'px';
  layout();
}
function layout(){
  const m=14,gap=8,topH=portrait?64:58,bs=Math.max(46,Math.ceil(44/S));
  L.m=m;L.gap=gap;L.bs=bs;L.top=topH;L.btn=[];
  const sig=[];for(let i=0;i<8;i++)sig.push({id:'sig'+i,kind:'sig',i});
  const act=[{id:'treat',kind:'rew'},{id:'poison',kind:'rew'},{id:'speed',kind:'util'},{id:'test',kind:'util'},{id:'menu',kind:'util'}];
  // spread a row of buttons exactly across [x0, x0+w]
  const row=(arr,x0,y,w)=>{const bw=(w-(arr.length-1)*gap)/arr.length;arr.forEach((it,i)=>L.btn.push({...it,x:x0+i*(bw+gap),y,w:bw,h:bs}));};
  if(!portrait){
    const tbY=SH-m-bs;L.tbY=tbY;
    const availH=tbY-m-topH,cw=Math.floor((SW-3*m)*0.46),x2=2*m+cw,w2=SW-x2-m;
    L.brain={x:m,y:topH,w:cw,h:availH};
    const wh=Math.round(availH*0.66);
    L.world={x:x2,y:topH,w:w2,h:wh};
    L.graph={x:x2,y:topH+wh+m,w:w2,h:availH-wh-m};
    row(sig,m,tbY,cw);row(act,x2,tbY,w2);
  }else{
    const tbY=SH-m-2*bs-gap;L.tbY=tbY;
    const availH=tbY-m-topH,wh=Math.round(availH*0.44);
    L.world={x:m,y:topH,w:SW-2*m,h:wh};
    L.brain={x:m,y:topH+wh+m,w:SW-2*m,h:availH-wh-m};
    L.graph={x:0,y:0,w:0,h:0};
    row(sig,m,tbY,SW-2*m);row(act,m,tbY+bs+gap,SW-2*m);
  }
  // the pond keeps its shape inside its panel
  const P=L.world,k=Math.min(P.w/WW,P.h/WH);
  L.arena={x:P.x+(P.w-WW*k)/2,y:P.y+(P.h-WH*k)/2,k};
}
addEventListener('resize',resize);

// ---------- helpers ----------
function hexA(col,a){const n=parseInt(col.slice(1),16);return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')';}
function rr(x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function txt(s,x,y,size,col,al,wt,sp){
  ctx.font=(wt||300)+' '+size+'px '+FONT;ctx.fillStyle=col;ctx.textAlign=al||'left';ctx.textBaseline='middle';
  if('letterSpacing' in ctx)ctx.letterSpacing=(sp||0)+'px';ctx.fillText(s,x,y);if('letterSpacing' in ctx)ctx.letterSpacing='0px';
}
const glowCache={};
function glowSprite(col){
  if(glowCache[col])return glowCache[col];
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,col+'ff');gr.addColorStop(0.22,col+'88');gr.addColorStop(0.6,col+'22');gr.addColorStop(1,col+'00');
  g.fillStyle=gr;g.fillRect(0,0,128,128);glowCache[col]=c;return c;
}
function glow(x,y,r,col,a){if(a<=0.003)return;ctx.globalAlpha=Math.min(1,a);ctx.drawImage(glowSprite(col),x-r,y-r,r*2,r*2);ctx.globalAlpha=1;}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;}
function panel(r,tint,title,sub){
  ctx.save();rr(r.x,r.y,r.w,r.h,18);ctx.fillStyle=tint;ctx.fill();ctx.strokeStyle=hexA(PAL.glim,0.22);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  if(title)txt(title,r.x+16,r.y+17,13,hexA(PAL.glim,0.9),'left',400,2.5);
  if(sub)txt(sub,r.x+r.w-16,r.y+17,12,'rgba(200,215,255,0.6)','right',300,1);
}

// ---------- signal and move pictures (no words) ----------
function drawSig(i,x,y,r,a){
  const s=SIG[i],c=s.col;a=a===undefined?1:a;
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=hexA(c,a);ctx.fillStyle=hexA(c,a);ctx.lineWidth=Math.max(2,r*0.16);ctx.lineCap='round';ctx.lineJoin='round';
  switch(s.shape){
    case'sun':ctx.beginPath();ctx.arc(0,0,r*0.42,0,6.283);ctx.fill();for(let k=0;k<8;k++){const an=k*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(an)*r*0.62,Math.sin(an)*r*0.62);ctx.lineTo(Math.cos(an)*r*0.92,Math.sin(an)*r*0.92);ctx.stroke();}break;
    case'tri':ctx.beginPath();ctx.moveTo(-r*0.75,-r*0.55);ctx.lineTo(r*0.75,-r*0.55);ctx.lineTo(0,r*0.8);ctx.closePath();ctx.fill();break;
    case'square':ctx.beginPath();ctx.rect(-r*0.34,-r*0.34,r*0.68,r*0.68);ctx.fill();for(const q of[[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.moveTo(q[0]*r*0.9,q[1]*r*0.9);ctx.lineTo(q[0]*r*0.56,q[1]*r*0.56);ctx.stroke();}break;
    case'moon':ctx.beginPath();ctx.arc(0,0,r*0.75,0.6,5.2);ctx.arc(r*0.32,-r*0.12,r*0.58,4.7,1.1,true);ctx.closePath();ctx.fill();break;
    case'spiral':ctx.beginPath();for(let k=0;k<=40;k++){const an=k*0.36,rd=r*0.1+k*r*0.021;const px=Math.cos(an)*rd,py=Math.sin(an)*rd;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();break;
    case'up':ctx.beginPath();ctx.moveTo(-r*0.6,r*0.1);ctx.lineTo(0,-r*0.6);ctx.lineTo(r*0.6,r*0.1);ctx.moveTo(-r*0.6,r*0.7);ctx.lineTo(0,0);ctx.lineTo(r*0.6,r*0.7);ctx.stroke();break;
    case'left':ctx.beginPath();ctx.moveTo(r*0.1,-r*0.6);ctx.lineTo(-r*0.6,0);ctx.lineTo(r*0.1,r*0.6);ctx.moveTo(r*0.7,-r*0.6);ctx.lineTo(0,0);ctx.lineTo(r*0.7,r*0.6);ctx.stroke();break;
    case'right':ctx.beginPath();ctx.moveTo(-r*0.1,-r*0.6);ctx.lineTo(r*0.6,0);ctx.lineTo(-r*0.1,r*0.6);ctx.moveTo(-r*0.7,-r*0.6);ctx.lineTo(0,0);ctx.lineTo(-r*0.7,r*0.6);ctx.stroke();break;
  }
  ctx.restore();
}
// a tiny cell doing the move
function drawMoveIcon(m,x,y,r,a){
  a=a===undefined?1:a;
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';ctx.lineJoin='round';
  const body=(bx,by,br,col)=>{ctx.fillStyle=hexA(col||PAL.glim,0.85*a);ctx.beginPath();ctx.arc(bx,by,br,0,6.283);ctx.fill();ctx.fillStyle=hexA('#ffffff',0.9*a);ctx.beginPath();ctx.arc(bx-br*0.3,by-br*0.15,br*0.2,0,6.283);ctx.arc(bx+br*0.3,by-br*0.15,br*0.2,0,6.283);ctx.fill();};
  const line=(col)=>{ctx.strokeStyle=hexA(col||PAL.food,a);ctx.lineWidth=Math.max(1.8,r*0.13);};
  const arrow=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);const an=Math.atan2(y2-y1,x2-x1);ctx.lineTo(x2-Math.cos(an-0.6)*r*0.32,y2-Math.sin(an-0.6)*r*0.32);ctx.moveTo(x2,y2);ctx.lineTo(x2-Math.cos(an+0.6)*r*0.32,y2-Math.sin(an+0.6)*r*0.32);ctx.stroke();};
  switch(m){
    case 0:body(0,0,r*0.5);line(PAL.mind);ctx.beginPath();ctx.moveTo(-r*0.9,r*0.8);ctx.quadraticCurveTo(-r*0.45,r*0.5,0,r*0.8);ctx.quadraticCurveTo(r*0.45,r*1.1,r*0.9,r*0.8);ctx.stroke();break;
    case 1:body(0,0,r*0.3);line();for(const q of[[-1,-1],[1,-1],[-1,1],[1,1]])arrow(q[0]*r*0.95,q[1]*r*0.95,q[0]*r*0.5,q[1]*r*0.5);break;
    case 2:ctx.fillStyle=hexA(PAL.glim,0.85*a);ctx.beginPath();ctx.ellipse(0,r*0.3,r*0.7,r*0.36,0,0,6.283);ctx.fill();line('#cfe0ff');ctx.beginPath();ctx.moveTo(r*0.1,-r*0.75);ctx.lineTo(r*0.6,-r*0.75);ctx.lineTo(r*0.1,-r*0.25);ctx.lineTo(r*0.6,-r*0.25);ctx.stroke();break;
    case 3:body(0,0,r*0.36);line();ctx.beginPath();ctx.arc(0,0,r*0.78,-0.5,4.3);ctx.stroke();arrow(r*0.62,-r*0.52,r*0.72,-r*0.3);break;
    case 4:body(0,r*0.35,r*0.38);line();arrow(0,r*0.0,0,-r*0.9);break;
    case 5:body(0,-r*0.4,r*0.36);line();arrow(0,r*0.05,0,r*0.9);break;
    case 6:body(0,0,r*0.4,PAL.food);line();for(let k=0;k<8;k++){const an=k*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(an)*r*0.62,Math.sin(an)*r*0.62);ctx.lineTo(Math.cos(an)*r*0.92,Math.sin(an)*r*0.92);ctx.stroke();}break;
    case 7:body(r*0.45,0,r*0.36);line();arrow(r*0.0,0,-r*0.9,0);break;
    case 8:body(-r*0.45,0,r*0.36);line();arrow(0,0,r*0.9,0);break;
    case 9:body(-r*0.5,-r*0.3,r*0.3);line(PAL.mind);ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(-r*0.2,0);ctx.quadraticCurveTo(r*0.3,-r*0.7,r*0.5,0);ctx.quadraticCurveTo(r*0.7,r*0.8,-r*0.1,r*0.7);ctx.stroke();ctx.setLineDash([]);break;
  }
  ctx.restore();
}

// ---------- sound ----------
const SFX_MAX={beat:0.2,sig:0.8,treat:1.0,poison:0.9,happy:1.0,pop:0.5,boing:0.8,whirl:1.1,click:0.4,win:2.0,lose:0.8,open:0.6};
function sfx(n,o){if(!(window.PXS&&PXS.play))return;const h=PXS.play(n,o||{});const m=SFX_MAX[n];if(h&&h.stop&&m)setTimeout(()=>h.stop(),m*1000);}
function initSound(){
  if(!window.PXS)return;
  PXS.define({sig:'magic/sparkle',treat:'water/bubbles',poison:'scifi/slime',happy:'animal/creature_cute',pop:'toon/pop',boing:'toon/boing',whirl:'toon/slide_whistle',
    click:'ui/click',win:'jingle/jingles_steel',lose:'ui/error',open:'ui/open',
    beat:[0.35,0,180,0.002,0.01,0.06,0,1.6,-8]});
}
let amb=null;
function startAudio(){if(!window.PXS||amb)return;PXS.music('music/drifting');amb=PXS.loop('loop/underwater',{speed:0.3});}
function setPaused(v){st.paused=v;if(window.PXS){if(v&&PXS.pause)PXS.pause();else if(!v&&PXS.resume)PXS.resume();}}

// ---------- save ----------
function saveNow(){
  if(!(window.Plaxzy&&Plaxzy.save&&st.brain))return;
  Plaxzy.save.set({v:4,brain:st.brain.export(),birth:st.birth,stars:st.stars,unlocked:st.unlocked,cur:st.cur,tries:st.tries,upd:st.brain.updates,studio:(sd.S?sd.S.export():st.savedStudio||null)});
  st.dirty=false;st.lastSave=st.t;
}
function applySave(d){
  if(!d||typeof d!=='object'||d.v!==4)return;
  if(d.studio&&typeof d.studio==='object'){st.savedStudio=d.studio;if(sd.S)sd.S.load(d.studio);}
  const b=Brain.fromData(d.brain,mulberry((Math.random()*1e9)|0));if(!b)return;
  const num=(v,lo,hi,df)=>typeof v==='number'&&isFinite(v)?Math.max(lo,Math.min(hi,v)):df;
  st.saved={brain:b,birth:(d.birth&&d.birth.H?d.birth:b.export()),
    stars:Array.isArray(d.stars)?[0,1,2,3,4,5,6,7].map(i=>num(d.stars[i]|0,0,3,0)):[0,0,0,0,0,0,0,0],
    unlocked:num(d.unlocked|0,1,8,1),tries:[0,1,2,3,4,5,6,7].map(i=>Array.isArray(d.tries)?num(d.tries[i]|0,0,99999,0):0)};
  b.updates=num(d.upd|0,0,9999999,0);
  st.saved.cur=num(d.cur|0,0,st.saved.unlocked-1,0);st.hasSave=true;
}
function syncMask(){if(st.brain)st.brain.mask=movesFor(st.unlocked);}
function freshState(){syncMask();st.recent=[[],[],[],[],[],[],[],[]];st.series=[];st.pup=new Pup((Math.random()*1e9)|0);st.test=null;st.result=null;st.parts=[];st.trail=[];st.sigT=-1;}
function continueSave(){const s=st.saved;if(!s)return;st.brain=s.brain;st.birth=s.birth;st.stars=s.stars;st.unlocked=s.unlocked;st.cur=s.cur;st.tries=s.tries;freshState();}
function newBrain(){
  if(window.PXS&&PXS.stopSfx)PXS.stopSfx();
  st.brain=new Brain(mulberry((Math.random()*1e9)|0),27);st.birth=st.brain.export();
  st.unlocked=1;st.stars=[0,0,0,0,0,0,0,0];st.cur=0;st.tries=[0,0,0,0,0,0,0,0];st.completed=false;freshState();
}
function wipeSave(){if(window.Plaxzy&&Plaxzy.save)Plaxzy.save.set({v:4,reset:true});st.saved=null;st.hasSave=false;st.savedStudio=null;sd.S=null;if(st.screen==='studio'){enterStudio();}else newBrain();}

// ---------- ui plumbing ----------
let ui=[];const drag={slider:null};
function btn(id,x,y,w,h,fn,opts){ui.push({id,x,y,w,h,fn,o:opts||{}});}
function hit(x,y){for(let i=ui.length-1;i>=0;i--){const b=ui[i];if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)return b;}return null;}

// ---------- backdrop ----------
const motes=[],membr=[];
for(let i=0;i<70;i++)motes.push({x:Math.random(),y:Math.random(),r:0.6+Math.random()*1.8,s:0.004+Math.random()*0.012,p:Math.random()*6.28,c:Math.random()<0.7?PAL.glim:PAL.mind});
for(let i=0;i<7;i++)membr.push({x:Math.random(),y:Math.random(),r:0.12+Math.random()*0.2,p:Math.random()*6.28});
const web=[];for(let i=0;i<70;i++)web.push({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*0.012,vy:(Math.random()-.5)*0.012,p:Math.random()*6.28});
function drawBackdrop(){
  const g=ctx.createLinearGradient(0,0,0,SH);g.addColorStop(0,'#0e1531');g.addColorStop(1,PAL.deep);ctx.fillStyle=g;ctx.fillRect(0,0,SW,SH);
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const m of membr){const x=m.x*SW,y=m.y*SH,r=m.r*Math.min(SW,SH)*(1+0.03*Math.sin(st.t*0.2+m.p));ctx.strokeStyle=hexA(PAL.fluid,0.14);ctx.lineWidth=12;ctx.beginPath();ctx.arc(x,y,r,0,6.283);ctx.stroke();}
  ctx.restore();
}
function drawMotes(x0,y0,w,h){
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const m of motes){const t=st.t*m.s;const x=x0+((m.x+t*0.6)%1)*w,y=y0+((m.y+Math.sin(st.t*0.3+m.p)*0.02+t*0.3)%1)*h;ctx.fillStyle=hexA(m.c,0.35);ctx.beginPath();ctx.arc(x,y,m.r,0,6.283);ctx.fill();}
  ctx.restore();
}

// ---------- the pond ----------
function w2s(wx,wy){const a=L.arena;return{x:a.x+wx*a.k,y:a.y+wy*a.k,k:a.k};}
function drawPond(pup){
  const r=L.world,k=L.arena.k,T=st.t;
  ctx.save();rr(r.x,r.y,r.w,r.h,18);ctx.clip();
  const bg=ctx.createRadialGradient(r.x+r.w/2,r.y+r.h/2,10,r.x+r.w/2,r.y+r.h/2,r.w*0.7);bg.addColorStop(0,'#17275a');bg.addColorStop(1,'#0c1330');
  ctx.fillStyle=bg;ctx.fillRect(r.x,r.y,r.w,r.h);
  // the signal colours the whole pond while it shines
  if(st.sigT>=0){const s=SIG[st.sigCue],a=Math.min(1,st.sigT*3)*Math.min(1,(CUE_T+0.6-st.sigT)*2);
    ctx.save();ctx.globalCompositeOperation='lighter';glow(r.x+r.w/2,r.y+r.h*0.16,r.w*0.75,s.col==='#ffffff'?'#cfe0ff':s.col,0.28*a);ctx.restore();}
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const m of membr){const x=r.x+m.x*r.w,y=r.y+m.y*r.h,rad=m.r*r.w*0.8;ctx.strokeStyle=hexA(PAL.fluid,0.11);ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,y,rad,0,6.283);ctx.stroke();}
  ctx.restore();
  drawMotes(r.x,r.y,r.w,r.h);
  // "you": a warm lamp at the near edge of the pond
  const yo=w2s(WW*0.5,WH*0.8);
  ctx.save();ctx.globalCompositeOperation='lighter';glow(yo.x,yo.y,70*k*(1+0.05*Math.sin(T*2)),PAL.food,0.45);ctx.restore();
  ctx.save();ctx.translate(yo.x,yo.y);const yk=Math.max(0.8,k);
  ctx.fillStyle='rgba(12,18,48,0.85)';ctx.strokeStyle=hexA(PAL.food,0.9);ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,0,17*yk,0,6.283);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff3cf';ctx.beginPath();ctx.arc(0,-5*yk,5*yk,0,6.283);ctx.fill();ctx.beginPath();ctx.arc(0,11*yk,9.5*yk,3.1416,6.2832);ctx.fill();
  ctx.restore();
  ctx.save();rr(yo.x-22*Math.max(0.8,k),yo.y+21*Math.max(0.8,k),44*Math.max(0.8,k),17*Math.max(0.8,k),8);ctx.fillStyle=hexA(PAL.food,0.95);ctx.fill();ctx.restore();
  txt('YOU',yo.x,yo.y+30*Math.max(0.8,k),10.5*Math.max(0.8,k),'#1a1430','center',700,1.5);
  drawCell(pup,T);
  // the signal itself
  if(st.sigT>=0){
    const a=Math.min(1,st.sigT*3)*Math.min(1,(CUE_T+0.6-st.sigT)*2),sx=r.x+r.w/2,sy=r.y+r.h*0.15,rad=34*k*(1+0.08*Math.sin(st.sigT*7));
    const col=SIG[st.sigCue].col==='#ffffff'?'#cfe0ff':SIG[st.sigCue].col;
    ctx.save();ctx.globalCompositeOperation='lighter';glow(sx,sy,rad*3.2,col,0.75*a);
    for(let i=0;i<2;i++){const q=(st.sigT*0.9+i*0.5)%1;ctx.strokeStyle=hexA(col,(1-q)*0.6*a);ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx,sy,rad*(1.2+q*2.4),0,6.283);ctx.stroke();}
    ctx.restore();
    drawSig(st.sigCue,sx,sy,rad,a);
  }
  drawParts();
  ctx.restore();
  ctx.save();rr(r.x,r.y,r.w,r.h,18);ctx.strokeStyle=hexA(PAL.glim,0.25);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
}
// the creature: a soft glowing cell with a face
function drawCell(pup,T){
  const P=w2s(pup.x,pup.y),k=P.k,mv=(pup.phase==='move'||pup.phase==='rest')?pup.move:-1;
  const happy=st.mood.good>0,sad=st.mood.bad>0,yuck=st.mood.yuck>0;
  let R=33*k,sq=1,rot=0,bright=1,hop=0;
  let shrinkQ=-1,growQ=-1;const R0=R;
  if(mv===1){
    if(pup.phase==='move'){shrinkQ=pup.moveT;R*=0.4+0.6*Math.exp(-shrinkQ*7)*Math.cos(shrinkQ*16)+0.03*Math.sin(T*30)*Math.min(1,shrinkQ*3);}
    else{growQ=pup.phT;R*=1-0.6*Math.exp(-growQ*4.5)*Math.cos(growQ*11);}
  }
  if(mv===2){sq=0.62;}                               // sleep: flat
  if(mv===3)rot=pup.spin;                            // spin
  if(mv===4&&pup.jumpT>0){const q=1-pup.jumpT/0.8;hop=Math.sin(Math.PI*q)*34*k;R*=1+0.12*Math.sin(Math.PI*q);}
  if(mv===6)bright=1.9;                              // glow
  if(st.grab>0){R*=1+0.1*st.grab;}
  if(sad||yuck)bright*=0.65;
  const listen=pup.phase==='cue';
  const wob=(a)=>1+0.06*Math.sin(T*2.2+a*3)+0.03*Math.sin(T*3.7+a*5)+(pup.walk>0.1?0.05*Math.sin(T*9+a*2):0);
  const bodyCol=yuck?'#9bd66b':PAL.glim;
  // trail
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<st.trail.length;i++){const a=i/st.trail.length;const q=w2s(st.trail[i].x,st.trail[i].y);glow(q.x,q.y,(5+a*12)*k,bodyCol,a*0.3);}
  glow(P.x,P.y-hop,R*(mv===6?4.6:3.2)*(1+0.05*Math.sin(T*3)),mv===6?PAL.food:bodyCol,0.5*bright);
  ctx.restore();
  // shadow under a hop
  if(hop>0){ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.ellipse(P.x,P.y+R*0.9,R*0.8,R*0.25,0,0,6.283);ctx.fill();}
  ctx.save();ctx.translate(P.x,P.y-hop);ctx.rotate(rot);ctx.scale(1,sq);
  // flagella (tail) waving behind the way it swims
  const dir=pup.face||0,tailA=mv===5?-Math.PI/2:dir>0?Math.PI:dir<0?0:Math.PI/2*0+Math.PI/2;
  ctx.strokeStyle=hexA(bodyCol,0.7);ctx.lineWidth=3*k;ctx.lineCap='round';
  for(let f=-1;f<=1;f+=2){ctx.beginPath();const bx=Math.cos(tailA)*R*0.9,by=Math.sin(tailA)*R*0.9;ctx.moveTo(bx,by);
    for(let s2=1;s2<=6;s2++){const d=R*0.9+s2*R*0.22,wv=Math.sin(T*(pup.walk>0.1?12:4)+s2*0.9+f)*R*0.16*(0.4+pup.walk);ctx.lineTo(Math.cos(tailA)*d+Math.cos(tailA+1.57)*(wv+f*R*0.12),Math.sin(tailA)*d+Math.sin(tailA+1.57)*(wv+f*R*0.12));}ctx.stroke();}
  // membrane
  ctx.beginPath();for(let i=0;i<=40;i++){const a=i/40*6.283,rd=R*wob(a);const x=Math.cos(a)*rd,y=Math.sin(a)*rd;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();
  const bg=ctx.createRadialGradient(-R*0.3,-R*0.35,R*0.1,0,0,R*1.1);
  bg.addColorStop(0,mv===6?'rgba(255,250,215,0.98)':'rgba(215,255,250,0.95)');bg.addColorStop(0.5,hexA(mv===6?PAL.food:bodyCol,0.78));bg.addColorStop(1,hexA(mv===6?PAL.food:bodyCol,0.35));
  ctx.fillStyle=bg;ctx.fill();ctx.strokeStyle=hexA('#d6fff8',0.85);ctx.lineWidth=2*k;ctx.stroke();
  // inner bits: nucleus and little organelles
  ctx.fillStyle=hexA(PAL.mind,0.55);ctx.beginPath();ctx.ellipse(R*0.28,R*0.38,R*0.26,R*0.2,0.4,0,6.283);ctx.fill();
  ctx.fillStyle=hexA('#ffffff',0.35);for(const o of[[-0.5,0.42,0.08],[0.55,-0.05,0.06],[-0.15,0.6,0.05]]){ctx.beginPath();ctx.arc(o[0]*R,o[1]*R,o[2]*R,0,6.283);ctx.fill();}
  ctx.fillStyle='rgba(255,255,255,0.45)';ctx.beginPath();ctx.ellipse(-R*0.38,-R*0.52,R*0.24,R*0.12,-0.6,0,6.283);ctx.fill();
  // face (kept upright even when the body flattens)
  ctx.scale(1,1/sq);
  const ex=st.eye.x*R*0.07,ey=st.eye.y*R*0.07;
  const closed=mv===2||st.blink<0.12,big=listen||mv===6?1.15:1;
  for(const s2 of[-1,1]){
    const x=s2*R*0.34,y=-R*0.12*sq;
    if(closed){ctx.strokeStyle='#1a2340';ctx.lineWidth=2.4*k;ctx.beginPath();ctx.arc(x,y,R*0.16,0.2,2.94);ctx.stroke();continue;}
    if(yuck){ctx.strokeStyle='#1a2340';ctx.lineWidth=2.6*k;ctx.beginPath();ctx.moveTo(x-R*0.13,y-R*0.13);ctx.lineTo(x+R*0.13,y+R*0.13);ctx.moveTo(x+R*0.13,y-R*0.13);ctx.lineTo(x-R*0.13,y+R*0.13);ctx.stroke();continue;}
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.ellipse(x,y,R*0.24*big,R*0.27*big,0,0,6.283);ctx.fill();
    ctx.fillStyle='#16213f';ctx.beginPath();ctx.ellipse(x+ex,y+ey,R*0.15*big,R*0.17*big,0,0,6.283);ctx.fill();
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(x+ex-R*0.05,y+ey-R*0.07,R*0.055,0,6.283);ctx.fill();
    if(sad){ctx.strokeStyle='#16213f';ctx.lineWidth=2.2*k;ctx.beginPath();ctx.moveTo(x-s2*R*0.22,y-R*0.36);ctx.lineTo(x+s2*R*0.16,y-R*0.28);ctx.stroke();}
  }
  ctx.fillStyle='rgba(255,120,160,0.4)';for(const s2 of[-1,1]){ctx.beginPath();ctx.ellipse(s2*R*0.58,R*0.16*sq,R*0.12,R*0.08,0,0,6.283);ctx.fill();}
  ctx.strokeStyle='#16213f';ctx.lineWidth=2.4*k;ctx.lineCap='round';
  const my=R*0.26*sq;
  if(st.mood.eat>0){ctx.fillStyle='#16213f';ctx.beginPath();ctx.ellipse(0,my,R*0.12,R*(0.06+0.08*Math.abs(Math.sin(T*14))),0,0,6.283);ctx.fill();}
  else if(sad||yuck){ctx.beginPath();ctx.arc(0,my+R*0.12,R*0.14,3.6,5.8);ctx.stroke();}
  else if(happy||mv===6){ctx.fillStyle='#16213f';ctx.beginPath();ctx.arc(0,my-R*0.02,R*0.15,0,3.1416);ctx.fill();}
  else if(listen){ctx.fillStyle='#16213f';ctx.beginPath();ctx.arc(0,my,R*0.07,0,6.283);ctx.fill();}
  else if(mv!==2){ctx.beginPath();ctx.arc(0,my-R*0.08,R*0.14,0.5,2.64);ctx.stroke();}
  ctx.restore();
  // little extras that say what it is doing
  ctx.save();ctx.globalCompositeOperation='lighter';
  if(mv===3)for(let i=0;i<5;i++){const a=pup.spin*1.2+i*1.256;glow(P.x+Math.cos(a)*R*1.6,P.y+Math.sin(a)*R*1.6,7*k,PAL.food,0.8);}
  if(listen)for(let i=0;i<3;i++){const a=T*4+i*2.1;glow(P.x+Math.cos(a)*R*1.4,P.y-R*1.3+Math.sin(a)*R*0.3,7*k,'#ffffff',0.7);}
  if(shrinkQ>=0){
    // rings collapsing onto the cell, and sparks spiralling in
    for(let i=0;i<3;i++){const q=((shrinkQ*1.4+i/3)%1),rad=R0*(2.6-2.2*q);ctx.strokeStyle=hexA(PAL.mind,0.75*q*(shrinkQ<2.6?1:0.4));ctx.lineWidth=(1+2.5*q)*k;ctx.beginPath();ctx.arc(P.x,P.y,rad,0,6.283);ctx.stroke();}
    for(let i=0;i<10;i++){const q=((shrinkQ*1.1+i*0.1)%1),a=i*0.628+q*5+shrinkQ,d=R0*(2.8-2.5*q);glow(P.x+Math.cos(a)*d,P.y+Math.sin(a)*d,(3+5*q)*k,i%2?PAL.mind:'#ffffff',0.9*q);}
    if(shrinkQ<0.25){ctx.strokeStyle=hexA('#ffffff',1-shrinkQ*4);ctx.lineWidth=3*k;ctx.beginPath();ctx.arc(P.x,P.y,R0*(1.2-shrinkQ*2.5),0,6.283);ctx.stroke();}
    glow(P.x,P.y,R*2.4,'#ffffff',0.35+0.25*Math.sin(T*20));
  }
  if(growQ>=0&&growQ<0.7){
    // the pop back to full size: a ring and sparks flying out
    const q=growQ/0.7;ctx.strokeStyle=hexA(PAL.glim,1-q);ctx.lineWidth=(4-3*q)*k;ctx.beginPath();ctx.arc(P.x,P.y,R0*(0.6+2.4*q),0,6.283);ctx.stroke();
    for(let i=0;i<12;i++){const a=i*0.5236,d=R0*(0.8+2.6*q);glow(P.x+Math.cos(a)*d,P.y+Math.sin(a)*d,(7-5*q)*k,i%2?PAL.glim:PAL.mind,1-q);}
  }
  ctx.restore();
  if(mv===2){for(let i=0;i<3;i++){const q=((T*0.5+i*0.33)%1);txt('z',P.x+R*0.9+i*8*k+q*8*k,P.y-R*0.9-q*30*k,(11+i*4)*Math.max(0.8,k),'rgba(207,224,255,'+(1-q)+')','center',600);}}
}
function drawParts(){
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const p of st.parts){const a=Math.max(0,1-p.life/p.max);glow(p.x,p.y,p.r||8,p.col,a);}
  for(const r of st.ripples){ctx.strokeStyle=hexA(r.col,1-r.t/0.8);ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x,r.y,8+r.t*70,0,6.283);ctx.stroke();}
  ctx.restore();
}

// ---------- the brain (always visible) ----------
const ZERO_IN=new Float64Array(NIN),ZERO_H=new Float64Array(MAXH);
function brainGeo(){
  const r=L.brain,n=NIN,top=r.y+52,bot=r.y+r.h-30;
  const rowY=i=>top+(bot-top)*(i+0.5)/NCUE;
  const ix=r.x+38,ox=r.x+r.w-108,hx0=r.x+r.w*0.27,hx1=r.x+r.w*0.56;
  const hid=[];for(let j=0;j<MAXH;j++){const own=j%n,col=(j/n)|0;const jit=Math.sin(j*12.9898)*0.5;hid.push({x:hx0+(hx1-hx0)*(col/2)+jit*r.w*0.035,y:rowY(own)+Math.cos(j*7.233)*(bot-top)/n*0.22});}
  const outY=k=>top+(bot-top)*(k+0.5)/NMOVE;
  return{rowY,ix,ox,hid,outY,rowH:(bot-top)/NCUE,outH:(bot-top)/NMOVE};
}
function drawBrain(pup,b){
  const r=L.brain,n=NIN,H=b.H,T=st.t;
  panel(r,'rgba(8,12,34,0.84)','the brain  ·  live neural network',H+' neurons · '+st.brain.updates+' learning steps');
  ctx.save();rr(r.x,r.y,r.w,r.h,18);ctx.clip();
  const g=brainGeo();
  ctx.fillStyle='rgba(120,150,230,0.10)';for(let gx=r.x+18;gx<r.x+r.w;gx+=22)for(let gy=r.y+34;gy<r.y+r.h-6;gy+=22){ctx.fillRect(gx,gy,1.2,1.2);}
  if(st.flash.good>0.01)glow(r.x+r.w*0.55,r.y+r.h*0.5,r.w*0.9,PAL.food,st.flash.good*0.32);
  if(st.flash.bad>0.01)glow(r.x+r.w*0.55,r.y+r.h*0.5,r.w*0.9,PAL.danger,st.flash.bad*0.32);
  const x=st.live?b.x:ZERO_IN,h=st.live?b.h:ZERO_H;
  ctx.globalCompositeOperation='lighter';
  // signals -> hidden
  for(let j=0;j<H;j++){if(j%n===NCUE)continue;const hp=g.hid[j];for(let i=0;i<NCUE;i++){const w=b.W1[j*n+i],aw=Math.abs(w);if(aw<0.12)continue;
    const act=x[i]*aw;ctx.strokeStyle=w>0?hexA(PAL.glim,Math.min(0.9,0.1+act*0.5)):hexA(PAL.danger,Math.min(0.9,0.1+act*0.5));ctx.lineWidth=0.6+Math.min(2.4,aw*0.8)+act*0.8;
    ctx.beginPath();ctx.moveTo(g.ix,g.rowY(i));ctx.lineTo(hp.x,hp.y);ctx.stroke();}}
  // hidden -> moves
  for(let j=0;j<H;j++){if(j%n===NCUE)continue;const hp=g.hid[j];for(let k=0;k<NMOVE;k++){const w=b.W2[k*H+j],aw=Math.abs(w);if(aw<0.3)continue;
    const act=Math.abs(h[j])*aw;
    ctx.strokeStyle=w>0?hexA(PAL.food,Math.min(0.95,0.06+aw*0.1+act*0.3)):hexA(PAL.danger,Math.min(0.7,0.05+aw*0.07+act*0.1));
    ctx.lineWidth=0.5+Math.min(3.6,aw*0.55)+act*0.6;ctx.beginPath();ctx.moveTo(hp.x,hp.y);ctx.lineTo(g.ox,g.outY(k));ctx.stroke();}}
  // ---- the decision path: signal -> the neurons it fires -> the move those neurons vote for ----
  {
    const bx=b.x,bh=b.h,f=st.live?1:0.4;
    // which move are we explaining: the one it is doing, otherwise the one it would most likely do
    const chosen=st.live&&(pup.phase==='move'||pup.phase==='rest');
    const ks=chosen?pup.move:-1;st.pathMove=-1;
    if(st.live){ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(8,12,34,0.5)';ctx.fillRect(r.x,r.y+44,r.w,r.h-66);ctx.globalCompositeOperation='lighter';}
    const oy=chosen?g.outY(ks):0;
    for(let i=0;i<NCUE&&st.live;i++){
      if(bx[i]<0.5)continue;const iy=g.rowY(i),sc=SIG[i].col==='#ffffff'?'#cfe0ff':SIG[i].col;
      for(let j=0;j<H;j++){
        if(j%n===NCUE)continue;const hj=bh[j],w1=b.W1[j*n+i];if(Math.abs(hj)<0.25||Math.abs(w1)<0.3)continue;
        const hp=g.hid[j],vote=chosen?hj*b.W2[ks*H+j]:0;      // how hard this neuron pushes for (or against) the move
        // signal -> neuron
        ctx.strokeStyle=hexA(sc,0.85*f);ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(g.ix,iy);ctx.lineTo(hp.x,hp.y);ctx.stroke();
        // neuron -> move
        if(vote>0.03){ctx.strokeStyle=hexA(PAL.food,Math.min(1,0.45+vote*0.3)*f);ctx.lineWidth=1.6+Math.min(5.5,vote*1.5);ctx.beginPath();ctx.moveTo(hp.x,hp.y);ctx.lineTo(g.ox,oy);ctx.stroke();}
        else if(vote<-0.03){ctx.strokeStyle=hexA(PAL.danger,Math.min(0.8,0.3-vote*0.2)*f);ctx.lineWidth=1.4;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(hp.x,hp.y);ctx.lineTo(g.ox,oy);ctx.stroke();ctx.setLineDash([]);}
        // a light that runs the whole way: signal -> neuron -> move
        if(st.live&&vote>0.03)for(let q=0;q<2;q++){
          const ph=(T*0.75+j*0.137+q*0.5)%1;let px,py;
          if(ph<0.45){const u=ph/0.45;px=g.ix+(hp.x-g.ix)*u;py=iy+(hp.y-iy)*u;}else{const u=(ph-0.45)/0.55;px=hp.x+(g.ox-hp.x)*u;py=hp.y+(oy-hp.y)*u;}
          glow(px,py,9,ph<0.45?sc:PAL.food,0.95);
        }
      }
    }
  }
  if(st.backwave>0.01){const wx=r.x+r.w*(1-(1-st.backwave)),col=st.backsign>=0?PAL.food:PAL.danger;
    const gr=ctx.createLinearGradient(wx-80,0,wx+80,0);gr.addColorStop(0,hexA(col,0));gr.addColorStop(0.5,hexA(col,0.26*st.backwave));gr.addColorStop(1,hexA(col,0));ctx.fillStyle=gr;ctx.fillRect(wx-80,r.y,160,r.h);}
  if(st.live&&pup.phase==='cue'){for(let k=0;k<NMOVE;k++){if(b.mask&&!b.mask[k])continue;glow(g.ox,g.outY(k),18+6*Math.sin(T*14+k),'#ffffff',0.18+0.12*Math.sin(T*14+k));}}
  ctx.globalCompositeOperation='source-over';
  // signal inputs
  const ir=Math.min(15,g.rowH*0.4);
  for(let i=0;i<NCUE;i++){
    const y=g.rowY(i),a=x[i];
    if(a>0.05)glow(g.ix,y,ir*2.6,i<NCUE?(SIG[i].col==='#ffffff'?'#cfe0ff':SIG[i].col):'#cfe0ff',a*0.9);
    ctx.fillStyle='rgba(8,12,34,0.9)';ctx.beginPath();ctx.arc(g.ix,y,ir+3,0,6.283);ctx.fill();
    if(i<NCUE)drawSig(i,g.ix,y,ir,i<st.unlocked?0.55+0.45*a:0.22);
    else{ctx.strokeStyle='rgba(180,200,240,'+(0.35+0.5*a)+')';ctx.setLineDash([3,4]);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(g.ix,y,ir*0.8,0,6.283);ctx.stroke();ctx.setLineDash([]);}
  }
  // hidden neurons
  for(let j=0;j<H;j++){if(j%n===NCUE)continue;const p=g.hid[j],a=Math.abs(h[j]);
    glow(p.x,p.y,11+a*16,PAL.mind,0.25+a*0.75);
    const bl=Math.min(1,b.blame[j]*2.5);if(bl>0.05&&st.backwave>0.02)glow(p.x,p.y,22,st.backsign>=0?PAL.food:PAL.danger,bl*0.7*st.backwave);
    ctx.fillStyle='#ece4ff';ctx.beginPath();ctx.arc(p.x,p.y,3.2+a*3,0,6.283);ctx.fill();}
  // moves, with the brain's own odds
  const or=Math.min(15,g.outH*0.4);
  for(let k=0;k<NMOVE;k++){
    const y=g.outY(k),pk=b.p[k],cur=((pup.phase==='move'||pup.phase==='rest')&&pup.move===k);
    glow(g.ox,y,or*1.4+pk*or*3,PAL.food,0.12+pk*0.8);
    ctx.fillStyle='rgba(8,12,34,0.9)';ctx.beginPath();ctx.arc(g.ox,y,or+3,0,6.283);ctx.fill();
    const can=!b.mask||b.mask[k];
    txt(MOVE_NAME[k],g.ox+or+10,y,11.5,cur?'#ffffff':can?'rgba(225,232,255,'+(0.55+0.45*Math.min(1,pk*2.5))+')':'rgba(160,180,230,0.25)','left',cur?600:400,0.3);
    drawMoveIcon(k,g.ox,y,or,can?0.5+0.5*Math.min(1,pk*2)+(cur?0.3:0):0.14);
    if(cur){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(g.ox,y,or+5+(pup.reward===0&&pup.windowOpen?2*Math.sin(T*8):0),0,6.283);ctx.stroke();
      if(pup.windowOpen&&pup.reward===0&&!st.test){const right=pup.cueForMove>=0&&k===TARGET[pup.cueForMove];mono(right?'chose this: TREAT':'chose this: POISON',g.ox-or-16,y-14,10.5,right?PAL.food:PAL.danger,'right');}}
    else if(st.pathMove===k&&can){ctx.strokeStyle=hexA(PAL.food,0.7);ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(g.ox,y,or+5,0,6.283);ctx.stroke();ctx.setLineDash([]);}
    const bw=r.w*0.09;ctx.fillStyle='rgba(160,180,230,0.14)';rr(g.ox-or-12-bw,y-3,bw,6,3);ctx.fill();
    ctx.fillStyle=PAL.food;rr(g.ox-or-12-bw*pk,y-3,Math.max(1,bw*pk),6,3);ctx.fill();
    if(can&&pk>0.02)mono(Math.round(pk*100)+'%',g.ox-or-16-bw,y+0.5,10,'rgba(255,216,107,'+(0.45+0.55*Math.min(1,pk*2))+')','right');
  }
  // live numbers from the network
  {let ent=0,cnt=0;for(let k=0;k<NMOVE;k++){if(b.p[k]>1e-6)ent-=b.p[k]*Math.log2(b.p[k]);if(!b.mask||b.mask[k])cnt++;}
   const conf=b.p[TARGET[st.live?Math.max(0,b.x.indexOf(1)):st.cur]]||0;
   const line='reward '+(st.lastR>0?'+':'')+st.lastR.toFixed(2)+'   confidence '+Math.round(conf*100)+'%   entropy '+ent.toFixed(2)+' bits   weights '+(b.W1.length+b.W2.length+b.w3.length);
   ctx.fillStyle='rgba(8,12,34,0.8)';ctx.fillRect(r.x+1,r.y+r.h-19,r.w-2,18);mono(line,r.x+r.w/2,r.y+r.h-10,10.5,'rgba(150,235,225,0.85)','center');}
  txt('sees',g.ix,r.y+38,11,'rgba(210,222,255,0.6)','center',400,2);
  txt('does',g.ox,r.y+38,11,'rgba(210,222,255,0.6)','center',400,2);
  if(!st.live){txt('odds if you shine',r.x+r.w*0.5-14,r.y+38,11,'rgba(210,222,255,0.5)','right',300,1);drawSig(st.cur,r.x+r.w*0.5,r.y+38,7,0.9);txt('now',r.x+r.w*0.5+14,r.y+38,11,'rgba(210,222,255,0.5)','left',300,1);}
  ctx.restore();
}

// ---------- graph ----------
function drawGraph(){
  const r=L.graph;if(r.h<50)return;
  panel(r,'rgba(8,12,34,0.75)','how well it knows this signal','right answers');
  const s=st.series;const x0=r.x+34,y0=r.y+36,w=r.w-52,h=r.h-52;
  ctx.save();ctx.strokeStyle='rgba(160,180,230,0.12)';ctx.lineWidth=1;
  for(let i=0;i<=2;i++){const y=y0+h*i/2;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x0+w,y);ctx.stroke();}
  txt('100%',x0-6,y0,10,'rgba(200,215,255,0.5)','right');txt('0',x0-6,y0+h,10,'rgba(200,215,255,0.5)','right');
  if(s.length>1){
    ctx.globalCompositeOperation='lighter';
    const X=i=>x0+w*i/Math.max(s.length-1,19),Y=v=>y0+h-h*v;
    const grad=ctx.createLinearGradient(0,y0,0,y0+h);grad.addColorStop(0,hexA(PAL.glim,0.35));grad.addColorStop(1,hexA(PAL.glim,0));
    ctx.beginPath();ctx.moveTo(x0,y0+h);s.forEach((v,i)=>ctx.lineTo(X(i),Y(v)));ctx.lineTo(X(s.length-1),y0+h);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    ctx.strokeStyle=PAL.glim;ctx.lineWidth=2.2;ctx.beginPath();s.forEach((v,i)=>{i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v));});ctx.stroke();
    glow(X(s.length-1),Y(s[s.length-1]),10,PAL.glim,0.9);
  }else txt('give the signal a few times to see it learn',x0+w/2,y0+h/2,13,'rgba(200,215,255,0.5)','center');
  ctx.restore();
}

// ---------- top bar: the goal, in pictures ----------
function drawTop(){
  const m=L.m,l=st.cur,cy=L.top/2+1;
  // left: wordmark + progress, on the brain column's left edge
  txt('SYNAPSE',m+2,cy-8,17,'#e8fffb','left',300,6);
  mono('signal '+(l+1)+'/8   stars '+st.stars.reduce((a,c)=>a+c,0)+'/24',m+3,cy+12,11,'rgba(150,190,240,0.8)','left');
  // the goal, on the pond column's left edge
  const name=MOVE_NAME[TARGET[l]];
  ctx.font='500 13px '+FONT;const tw=ctx.measureText(name).width+name.length*0.5;
  const gx=portrait?m+178:L.world.x,gh=38,gw=18+50+34+40+34+tw+20;
  ctx.save();rr(gx,cy-gh/2,gw,gh,gh/2);ctx.fillStyle='rgba(12,18,48,0.85)';ctx.fill();ctx.strokeStyle=hexA(PAL.food,0.55);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  let x=gx+18;
  txt('teach',x,cy,12,'rgba(210,222,255,0.7)','left',400,1.5);x+=50;
  drawSig(l,x+13,cy,12,1);x+=34;
  ctx.strokeStyle=hexA(PAL.food,0.9);ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,cy);ctx.lineTo(x+24,cy);ctx.lineTo(x+18,cy-5);ctx.moveTo(x+24,cy);ctx.lineTo(x+18,cy+5);ctx.stroke();x+=40;
  drawMoveIcon(TARGET[l],x+11,cy,12,1);x+=34;
  txt(name,x,cy,13,'#fff3cf','left',500,0.5);
  // right: counters + sound, on the right edge
  const bs2=38,bx=SW-m-bs2,by=cy-bs2/2,hx=bx-bs2-8;
  mono('tries '+st.tries[l],hx-12,cy-8,12,'rgba(215,228,255,0.9)','right');
  mono('streak x'+st.streak,hx-12,cy+9,12,st.streak>=3?PAL.food:'rgba(150,180,230,0.75)','right');
  ctx.save();rr(hx,by,bs2,bs2,bs2/2);ctx.fillStyle='rgba(12,18,48,0.7)';ctx.fill();ctx.strokeStyle=hexA(PAL.food,0.7);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  txt('?',hx+bs2/2,cy+1,18,PAL.food,'center',500);
  btn('help',hx-3,by-3,bs2+6,bs2+6,()=>{st.help=0;sfx('open');},{});
  ctx.save();rr(bx,by,bs2,bs2,bs2/2);ctx.fillStyle='rgba(12,18,48,0.7)';ctx.fill();ctx.strokeStyle=hexA(PAL.glim,0.6);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  const on=window.PXS?(PXS.musicOn||PXS.sfxOn):true;
  ctx.save();ctx.strokeStyle=hexA(PAL.glim,on?1:0.4);ctx.fillStyle=hexA(PAL.glim,on?1:0.4);ctx.lineWidth=2;ctx.translate(bx+bs2/2,cy);
  ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(-3,-3);ctx.lineTo(3,-7);ctx.lineTo(3,7);ctx.lineTo(-3,3);ctx.lineTo(-7,3);ctx.closePath();ctx.fill();
  if(on){ctx.beginPath();ctx.arc(3,0,5.5,-0.9,0.9);ctx.stroke();}ctx.restore();
  btn('sound',bx-3,by-3,bs2+6,bs2+6,()=>{setPaused(true);st.confirm=false;sfx('open');},{});
}

// ---------- what to do next (one short line + a pulsing button) ----------
function coach(){
  if(st.test)return{t:'Test: learning is switched off. This is only what its brain has learned.',b:null};
  const pup=st.pup,l=st.cur,rec=st.recent[l],want=MOVE_NAME[TARGET[l]],k=TOUCHY?'':' (key '+(l+1)+')';
  if(rec.length>=4&&rec.slice(-4).every(q=>q)&&st.stars[l]===0)return{t:'It knows this one now. Press TEST to prove it.',b:'test'};
  if(pup.phase==='idle')return{t:'Step 1: shine the signal'+k+'. You want it to learn: '+want+'.',b:'sig'+l};
  if(pup.phase==='cue')return{t:'It is thinking…',b:null};
  if(pup.windowOpen&&pup.cueForMove===l){
    const ok=pup.move===TARGET[l];
    if(pup.reward!==0)return{t:ok?'Good. Its brain just strengthened that link. Shine the signal again.':'It will try something else next time. Shine the signal again.',b:'sig'+l};
    return ok?{t:'It chose "'+want+'". Right! Give a TREAT now'+(TOUCHY?'.':' (left-click the pond, or G).'),b:'treat'}
             :{t:'It chose "'+MOVE_NAME[pup.move]+'", not "'+want+'". Give POISON now'+(TOUCHY?'.':' (right-click the pond, or B).'),b:'poison'};
  }
  return{t:'Shine the signal'+k+' and watch what it does.',b:'sig'+l};
}
function drawCoach(c){
  const r=L.world,sz=Math.max(12,Math.min(14.5,r.w/50));
  ctx.save();rr(r.x+12,r.y+r.h-40,r.w-24,28,14);ctx.fillStyle='rgba(8,12,34,0.8)';ctx.fill();ctx.strokeStyle=hexA(PAL.food,0.35);ctx.lineWidth=1;ctx.stroke();ctx.restore();
  txt(c.t,r.x+r.w/2,r.y+r.h-26,sz,'rgba(240,246,255,0.96)','center',400,0.2);
}
function drawToolbar(c){
  const pulse=0.5+0.5*Math.sin(st.t*6);
  for(const b of L.btn){
    const cx=b.x+b.w/2,cy=b.y+b.h/2,hint=c.b===b.id;
    let col=PAL.glim,dis=false,label='';
    if(b.kind==='sig'){
      const locked=b.i>=st.unlocked;dis=locked||!!st.test||!!st.result;col=SIG[b.i].col==='#ffffff'?'#cfe0ff':SIG[b.i].col;
      if(hint){glow(cx,cy,b.h*1.1,col,0.5*pulse);}
      ctx.save();rr(b.x,b.y,b.w,b.h,b.h/2);ctx.fillStyle=b.i===st.cur&&!locked?hexA(col,0.2):'rgba(12,18,48,0.88)';ctx.fill();
      ctx.strokeStyle=hint?'#fff':hexA(col,locked?0.18:0.7);ctx.lineWidth=hint?2.5+pulse:1.4;ctx.stroke();ctx.restore();
      if(locked){ctx.fillStyle='rgba(160,180,230,0.3)';rr(cx-7,cy-2,14,11,3);ctx.fill();ctx.strokeStyle='rgba(160,180,230,0.3)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy-3,5,3.14,6.28);ctx.stroke();}
      else drawSig(b.i,cx,cy-4,b.h*0.24,dis?0.4:1);
      if(!locked&&!TOUCHY)mono(String(b.i+1),b.x+b.h*0.36,cy-4,10,hexA(col,0.75),'center');
      if(!locked)for(let q=0;q<3;q++){ctx.fillStyle=st.stars[b.i]>q?PAL.food:'rgba(160,180,230,0.25)';ctx.beginPath();ctx.arc(cx+(q-1)*7,b.y+b.h-7,2.2,0,6.283);ctx.fill();}
      btn(b.id,b.x,b.y,b.w,b.h,()=>giveSignal(b.i),{disabled:dis});
    }else{
      if(b.id==='treat'){col=PAL.food;label='treat';dis=!!st.test||!!st.result;}
      else if(b.id==='poison'){col=PAL.danger;label='poison';dis=!!st.test||!!st.result;}
      else if(b.id==='speed'){col='#9fb4ff';label='x'+st.speed;}
      else if(b.id==='test'){col=PAL.glim;label='test';dis=!!st.test;}
      else{col='#9fb4ff';label='menu';}
      if(hint)glow(cx,cy,b.h*1.2,col,0.55*pulse);
      ctx.save();rr(b.x,b.y,b.w,b.h,b.h/2);ctx.fillStyle=hint?hexA(col,0.25):'rgba(12,18,48,0.88)';ctx.fill();
      ctx.strokeStyle=hint?'#fff':hexA(col,dis?0.2:0.7);ctx.lineWidth=hint?2.5+pulse:1.4;ctx.stroke();ctx.restore();
      ctx.font='400 13px '+FONT;const lw=ctx.measureText(label).width+label.length;
      const a=dis?0.35:1,grp=22+lw,ix=b.x+(b.w-grp)/2+7;
      ctx.save();ctx.translate(ix,cy);ctx.fillStyle=hexA(col,a);ctx.strokeStyle=hexA(col,a);ctx.lineWidth=2.2;ctx.lineCap='round';
      if(b.id==='treat'){glow(0,0,14,col,0.6*a);ctx.beginPath();ctx.arc(0,0,6,0,6.283);ctx.fill();}
      else if(b.id==='poison'){ctx.beginPath();for(let q=0;q<12;q++){const an=q*Math.PI/6,rd=q%2?4.5:10;ctx.lineTo(Math.cos(an)*rd,Math.sin(an)*rd);}ctx.closePath();ctx.fill();}
      else if(b.id==='speed'){ctx.beginPath();ctx.moveTo(-8,-6);ctx.lineTo(-1,0);ctx.lineTo(-8,6);ctx.moveTo(0,-6);ctx.lineTo(7,0);ctx.lineTo(0,6);ctx.stroke();}
      else if(b.id==='test'){ctx.beginPath();ctx.arc(0,0,8,0,6.283);ctx.stroke();ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(-1,3.5);ctx.lineTo(4.5,-3.5);ctx.stroke();}
      else{ctx.fillRect(-6,-7,4,14);ctx.fillRect(2,-7,4,14);}
      ctx.restore();
      txt(label,ix+15,cy,13,hexA('#e6eeff',a),'left',400,1);
      if(!TOUCHY&&b.w>110){const key={treat:'G',poison:'B',speed:'F',test:'T',menu:'Esc'}[b.id];mono(key,b.x+b.w-12,cy,10,hexA(col,0.7*a),'right');}
      btn(b.id,b.x,b.y,b.w,b.h,()=>doBtn(b.id),{disabled:dis});
    }
  }
}

// ---------- screens ----------
function titleBtn(label,x,y,w,h,fn,col,primary){
  const hov=st.hover&&st.hover.id==='t_'+label;
  ctx.save();rr(x,y,w,h,h/2);ctx.fillStyle=hexA(col,primary?(hov?0.32:0.18):0.08);ctx.fill();ctx.strokeStyle=hexA(col,0.9);ctx.lineWidth=primary?2:1.3;ctx.stroke();ctx.restore();
  if(primary)glow(x+w/2,y+h/2,w*0.7,col,0.18+0.06*Math.sin(st.t*2.5));
  txt(label,x+w/2,y+h/2,primary?22:16,'#e8fffb','center',primary?300:400,primary?6:2);
  btn('t_'+label,x,y,w,h,fn,{});
}
function drawTitle(){
  const T=st.t;drawBackdrop();
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const n of web){n.x+=n.vx*0.016;n.y+=n.vy*0.016;if(n.x<0||n.x>1)n.vx*=-1;if(n.y<0||n.y>1)n.vy*=-1;}
  for(let i=0;i<web.length;i++){const a=web[i];
    for(let j=i+1;j<web.length;j++){const b=web[j],d=Math.hypot((a.x-b.x)*SW,(a.y-b.y)*SH);
      if(d<170){const al=(1-d/170)*0.5*(0.6+0.4*Math.sin(T*1.5+i));ctx.strokeStyle=hexA(PAL.glim,al);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x*SW,a.y*SH);ctx.lineTo(b.x*SW,b.y*SH);ctx.stroke();
        const ph=(T*0.5+i*0.13)%1;if(al>0.2)glow(a.x*SW+(b.x-a.x)*SW*ph,a.y*SH+(b.y-a.y)*SH*ph,8,PAL.food,al*1.2);}}
    glow(a.x*SW,a.y*SH,14+3*Math.sin(T*2+a.p),i%5?PAL.mind:PAL.glim,0.7);}
  ctx.restore();
  const cx=SW/2,ty=SH*0.2;
  glow(cx,ty,SW*0.35,PAL.glim,0.25);
  txt('SYNAPSE',cx,ty,Math.min(96,SW*0.09),'#e8fffb','center',200,Math.min(22,SW*0.018));
  txt('teach a little cell, and watch its brain learn',cx,ty+Math.min(70,SW*0.06),Math.min(19,SW*0.026),'rgba(190,225,255,0.85)','center',300,2.5);
  // the creature, saying hello
  const save=L.arena;
  const demo={x:WW*0.5,y:WH*0.42,phase:'idle',move:0,walk:0,spin:0,jumpT:0,face:0};st.trail=[];
  const k=2.1;ctx.save();ctx.translate(cx,SH*0.41);ctx.scale(k,k);ctx.translate(-cx,-SH*0.47);
  L.arena={x:cx-WW/2*0.5,y:SH*0.47-WH*0.42*0.5,k:0.5};drawCell(demo,T);ctx.restore();L.arena=save;
  const bw=Math.min(260,SW*0.5),bh=54,by=SH*0.56;
  titleBtn('BEGIN',cx-bw/2,by,bw,bh,()=>{startAudio();if(st.hasSave)continueSave();else newBrain();st.screen='play';sfx('open');},PAL.glim,true);
  if(st.hasSave)titleBtn('new cell',cx-bw*0.4,by+bh+12,bw*0.8,44,()=>{startAudio();newBrain();st.screen='play';sfx('open');},PAL.mind,false);
  const y2=by+bh+12+(st.hasSave?54:0);
  titleBtn('free training',cx-bw*0.4,y2,bw*0.8,44,()=>{startAudio();enterStudio();sfx('open');},'#ff8fd0',false);
  titleBtn('how it works',cx-bw*0.4,y2+54,bw*0.8,44,()=>{st.help=0;sfx('open');},PAL.food,false);
  // how it works, in three pictures
  const y0=SH-(portrait?120:84),stepW=Math.min(300,(SW-40)/3),sx=cx-stepW*1.5;
  const steps=[['1','shine a signal'],['2','watch what it does'],['3','treat if right, poison if wrong']];
  steps.forEach((s2,i)=>{const x=sx+i*stepW+stepW/2;
    ctx.beginPath();ctx.arc(x-stepW*0.36,y0,13,0,6.283);ctx.strokeStyle=hexA(PAL.food,0.9);ctx.lineWidth=1.5;ctx.stroke();txt(s2[0],x-stepW*0.36,y0+1,13,PAL.food,'center',600);
    txt(s2[1],x-stepW*0.36+22,y0,Math.min(14,stepW/17),'rgba(225,235,255,0.9)','left',300,0.5);});
  drawSoundCorner();
}
function drawSoundCorner(){
  const bx=SW-58,by=12;
  ctx.save();rr(bx,by,44,44,22);ctx.fillStyle='rgba(12,18,48,0.7)';ctx.fill();ctx.strokeStyle=hexA(PAL.glim,0.6);ctx.lineWidth=1.3;ctx.stroke();ctx.restore();
  ctx.save();ctx.fillStyle=PAL.glim;ctx.strokeStyle=PAL.glim;ctx.lineWidth=2;ctx.translate(bx+22,by+22);
  ctx.beginPath();ctx.moveTo(-8,-3);ctx.lineTo(-3,-3);ctx.lineTo(3,-8);ctx.lineTo(3,8);ctx.lineTo(-3,3);ctx.lineTo(-8,3);ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(3,0,6,-0.9,0.9);ctx.stroke();ctx.restore();
  btn('sound2',bx,by,44,44,()=>{setPaused(true);st.confirm=false;sfx('open');},{});
}
function slider(id,label,x,y,w,get,set){
  txt(label,x,y-14,12,'rgba(210,222,255,0.8)','left',300,1);
  ctx.save();rr(x,y-3,w,6,3);ctx.fillStyle='rgba(160,180,230,0.25)';ctx.fill();
  const v=get();rr(x,y-3,Math.max(6,w*v),6,3);ctx.fillStyle=PAL.glim;ctx.fill();
  ctx.fillStyle='#e8fffb';ctx.beginPath();ctx.arc(x+w*v,y,9,0,6.283);ctx.fill();ctx.restore();
  btn(id,x-10,y-22,w+20,44,null,{slider:{x,w,set}});
}
function pill(id,label,x,y,w,h,col,on,fn){
  ctx.save();rr(x,y,w,h,h/2);ctx.fillStyle=on?hexA(col,0.18):'rgba(12,18,48,0.85)';ctx.fill();ctx.strokeStyle=hexA(col,on?0.95:0.5);ctx.lineWidth=1.3;ctx.stroke();ctx.restore();
  txt(label,x+w/2,y+h/2,14,'#e6eeff','center',400,1);btn(id,x,y,w,h,fn,{});
}
function drawMenu(){
  ctx.fillStyle='rgba(5,8,24,0.82)';ctx.fillRect(0,0,SW,SH);ui=[];
  const hasFs=!!(window.Plaxzy&&Plaxzy.fullscreen),hasS=!!window.PXS;
  const lines=st.screen==='studio'?[['1 - 6','pick a trick'],['S','show: pose a routine'],['R','remind: show it again'],['Space','try'],['G  /  B','treat  /  poison'],['drag','pose the cell']]:[['1 - 8','shine a signal'],['G  /  left-click','treat: it was right'],['B  /  right-click','poison: it was wrong'],['drag','move the cell'],['T','test'],['F','speed']];
  const showKeys=SH>=560,pw=Math.min(480,SW-30);
  const hKeys=showKeys?lines.length*24+18:0,hSound=hasS?150:0;
  const ph=64+hKeys+hSound+48+44+44+70,px=(SW-pw)/2,py=Math.max(10,(SH-ph)/2);
  ctx.save();rr(px,py,pw,ph,22);ctx.fillStyle='rgba(10,16,44,0.98)';ctx.fill();ctx.strokeStyle=hexA(PAL.glim,0.5);ctx.lineWidth=1.3;ctx.stroke();ctx.restore();
  if(st.confirm){
    txt('start over?',SW/2,py+ph*0.3,24,'#e8fffb','center',300,4);
    txt('this wipes the brain and all stars.',SW/2,py+ph*0.3+38,14,'rgba(200,215,255,0.8)','center');
    const bw=(pw-70)/2;
    pill('no','keep it',px+25,py+ph-70,bw,44,PAL.glim,true,()=>{st.confirm=false;});
    pill('yes','wipe it',px+45+bw,py+ph-70,bw,44,PAL.danger,false,()=>{st.confirm=false;setPaused(false);wipeSave();});
    return;
  }
  txt('paused',SW/2,py+34,22,'#e8fffb','center',300,7);
  let y=py+64;
  if(showKeys){
    lines.forEach((c,i)=>{const yy=y+i*24+8;mono(c[0],px+pw*0.42,yy,12,'#9ff5e9','right');txt(c[1],px+pw*0.42+16,yy,13,'rgba(215,225,255,0.85)','left',300,0.3);});
    y+=hKeys;ctx.strokeStyle='rgba(160,180,230,0.15)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+24,y-6);ctx.lineTo(px+pw-24,y-6);ctx.stroke();
  }
  const bw=(pw-62)/2;
  if(hasS){
    pill('mus','music '+(PXS.musicOn?'on':'off'),px+24,y+4,bw,36,PAL.glim,PXS.musicOn,()=>{PXS.toggleMusic();});
    pill('sfx','effects '+(PXS.sfxOn?'on':'off'),px+38+bw,y+4,bw,36,PAL.glim,PXS.sfxOn,()=>{PXS.toggleSfx();});
    slider('smus','music volume',px+30,y+76,pw-60,()=>PXS.musicLevel!==undefined?PXS.musicLevel:0.7,v=>PXS.musicVolume(v));
    slider('ssfx','effects volume',px+30,y+122,pw-60,()=>PXS.sfxLevel!==undefined?PXS.sfxLevel:0.7,v=>PXS.sfxVolume(v));
    y+=hSound;
  }
  if(hasFs){pill('fs',Plaxzy.fullscreen.on?'exit full screen':'full screen',px+24,y,bw,36,PAL.glim,Plaxzy.fullscreen.on,()=>Plaxzy.fullscreen.toggle());
    pill('newb','new cell',px+38+bw,y,bw,36,PAL.danger,false,()=>{st.confirm=true;});}
  else pill('newb','new cell',px+24,y,pw-48,36,PAL.danger,false,()=>{st.confirm=true;});
  pill('howit','how it works',px+24,py+ph-62-46,pw-48,36,PAL.food,false,()=>{st.help=0;});
  if(st.screen==='studio')pill('tolessons','go to the lessons',px+24,py+ph-62-90,pw-48,36,PAL.glim,false,()=>{setPaused(false);if(st.hasSave&&!st.brain.updates)continueSave();st.screen='play';sfx('open');});
  else if(st.screen==='play')pill('tostudio','go to free training',px+24,py+ph-62-90,pw-48,36,'#ff8fd0',false,()=>{setPaused(false);enterStudio();sfx('open');});
  titleBtn('resume',px+24,py+ph-62,pw-48,46,()=>{setPaused(false);sfx('click');},PAL.glim,true);
}
function drawResult(){
  const r=st.result,w=L.world;
  ctx.save();rr(w.x,w.y,w.w,w.h,18);ctx.fillStyle='rgba(6,10,30,0.94)';ctx.fill();ctx.restore();
  if(r.pass)glow(w.x+w.w/2,w.y+w.h*0.35,w.w*0.7,PAL.food,0.25);
  const cx=w.x+w.w/2,sz=Math.min(1,w.w/600);
  txt(r.pass?'lesson passed':'not yet',cx,w.y+38*sz,28*sz,r.pass?PAL.food:'#cfe0ff','center',300,5*sz);
  if(r.pass)for(let i=0;i<3;i++){ctx.save();ctx.translate(cx+(i-1)*46*sz,w.y+84*sz);ctx.beginPath();for(let q=0;q<10;q++){const a=-1.5708+q*Math.PI/5,rd=(q%2?8:19)*sz;ctx.lineTo(Math.cos(a)*rd,Math.sin(a)*rd);}ctx.closePath();if(r.stars>i){ctx.fillStyle=PAL.food;ctx.fill();}else{ctx.strokeStyle='rgba(160,180,230,0.4)';ctx.lineWidth=1.5;ctx.stroke();}ctx.restore();}
  const n=r.trials.length,cw=Math.min(44*sz,(w.w-150)/n),x0=cx-(n*cw)/2+cw/2+40*sz;
  const y1=w.y+(r.pass?150:110)*sz,y2=y1+44*sz;
  txt('before',x0-cw*0.5-14,y1,12*sz,'rgba(200,215,255,0.7)','right',400,1);
  txt('now',x0-cw*0.5-14,y2,13*sz,'#e9fffb','right',500,1);
  for(let i=0;i<n;i++){
    const x=x0+i*cw,t=r.trials[i];
    drawSig(t.cue,x,y1-24*sz,8*sz,0.9);
    for(const row of[[y1,t.base,0.6],[y2,t.ok,1]]){
      ctx.beginPath();ctx.arc(x,row[0],cw*0.32,0,6.283);ctx.fillStyle=row[1]?hexA(PAL.glim,0.25*row[2]):hexA(PAL.danger,0.25*row[2]);ctx.fill();
      ctx.strokeStyle=hexA(row[1]?PAL.glim:PAL.danger,row[2]);ctx.lineWidth=2.4*sz;ctx.lineCap='round';ctx.beginPath();
      if(row[1]){ctx.moveTo(x-cw*0.14,row[0]);ctx.lineTo(x-cw*0.03,row[0]+cw*0.11);ctx.lineTo(x+cw*0.15,row[0]-cw*0.11);}
      else{ctx.moveTo(x-cw*0.11,row[0]-cw*0.11);ctx.lineTo(x+cw*0.11,row[0]+cw*0.11);ctx.moveTo(x+cw*0.11,row[0]-cw*0.11);ctx.lineTo(x-cw*0.11,row[0]+cw*0.11);}
      ctx.stroke();}
  }
  txt(r.pass?'it took '+r.taught+' tries to teach':(r.why||''),cx,y2+40*sz,13*sz,'rgba(210,225,255,0.85)','center',300,0.5);
  const bh=Math.max(44,40*sz),by2=w.y+w.h-bh-12;
  titleBtn(r.pass&&r.next?'next signal':'keep teaching',cx-110*sz-20,by2,220*sz+40,bh,()=>{
    if(r.pass&&r.next){st.cur=Math.min(st.unlocked-1,st.cur+1);st.series=[];}st.result=null;sfx('click');},PAL.glim,true);
}


// ---------- how it works: a guide anyone can read ----------
const HELP_PAGES=[
  {t:'Meet the brain',
   p:['The cell has a tiny brain. You can see all of it on the left of the screen.',
      'It has three parts. On the left: what the cell SEES (the light signals). In the middle: little thinking dots called NEURONS. On the right: what the cell can DO (its moves).',
      'The lines between them are how the parts talk to each other.']},
  {t:'A line is a vote',
   p:['When you shine a signal, the neurons connected to it wake up and glow.',
      'Each awake neuron sends a VOTE along its lines to the moves. A thick line is a loud vote. A thin line is a whisper.',
      'A gold line says "do this move". A dashed red line says "do not do this move".']},
  {t:'How it decides',
   p:['The brain adds up all the votes for every move. More votes means a bigger chance. That chance is the yellow bar and the % next to each move.',
      'Then it picks, a bit like rolling a dice that is heavier on one side. It usually picks the move with the biggest bar, but sometimes it tries something else, just to see what happens.',
      'That is why a new cell looks like it is guessing: all its bars are about the same.']},
  {t:'How it learns',
   p:['Nobody tells the cell the right answer. It only gets your TREAT or your POISON after it tries something.',
      'A treat makes the lines that led to that move THICKER, so next time the vote is louder and the move is more likely.',
      'Poison makes those lines THINNER. Do this a few times and the brain has changed itself. This is called reinforcement learning, and it is how many real AIs learn.']},
  {t:'Reading the picture',
   p:['The bright path: signal, to the neurons it wakes, to the move it chose. That path is WHY it did what it did.',
      'confidence = how sure it is about the right move. entropy = how much it is still guessing (high is guessing, near zero is sure).',
      'weights = the number of lines (540). learning steps = how many times the brain changed itself. streak = right answers in a row.']},
  {t:'Is it a real AI?',
   p:['Yes. This is a real neural network, the same kind of thing as the big AIs, only very small: 540 lines instead of billions.',
      'The cell is born knowing HOW to do its moves. What it learns from you is WHICH move each signal means.',
      'Every brain starts with random lines, so every cell you raise learns a little differently.']},
  {t:'Free training: teach it anything',
   p:['Here the cell has a body it can move freely: two arms, a tail, and it can stretch, lean, grow, spin and change colour.',
      'SHOW: you pose it, beat by beat, like moving a puppet. It watches, and its brain moves a little toward what you showed. REMIND shows it again. Each time it gets closer.',
      'TRY: it does the routine by itself. At first it wobbles. A TREAT makes it surer and steadier. POISON makes it doubt, and forget some of it. The right side of the brain shows one neuron for each body part.']}
];
function wrapText(str,x,y,maxW,size,lh,col,wt){
  ctx.font=(wt||300)+' '+size+'px '+FONT;ctx.fillStyle=col;ctx.textAlign='left';ctx.textBaseline='middle';
  const words=str.split(' ');let line='',yy=y;
  for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width>maxW&&line){ctx.fillText(line,x,yy);line=w;yy+=lh;}else line=t;}
  if(line){ctx.fillText(line,x,yy);yy+=lh;}
  return yy;
}
// the little picture for each page
function helpPicture(pg,x,y,w,h){
  const T=st.t,cx=x+w/2,cy=y+h/2;
  ctx.save();rr(x,y,w,h,16);ctx.fillStyle='rgba(8,12,34,0.9)';ctx.fill();ctx.strokeStyle=hexA(PAL.glim,0.25);ctx.lineWidth=1;ctx.stroke();ctx.clip();
  const lx=x+w*0.16,mx=x+w*0.5,rx=x+w*0.84;
  const neuron=(nx,ny,a)=>{glow(nx,ny,12+a*14,PAL.mind,0.3+a*0.7);ctx.fillStyle='#ece4ff';ctx.beginPath();ctx.arc(nx,ny,4+a*3,0,6.283);ctx.fill();};
  const line=(x1,y1,x2,y2,col,wd,dash)=>{ctx.strokeStyle=col;ctx.lineWidth=wd;if(dash)ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);};
  const lab=(t,px,py)=>txt(t,px,py,11,'rgba(210,222,255,0.75)','center',400,1.5);
  const ns=[cy-h*0.22,cy,cy+h*0.22];
  if(pg===0){
    lab('SEES',lx,y+18);lab('NEURONS',mx,y+18);lab('DOES',rx,y+18);
    for(const ny of ns){line(lx+16,cy,mx,ny,hexA(PAL.glim,0.6),1.6);line(mx,ny,rx-16,cy,hexA(PAL.food,0.5),1.6);}
    drawSig(0,lx,cy,14,1);ns.forEach((ny,i)=>neuron(mx,ny,0.5+0.5*Math.sin(T*2+i)));drawMoveIcon(6,rx,cy,14,1);
  }else if(pg===1){
    const my=[cy-h*0.26,cy,cy+h*0.26];
    line(lx+16,cy,mx,ns[0],hexA(PAL.glim,0.8),2.4);line(lx+16,cy,mx,ns[2],hexA(PAL.glim,0.8),2.4);
    line(mx,ns[0],rx-16,my[0],hexA(PAL.food,0.95),6);line(mx,ns[2],rx-16,my[0],hexA(PAL.food,0.8),3);
    line(mx,ns[0],rx-16,my[1],hexA(PAL.food,0.4),1);line(mx,ns[2],rx-16,my[2],hexA(PAL.danger,0.8),1.5,true);
    for(let q=0;q<2;q++){const ph=(T*0.6+q*0.5)%1;glow(mx+(rx-16-mx)*ph,ns[0]+(my[0]-ns[0])*ph,8,PAL.food,0.95);}
    drawSig(0,lx,cy,14,1);neuron(mx,ns[0],1);neuron(mx,ns[2],0.8);neuron(mx,ns[1],0.05);
    drawMoveIcon(6,rx,my[0],13,1);drawMoveIcon(0,rx,my[1],13,0.6);drawMoveIcon(9,rx,my[2],13,0.6);
    txt('loud vote',mx+(rx-mx)*0.5,ns[0]-18,10.5,PAL.food,'center',500,0.5);txt('"no" vote',mx+(rx-mx)*0.55,my[2]+2,10.5,PAL.danger,'center',500,0.5);
  }else if(pg===2){
    const rows=[[6,0.7],[0,0.2],[9,0.1]],bw=w*0.42,pickT=(T*0.5)%1,pk=pickT<0.7?0:pickT<0.9?1:2;
    rows.forEach((r2,i)=>{const yy=cy-h*0.25+i*h*0.25,bx=x+w*0.36;
      drawMoveIcon(r2[0],x+w*0.2,yy,13,1);ctx.fillStyle='rgba(160,180,230,0.15)';rr(bx,yy-5,bw,10,5);ctx.fill();ctx.fillStyle=PAL.food;rr(bx,yy-5,bw*r2[1],10,5);ctx.fill();
      mono(Math.round(r2[1]*100)+'%',bx+bw+10,yy,12,'#ffd86b','left');
      if(pk===i){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+w*0.2,yy,19,0,6.283);ctx.stroke();txt('picked',x+w*0.2,yy+28,10,'#fff','center',500,1);}});
  }else if(pg===3){
    const half=w/2;
    for(let k=0;k<2;k++){const ox=x+k*half,ph=(Math.sin(T*1.6)+1)/2,wd=k?5-4*ph:1+5*ph,col=k?PAL.danger:PAL.food;
      txt(k?'poison':'treat',ox+half/2,y+18,12,col,'center',500,1.5);
      line(ox+half*0.22,cy+6,ox+half*0.78,cy+6,hexA(PAL.food,0.9),wd);neuron(ox+half*0.22,cy+6,0.8);drawMoveIcon(6,ox+half*0.78,cy+6,13,1);
      txt(k?'line gets thinner':'line gets thicker',ox+half/2,y+h-18,11,'rgba(225,232,255,0.85)','center',300,0.5);}
    ctx.strokeStyle='rgba(160,180,230,0.2)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,y+12);ctx.lineTo(cx,y+h-12);ctx.stroke();
  }else if(pg===4){
    line(lx+16,cy,mx,cy-h*0.18,'#ffd86b',3);line(mx,cy-h*0.18,rx-16,cy,'#ffd86b',5);line(lx+16,cy,mx,cy+h*0.2,hexA(PAL.glim,0.25),1);
    for(let q=0;q<2;q++){const ph=(T*0.7+q*0.5)%1;let px,py;if(ph<0.45){const u=ph/0.45;px=lx+16+(mx-lx-16)*u;py=cy+(-h*0.18)*u;}else{const u=(ph-0.45)/0.55;px=mx+(rx-16-mx)*u;py=cy-h*0.18+(h*0.18)*u;}glow(px,py,9,PAL.food,0.95);}
    drawSig(1,lx,cy,14,1);neuron(mx,cy-h*0.18,1);neuron(mx,cy+h*0.2,0.05);drawMoveIcon(5,rx,cy,14,1);
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(rx,cy,20,0,6.283);ctx.stroke();
    mono('confidence 87%   entropy 0.65 bits',cx,y+h-16,11,'rgba(150,235,225,0.9)','center');
  }else if(pg===6){
    const pA=restPose(),pB=restPose();pB[0]=0.9;pB[1]=0.8;pB[5]=0.3;pB[10]=0.7;pB[11]=0.5;
    const u=(Math.sin(T*1.8)+1)/2,pp=pA.map((v,i)=>v+(pB[i]-v)*u);
    drawStudioCell(pp,cx,cy+6,Math.min(1,h/260),{mini:false});
    txt('show  →  try  →  treat',cx,y+h-16,12,'#ffd86b','center',500,1.5);
  }else{
    const s1=1+0.05*Math.sin(T*2);
    glow(x+w*0.28,cy,40,PAL.glim,0.5);ctx.fillStyle=hexA(PAL.glim,0.9);ctx.beginPath();ctx.arc(x+w*0.28,cy-6,13*s1,0,6.283);ctx.fill();
    mono('540 lines',x+w*0.28,cy+34,12,'#9ff5e9','center');txt('this cell',x+w*0.28,y+18,11,'rgba(210,222,255,0.75)','center',400,1.5);
    for(let i=0;i<70;i++){const a=i*2.39996,rd=Math.sqrt(i/70)*h*0.3;glow(x+w*0.72+Math.cos(a+T*0.1)*rd,cy-6+Math.sin(a+T*0.1)*rd,7,i%3?PAL.mind:PAL.glim,0.55);}
    mono('billions of lines',x+w*0.72,cy+h*0.36,12,'#d9c8ff','center');txt('a big AI',x+w*0.72,y+18,11,'rgba(210,222,255,0.75)','center',400,1.5);
  }
  ctx.restore();
}
function drawHelp(){
  ctx.fillStyle='rgba(5,8,24,0.86)';ctx.fillRect(0,0,SW,SH);ui=[];
  const n=HELP_PAGES.length,pg=Math.max(0,Math.min(n-1,st.help)),P=HELP_PAGES[pg];
  const pw=Math.min(860,SW-28),ph=Math.min(540,SH-24),px=(SW-pw)/2,py=(SH-ph)/2,side=pw>620;
  ctx.save();rr(px,py,pw,ph,22);ctx.fillStyle='rgba(10,16,44,0.985)';ctx.fill();ctx.strokeStyle=hexA(PAL.glim,0.5);ctx.lineWidth=1.3;ctx.stroke();ctx.restore();
  mono('HOW IT WORKS  '+(pg+1)+'/'+n,px+28,py+30,11,'rgba(150,235,225,0.85)','left');
  txt(P.t,px+28,py+62,Math.min(28,pw/18),'#fff3cf','left',300,1.5);
  const top=py+92,bottom=py+ph-74;
  let tx,tw,ty;
  if(side){const iw=pw*0.44;helpPicture(pg,px+28,top,iw,bottom-top);tx=px+28+iw+26;tw=pw-28-iw-26-28;ty=top+12;}
  else{const ih=Math.min(190,(bottom-top)*0.4);helpPicture(pg,px+20,top,pw-40,ih);tx=px+24;tw=pw-48;ty=top+ih+22;}
  const fs2=side?15.5:14,lh=fs2*1.5;
  for(const para of P.p){ty=wrapText(para,tx,ty,tw,fs2,lh,'rgba(232,238,255,0.94)',300)+lh*0.45;}
  // navigation
  const by=py+ph-58,bh=42,bw=Math.min(150,(pw-76)/3);
  if(pg>0)pill('h_prev','back',px+24,by,bw,bh,PAL.mind,false,()=>{st.help=pg-1;sfx('click');});
  pill('h_close','close',px+(pw-bw)/2,by,bw,bh,'#9fb4ff',false,()=>{st.help=-1;sfx('click');});
  if(pg<n-1)pill('h_next','next',px+pw-24-bw,by,bw,bh,PAL.glim,true,()=>{st.help=pg+1;sfx('click');});
  else pill('h_done','got it',px+pw-24-bw,by,bw,bh,PAL.food,true,()=>{st.help=-1;sfx('click');});
  for(let i=0;i<n;i++){ctx.fillStyle=i===pg?PAL.food:'rgba(160,180,230,0.3)';ctx.beginPath();ctx.arc(px+pw/2+(i-(n-1)/2)*14,by-14,3.2,0,6.283);ctx.fill();}
}

// ---------- actions ----------
function giveSignal(i){
  if(st.screen!=='play'||st.paused||st.test||st.result||i>=st.unlocked)return;
  if(i!==st.cur){st.cur=i;st.series=[];}
  if(st.pup.giveCue(i,st.brain,true,LR)){st.sigCue=i;st.sigT=0;st.dirty=true;sfx('sig');}
}
function reward(kind,sx,sy){
  if(st.screen!=='play'||st.paused||st.test||st.result)return;
  const pup=st.pup,P=w2s(pup.x,pup.y);
  if(sx===undefined){sx=P.x+(Math.random()-.5)*80;sy=P.y-90*P.k;}
  if(kind==='treat'){pup.addReward(1.2,'treat');st.flash.good=1;st.backsign=1;st.mood.good=1.4;st.mood.eat=0.9;sfx('treat');setTimeout(()=>sfx('happy'),200);
    for(let i=0;i<10;i++)st.parts.push({x:sx,y:sy,tx:P.x,ty:P.y,life:0,max:0.5+Math.random()*0.3,col:PAL.food,r:9,home:true});
    st.ripples.push({x:sx,y:sy,t:0,col:PAL.food});}
  else{pup.addReward(-0.7,'no');st.flash.bad=1;st.backsign=-1;st.mood.bad=1.4;st.mood.yuck=0.9;sfx('poison');
    for(let i=0;i<10;i++)st.parts.push({x:sx,y:sy,tx:P.x,ty:P.y,life:0,max:0.5+Math.random()*0.3,col:PAL.danger,r:9,home:true});
    st.ripples.push({x:sx,y:sy,t:0,col:PAL.danger});}
  st.dirty=true;
}
function doBtn(id){
  if(st.screen!=='play')return;
  if(id==='treat')reward('treat');else if(id==='poison')reward('poison');
  else if(id==='speed'){st.speed=st.speed===1?2:1;sfx('click');}
  else if(id==='menu'){setPaused(!st.paused);st.confirm=false;sfx('open');}
  else if(id==='test'){if(!st.test&&!st.paused&&!st.result)startTest();}
}
function startTest(){
  const l=st.cur,trials=[];
  for(let i=0;i<5;i++)trials.push({cue:l,tag:'new'});
  if(l>0)for(let i=0;i<3;i++)trials.push({cue:(Math.random()*l)|0,tag:'review'});
  shuffle(trials);
  const bb=Brain.fromData(st.birth,mulberry(11))||new Brain(mulberry(11),27),xv=new Float64Array(NIN);bb.mask=movesFor(st.unlocked);
  trials.forEach(t=>{bb.forward(cueVec(t.cue,xv),TEST_TEMP);let u=Math.random(),a=0,c=0;for(let k=0;k<NMOVE;k++){c+=bb.p[k];if(u<=c){a=k;break;}a=k;}t.base=(a===TARGET[t.cue]);});
  st.test={trials,idx:-1,res:[],pup:new Pup((Math.random()*1e9)|0),brain:st.brain.clone((Math.random()*1e9)|0),wait:0.8,lesson:l,move:-1};st.test.brain.mask=movesFor(st.unlocked);
  st.sigT=-1;st.parts=[];st.trail=[];sfx('open');
}
function nextTrial(){
  const t=st.test;t.idx++;
  if(t.idx>=t.trials.length){finishTest();return;}
  const tr=t.trials[t.idx];t.pup.phase='idle';t.pup.phT=0;t.pup.idleT=0;t.pup.windowOpen=false;
  t.pup.giveCue(tr.cue,t.brain,false,LR);t.move=-1;st.sigCue=tr.cue;st.sigT=0;sfx('sig');
}
function finishTest(){
  const t=st.test,l=t.lesson;let newOk=0,newN=0,revOk=0,revN=0;
  t.res.forEach((ok,i)=>{if(t.trials[i].tag==='new'){newN++;if(ok)newOk++;}else{revN++;if(ok)revOk++;}});
  const pass=newOk>=4&&(revN===0||revOk>=2);
  const stars=!pass?0:st.tries[l]<=30?3:st.tries[l]<=60?2:1;
  const why=pass?'':newOk<4?'it got this signal right '+newOk+' of '+newN+' times. It needs 4.':'it forgot an older signal. Teach that one again.';
  const r={pass,stars,next:false,taught:st.tries[l],why,trials:t.trials.map((tr,i)=>({cue:tr.cue,ok:!!t.res[i],base:tr.base}))};
  if(pass){
    st.stars[l]=Math.max(st.stars[l],stars);
    if(l===st.unlocked-1&&st.unlocked<8){st.unlocked++;r.next=true;syncMask();}else if(l<st.unlocked-1)r.next=true;
    sfx('win');st.flash.good=1;st.backsign=1;
    if(window.Plaxzy&&Plaxzy.progress)Plaxzy.progress('signal_'+(l+1));
    if(st.stars.every(q=>q>0)&&!st.completed){st.completed=true;if(window.Plaxzy&&Plaxzy.complete)Plaxzy.complete({score:st.stars.reduce((a,c)=>a+c,0)});}
  }else sfx('lose');
  st.test=null;st.result=r;st.dirty=true;saveNow();
}

// ---------- simulation ----------
function pupEvents(pup,live){
  for(const e of pup.events){
    if(e.t==='jump')sfx('boing');else if(e.t==='spin')sfx('whirl');
    else if(e.t==='closed'&&live&&e.cue>=0){
      const ok=e.move===TARGET[e.cue];st.lastR=e.r;st.streak=ok?st.streak+1:0;st.recent[e.cue].push(ok);if(st.recent[e.cue].length>8)st.recent[e.cue].shift();
      if(e.cue===st.cur){st.tries[st.cur]++;
        // the brain's own odds of the right move for this signal: the honest measure of what it has learned
        const b=st.brain,xv=new Float64Array(NIN),keep=Float64Array.from(b.x);b.forward(cueVec(e.cue,xv),1);st.series.push(b.p[TARGET[e.cue]]);b.forward(keep,1);b.x.set(keep);
        if(st.series.length>60)st.series.shift();}
      st.dirty=true;
    }
  }
  pup.events.length=0;
}
function simulate(dt){
  if(st.screen!=='play'||st.paused||st.result||st.help>=0)return;
  let acc=(simulate.acc||0)+dt*st.speed;const step=1/30;let n=0;const t=st.test;
  while(acc>=step&&n<200){
    acc-=step;n++;
    if(t){
      if(t.wait>0){t.wait-=step;if(t.wait<=0)nextTrial();if(!st.test)break;continue;}
      const pup=t.pup;pup.step(step,t.brain,false,TEST_TEMP,LR);
      for(const e of pup.events){if(e.t==='move')t.move=e.m;
        if(e.t==='rest'){t.res.push(t.move===TARGET[t.trials[t.idx].cue]);pup.phase='idle';pup.phT=0;pup.idleT=0;pup.windowOpen=false;t.wait=0.9;}}
      pup.events.length=0;
    }else{
      st.pup.step(step,st.brain,true,TRAIN_TEMP,LR);pupEvents(st.pup,true);
      if(st.brain.updates!==st.lastUpdates){st.lastUpdates=st.brain.updates;st.backwave=1;}
    }
  }
  simulate.acc=acc;
}
function update(dt){
  st.t+=dt;
  if(st.screen==='studio'){if(!st.paused&&st.help<0)studioUpdate(dt);return;}
  if(st.screen==='play'){
    simulate(dt);
    if(!st.paused){
      const pup=st.test?st.test.pup:st.pup;
      st.trail.push({x:pup.x,y:pup.y});if(st.trail.length>26)st.trail.shift();
      st.blink-=dt;if(st.blink<=0)st.blink=2.4+Math.random()*3;
      // eyes: toward the signal while it shines, toward you when it comes, otherwise drifting
      let ex=Math.sin(st.t*0.7)*0.6,ey=Math.cos(st.t*0.5)*0.4;
      if(pup.phase==='cue'){ex=(WW*0.5-pup.x)/200;ey=-1;}else if(pup.move===5||pup.move===6){ex=(WW*0.5-pup.x)/200;ey=1;}else if(pup.walk>0.2){ex=pup.face;ey=0;}
      st.eye.x+=(Math.max(-1,Math.min(1,ex))-st.eye.x)*Math.min(1,dt*8);st.eye.y+=(Math.max(-1,Math.min(1,ey))-st.eye.y)*Math.min(1,dt*8);
      for(const k in st.flash)st.flash[k]=Math.max(0,st.flash[k]-dt*1.3);
      for(const k in st.mood)st.mood[k]=Math.max(0,st.mood[k]-dt);
      st.backwave=Math.max(0,st.backwave-dt*1.5);st.grab=Math.max(0,st.grab-dt*4);
      if(st.sigT>=0){st.sigT+=dt*st.speed;if(st.sigT>CUE_T+0.6)st.sigT=-1;}
      if(!st.test&&st.dirty&&st.t-st.lastSave>30)saveNow();
    }
  }
  for(const p of st.parts){p.life+=dt;if(p.home){const q=Math.min(1,p.life/p.max);p.x+=(p.tx-p.x)*q*0.25;p.y+=(p.ty-p.y)*q*0.25;}}
  st.parts=st.parts.filter(p=>p.life<p.max);
  for(const r of st.ripples)r.t+=dt;st.ripples=st.ripples.filter(r=>r.t<0.8);
}

// ---------- frame ----------
function draw(){
  ctx.setTransform(dpr*S,0,0,dpr*S,0,0);ctx.clearRect(0,0,SW,SH);ui=[];
  if(st.screen==='title'){drawTitle();if(st.paused)drawMenu();if(st.help>=0)drawHelp();return;}
  if(st.screen==='studio'){drawStudio();if(st.paused)drawMenu();if(st.help>=0)drawHelp();return;}
  drawBackdrop();drawMotes(0,0,SW,SH);
  drawTop();
  const pup=st.test?st.test.pup:st.pup,b=st.test?st.test.brain:st.brain;
  // keep the brain's picture in step with what the creature currently sees
  st.live=pup.phase==='cue'||((pup.phase==='move'||pup.phase==='rest')&&pup.cueForMove>=0);
  {const xv=new Float64Array(NIN),cq=st.live?(pup.phase==='cue'?pup.cue:pup.cueForMove):st.cur;b.forward(cueVec(cq,xv),1);b.x.set(xv);}
  drawBrain(pup,b);
  drawPond(pup);
  if(st.test){
    const r=L.world,t=st.test,n=t.trials.length;
    txt('TEST',r.x+16,r.y+22,13,PAL.glim,'left',500,4);
    for(let i=0;i<n;i++){const d=t.res[i],x=r.x+r.w-20-(n-1-i)*18;ctx.beginPath();ctx.arc(x,r.y+22,5,0,6.283);ctx.fillStyle=d===undefined?'rgba(160,180,230,0.25)':d?PAL.glim:PAL.danger;ctx.fill();if(i===t.idx){ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}}
  }
  drawGraph();
  const c=coach();
  if(!st.result)drawCoach(c);
  drawToolbar(c);
  if(st.result)drawResult();
  if(st.paused)drawMenu();
  if(st.help>=0)drawHelp();
}
let lastT=0;
function frame(ts){const dt=Math.min(0.05,(ts-lastT)/1000||0.016);lastT=ts;update(dt);draw();requestAnimationFrame(frame);}

// ---------- input ----------
function lp(e){return{x:e.clientX/S,y:e.clientY/S};}
let pressed=null;
function inWorld(p){const r=L.world;return p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;}
cv.addEventListener('pointerdown',e=>{
  e.preventDefault();const p=lp(e);st.moved=false;
  const b=hit(p.x,p.y);
  if(b){if(b.o.slider){drag.slider=b;setSlider(b,p.x);return;}pressed=b;return;}
  pressed=null;
  if(st.screen==='studio'){if(!st.paused&&st.help<0)studioPointer('down',p);return;}
  if(st.screen!=='play'||st.paused||st.result||st.test||!inWorld(p))return;
  if(e.button===2){reward('poison',p.x,p.y);return;}
  {const pu=st.pup,P=w2s(pu.x,pu.y);if(Math.hypot(p.x-P.x,p.y-P.y)<52*P.k&&(pu.phase==='idle'||pu.phase==='rest'||pu.phase==='cue'))st.dragCell={dx:p.x-P.x,dy:p.y-P.y};}
  st.press={x:p.x,y:p.y,done:false};
  clearTimeout(st.longTimer);
  st.longTimer=setTimeout(()=>{if(st.press&&!st.press.done&&!st.moved){st.press.done=true;reward('poison',st.press.x,st.press.y);}},550);
},{passive:false});
cv.addEventListener('pointermove',e=>{
  const p=lp(e);st.hover=hit(p.x,p.y);
  cv.style.cursor=st.hover?'pointer':(st.screen==='play'&&!st.test&&inWorld(p)?'crosshair':'default');
  if(drag.slider){setSlider(drag.slider,p.x);return;}
  if(st.screen==='studio'){if(studioPointer('move',p))cv.style.cursor='grabbing';else if(!st.hover)cv.style.cursor='default';return;}
  if(st.press&&Math.hypot(p.x-st.press.x,p.y-st.press.y)>10)st.moved=true;
  if(st.dragCell&&st.moved&&st.screen==='play'&&!st.test){
    const ar=L.arena,pu=st.pup;
    const P2=L.world,xLo=(P2.x-ar.x)/ar.k+45,xHi=(P2.x+P2.w-ar.x)/ar.k-45;pu.x=Math.max(xLo,Math.min(xHi,(p.x-st.dragCell.dx-ar.x)/ar.k));pu.y=Math.max(45,Math.min(WH-70,(p.y-st.dragCell.dy-ar.y)/ar.k));
    pu.homeX=pu.x;pu.homeY=pu.y;pu.moveGoal={x:pu.x,y:pu.y};pu.walk=0;st.grab=1;cv.style.cursor='grabbing';
  }else if(st.screen==='play'&&!st.test&&!st.hover&&inWorld(p)){const pu=st.pup,P=w2s(pu.x,pu.y);if(Math.hypot(p.x-P.x,p.y-P.y)<52*P.k)cv.style.cursor='grab';}
});
cv.addEventListener('pointerup',e=>{
  if(drag.slider){drag.slider=null;return;}
  if(st.screen==='studio'){studioPointer('up',lp(e));return;}
  clearTimeout(st.longTimer);
  if(st.press&&!st.press.done&&!st.moved&&e.button===0){st.press.done=true;reward('treat',st.press.x,st.press.y);}
  st.press=null;st.dragCell=null;
});
cv.addEventListener('pointercancel',()=>{sd.drag=null;drag.slider=null;st.dragCell=null;st.press=null;clearTimeout(st.longTimer);pressed=null;});
cv.addEventListener('click',e=>{const p=lp(e),b=hit(p.x,p.y);if(pressed&&b&&b.id===pressed.id&&b.fn&&!b.o.disabled)b.fn();pressed=null;});
cv.addEventListener('contextmenu',e=>e.preventDefault());
function setSlider(b,x){const s=b.o.slider;s.set(Math.max(0,Math.min(1,(x-s.x)/s.w)));}
addEventListener('keydown',e=>{
  if(e.repeat)return;const k=e.key.toLowerCase();
  if(st.help>=0){if(k==='escape'||k==='h')st.help=-1;else if(k==='arrowright'||k==='enter'||k===' '){e.preventDefault();st.help=st.help<HELP_PAGES.length-1?st.help+1:-1;}else if(k==='arrowleft')st.help=Math.max(0,st.help-1);return;}
  if(k==='h'){st.help=0;sfx('open');return;}
  if(st.screen==='title'){if(k==='enter'||k===' '){e.preventDefault();startAudio();if(st.hasSave)continueSave();else newBrain();st.screen='play';sfx('open');}return;}
  if(st.screen==='studio'&&!st.paused&&sd.mode==='edit'&&k==='escape'){sd.mode='idle';return;}
  if(k==='escape'||k==='p'){setPaused(!st.paused);st.confirm=false;return;}
  if(st.screen==='studio'){if(!st.paused)studioKey(k,e);return;}
  if(st.paused)return;
  if(k>='1'&&k<='8'){giveSignal(+k-1);return;}
  if(k==='g'||k===' '){e.preventDefault();reward('treat');}
  else if(k==='b'||k==='n')reward('poison');
  else if(k==='f')doBtn('speed');else if(k==='t')doBtn('test');
});

// ---------- boot ----------
resize();
initSound();
if(window.Plaxzy&&Plaxzy.save)Plaxzy.save.load(d=>applySave(d));
if(window.Plaxzy&&Plaxzy.fullscreen&&Plaxzy.fullscreen.onChange)Plaxzy.fullscreen.onChange(()=>{});
newBrain();
window.__synapse={st,giveSignal,reward,doBtn,startTest};
requestAnimationFrame(frame);
