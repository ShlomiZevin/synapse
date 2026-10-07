// ===== STUDIO: free training. Show the cell any routine, let it try, reward it. =====
const BADGE_COL=['#ffd86b','#28e0c8','#ff8fd0','#7fb2ff','#9be56b','#ffa24f'];
const sd={S:null,cur:0,mode:'idle',beat:0,edit:[],pose:null,play:null,att:null,score:0,drag:null,handles:null,
  flash:{good:0,bad:0,learn:0},msgT:0,lastBeat:-1,mood:{good:0,bad:0},parts:[]};

function enterStudio(){
  if(!sd.S){sd.S=new Studio((Math.random()*1e9)|0);if(st.savedStudio)sd.S.load(st.savedStudio);}
  sd.mode='idle';sd.pose=restPose();sd.play=null;sd.att=null;st.screen='studio';st.paused=false;
}
function studioTrick(){return sd.S.tricks[sd.cur];}
function lerpPose(a,b,u){const o=new Array(NP);for(let i=0;i<NP;i++)o[i]=a[i]+(b[i]-a[i])*u;return o;}
function ease(u){u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);}

// ---------- a trick's badge: a star with as many points as its number ----------
function drawBadge(i,x,y,r,a){
  a=a===undefined?1:a;const n=i+3,c=BADGE_COL[i];
  ctx.save();ctx.translate(x,y);ctx.fillStyle=hexA(c,a);ctx.beginPath();
  for(let q=0;q<n*2;q++){const an=-1.5708+q*Math.PI/n,rd=q%2?r*0.5:r;ctx.lineTo(Math.cos(an)*rd,Math.sin(an)*rd);}
  ctx.closePath();ctx.fill();ctx.restore();
}

// ---------- the cell with a body it can move ----------
// returns where its handles are on screen (used while you pose it)
function drawStudioCell(pose,cx,cy,unit,o){
  o=o||{};const T=st.t;
  const R=34*unit*(1+0.42*pose[7]);
  const off=o.mini?0.4:1,x=cx+pose[8]*WW*0.3*unit*off,y=cy-pose[9]*WH*0.24*unit*off;
  const rot=pose[5]*0.55+pose[12]*6.2832;
  const sy=1+0.38*pose[6],sx=1-0.24*pose[6];
  const hue=(170+pose[11]*300)%360,col='hsl('+hue+',78%,56%)',colA=(al)=>'hsla('+hue+',78%,56%,'+al+')',light='hsl('+hue+',90%,86%)';
  const glowA=0.25+pose[10]*0.75;
  if(!o.mini){ctx.save();ctx.globalCompositeOperation='lighter';
    const gr=ctx.createRadialGradient(x,y,0,x,y,R*(2.4+pose[10]*2.2));gr.addColorStop(0,colA(0.55*glowA));gr.addColorStop(1,colA(0));ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,R*(2.4+pose[10]*2.2),0,6.283);ctx.fill();ctx.restore();}
  const cs=Math.cos(rot),sn=Math.sin(rot);
  const toScreen=(lx,ly)=>({x:x+(lx*cs-ly*sn),y:y+(lx*sn+ly*cs)});
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  ctx.lineCap='round';ctx.lineJoin='round';
  // tail: two strands swinging
  const tw=pose[4]*0.9;
  ctx.strokeStyle=colA(0.8);ctx.lineWidth=Math.max(1.5,3*unit);
  let tailTip={x:0,y:0};
  for(const f of[-1,1]){ctx.beginPath();ctx.moveTo(f*R*0.12,R*0.85*sy);
    for(let q=1;q<=6;q++){const d=q*R*0.2,wv=Math.sin(T*4+q*0.9+f)*R*0.07*(o.mini?0:1);const px=f*R*0.12+Math.sin(tw)*d+wv,py=R*0.85*sy+Math.cos(tw)*d;ctx.lineTo(px,py);if(q===6&&f===1)tailTip={x:px-R*0.12,y:py};}
    ctx.stroke();}
  // arms: -1 hangs down, 0 points out, +1 points up
  const arm=(s,ang,reach)=>{
    const sh={x:s*R*0.82*sx,y:R*0.05},th=ang*1.5708,len=R*(0.45+1.25*reach);
    const tip={x:sh.x+s*Math.cos(th)*len,y:sh.y-Math.sin(th)*len};
    const mid={x:(sh.x+tip.x)/2+s*R*0.12,y:(sh.y+tip.y)/2+R*0.14};
    ctx.strokeStyle=col;ctx.lineWidth=Math.max(2.5,7*unit);ctx.beginPath();ctx.moveTo(sh.x,sh.y);ctx.quadraticCurveTo(mid.x,mid.y,tip.x,tip.y);ctx.stroke();
    ctx.fillStyle=light;ctx.beginPath();ctx.arc(tip.x,tip.y,Math.max(2.5,R*0.17),0,6.283);ctx.fill();
    return{sh,tip};
  };
  const aL=arm(-1,pose[0],pose[1]),aR=arm(1,pose[2],pose[3]);
  // body
  ctx.save();ctx.scale(sx,sy);
  ctx.beginPath();for(let i=0;i<=40;i++){const a=i/40*6.283,rd=R*(1+(o.mini?0:0.05*Math.sin(T*2.2+a*3)+0.025*Math.sin(T*3.7+a*5)));const px=Math.cos(a)*rd,py=Math.sin(a)*rd;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();
  const bg=ctx.createRadialGradient(-R*0.3,-R*0.35,R*0.1,0,0,R*1.1);bg.addColorStop(0,'rgba(245,255,252,0.96)');bg.addColorStop(0.5,colA(0.82));bg.addColorStop(1,colA(0.4));
  ctx.fillStyle=bg;ctx.fill();ctx.strokeStyle=light;ctx.lineWidth=Math.max(1,2*unit);ctx.stroke();
  if(!o.mini){ctx.fillStyle=hexA(PAL.mind,0.5);ctx.beginPath();ctx.ellipse(R*0.28,R*0.4,R*0.24,R*0.18,0.4,0,6.283);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.45)';ctx.beginPath();ctx.ellipse(-R*0.38,-R*0.52,R*0.24,R*0.12,-0.6,0,6.283);ctx.fill();}
  ctx.restore();
  // face
  const happy=sd.mood.good>0&&!o.mini,sad=sd.mood.bad>0&&!o.mini,blink=!o.mini&&st.blink<0.12;
  for(const s of[-1,1]){const ex=s*R*0.33,ey=-R*0.12;
    if(blink){ctx.strokeStyle='#16213f';ctx.lineWidth=Math.max(1,2.2*unit);ctx.beginPath();ctx.arc(ex,ey,R*0.15,0.2,2.94);ctx.stroke();continue;}
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(ex,ey,R*0.23,R*0.26,0,0,6.283);ctx.fill();
    ctx.fillStyle='#16213f';ctx.beginPath();ctx.ellipse(ex,ey+R*0.02,R*0.14,R*0.16,0,0,6.283);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex-R*0.05,ey-R*0.06,R*0.05,0,6.283);ctx.fill();}
  if(!o.mini){ctx.fillStyle='rgba(255,120,160,0.4)';for(const s of[-1,1]){ctx.beginPath();ctx.ellipse(s*R*0.58,R*0.16,R*0.12,R*0.08,0,0,6.283);ctx.fill();}}
  ctx.strokeStyle='#16213f';ctx.lineWidth=Math.max(1,2.2*unit);
  if(happy){ctx.fillStyle='#16213f';ctx.beginPath();ctx.arc(0,R*0.24,R*0.15,0,3.1416);ctx.fill();}
  else if(sad){ctx.beginPath();ctx.arc(0,R*0.4,R*0.14,3.6,5.8);ctx.stroke();}
  else{ctx.beginPath();ctx.arc(0,R*0.18,R*0.14,0.5,2.64);ctx.stroke();}
  ctx.restore();
  return{R,c:{x,y},handL:toScreen(aL.tip.x,aL.tip.y),handR:toScreen(aR.tip.x,aR.tip.y),shL:toScreen(aL.sh.x,aL.sh.y),shR:toScreen(aR.sh.x,aR.sh.y),
    tail:toScreen(tailTip.x,tailTip.y),top:toScreen(0,-R*sy-18*unit),size:toScreen(R*sx*0.95+14*unit,R*sy*0.75+10*unit),rot,cx,cy,unit};
}

// ---------- flow ----------
function studioShow(){   // start posing a routine
  const tr=studioTrick();
  sd.edit=tr.beats?tr.demo.map(p=>p.slice()):[restPose(),restPose(),restPose(),restPose()];
  sd.beat=0;sd.mode='edit';sd.play=null;sfx('open');
}
function studioDone(){   // finished posing: the cell watches it once and learns a little
  sd.S.setDemo(sd.cur,sd.edit);sd.mode='idle';studioWatch();
}
function studioWatch(){
  const tr=studioTrick();if(!tr.beats)return;
  sd.mode='watch';sd.play={poses:tr.demo,t:0};sd.lastBeat=-1;sfx('sig');
}
function studioTry(){
  const tr=studioTrick();if(!tr.beats||sd.mode==='edit'||sd.mode==='watch'||sd.mode==='try')return;
  sd.att=sd.S.attempt(sd.cur);sd.mode='try';sd.play={poses:sd.att,t:0};sd.lastBeat=-1;sfx('pop');
}
function studioReward(kind){
  if(sd.mode!=='judge')return;
  if(kind==='treat'){sd.S.treat(sd.cur);sd.flash.good=1;sd.mood.good=1.4;sfx('treat');setTimeout(()=>sfx('happy'),200);}
  else{sd.S.poison(sd.cur);sd.flash.bad=1;sd.mood.bad=1.4;sfx('poison');}
  sd.flash.learn=1;sd.mode='idle';st.dirty=true;saveNow();
}
function studioSelect(i){
  if(sd.mode==='edit'||sd.mode==='watch'||sd.mode==='try')return;
  sd.cur=i;sd.mode='idle';sd.att=null;sd.pose=restPose();sfx('click');
}
function studioEditKey(part,d){const p=sd.edit[sd.beat];if(!p)return;p[part]=Math.max(PARTS[part].lo,Math.min(PARTS[part].hi,p[part]+d));sfx('click');}

function studioUpdate(dt){
  for(const k in sd.flash)sd.flash[k]=Math.max(0,sd.flash[k]-dt*1.3);
  for(const k in sd.mood)sd.mood[k]=Math.max(0,sd.mood[k]-dt);
  st.blink-=dt;if(st.blink<=0)st.blink=2.4+Math.random()*3;
  const rest=restPose();
  if(sd.mode==='edit'){sd.pose=sd.edit[sd.beat];return;}
  if(sd.play){
    const pl=sd.play,K=pl.poses.length;pl.t+=dt;
    const b=Math.floor(pl.t/BEAT_SECS);
    if(b<K){
      const u=ease((pl.t-b*BEAT_SECS)/(BEAT_SECS*0.6));
      sd.pose=lerpPose(b?pl.poses[b-1]:rest,pl.poses[b],u);sd.beat=b;
      if(b!==sd.lastBeat){sd.lastBeat=b;sfx('beat');}
    }else{
      const u=ease((pl.t-K*BEAT_SECS)/0.45);sd.pose=lerpPose(pl.poses[K-1],rest,u);
      if(u>=1){
        sd.play=null;sd.beat=0;
        if(sd.mode==='watch'){sd.S.watch(sd.cur);sd.flash.learn=1;sd.mode='idle';st.dirty=true;saveNow();}
        else if(sd.mode==='try'){const tr=studioTrick();sd.score=sd.S.score(sd.cur,sd.att);tr.tries++;tr.last=sd.score;tr.best=Math.max(tr.best,sd.score);tr.history.push(sd.score);if(tr.history.length>40)tr.history.shift();sd.mode='judge';st.dirty=true;}
      }
    }
  }else if(sd.mode!=='edit'){sd.pose=lerpPose(sd.pose||rest,rest,Math.min(1,dt*6));}
}

// ---------- drawing ----------
function studioCoach(){
  const tr=studioTrick();
  if(sd.mode==='edit')return'Drag its arms, tail and body to pose it for beat '+(sd.beat+1)+'. Pick the next beat below. Press DONE when the routine is ready.';
  if(sd.mode==='watch')return'It is watching your routine…';
  if(sd.mode==='try')return'It is trying…';
  if(sd.mode==='judge')return'It matched '+Math.round(sd.score*100)+'%. Give a TREAT (G) to make it surer, POISON (B) if that was wrong, or REMIND to show it again.';
  if(!tr.beats)return'Press SHOW, then pose the cell to teach it a trick of your own.';
  if(tr.shows<2)return'It has seen this once. Press TRY to see what it learned, or REMIND to show it again.';
  return'TRY to see it, REMIND to show it again, SHOW to change the routine.';
}
function drawStudioPond(){
  const r=L.world,a=L.arena,T=st.t;
  ctx.save();rr(r.x,r.y,r.w,r.h,18);ctx.clip();
  const bg=ctx.createRadialGradient(r.x+r.w/2,r.y+r.h/2,10,r.x+r.w/2,r.y+r.h/2,r.w*0.7);bg.addColorStop(0,'#17275a');bg.addColorStop(1,'#0c1330');
  ctx.fillStyle=bg;ctx.fillRect(r.x,r.y,r.w,r.h);
  if(sd.mode==='watch'||sd.mode==='try'){ctx.save();ctx.globalCompositeOperation='lighter';glow(r.x+r.w/2,r.y+r.h*0.5,r.w*0.6,sd.mode==='watch'?'#cfe0ff':BADGE_COL[sd.cur],0.12+0.06*Math.sin(T*12.566));ctx.restore();}
  drawMotes(r.x,r.y,r.w,r.h);
  // the stage: a soft ring where the cell performs
  const cx=a.x+WW*0.5*a.k,cy=a.y+WH*0.46*a.k;
  ctx.strokeStyle=hexA(BADGE_COL[sd.cur],0.25);ctx.lineWidth=2;ctx.setLineDash([6,8]);ctx.beginPath();ctx.ellipse(cx,cy+WH*0.3*a.k,WW*0.3*a.k,WH*0.07*a.k,0,0,6.283);ctx.stroke();ctx.setLineDash([]);
  const hd=drawStudioCell(sd.pose||restPose(),cx,cy,a.k);sd.handles=hd;
  if(sd.mode==='edit'){
    // handles you can drag
    const H=[['handL',PAL.food],['handR',PAL.food],['tail','#7fb2ff'],['top','#ff8fd0'],['size','#9be56b']];
    for(const [id,c] of H){const p=hd[id],on=sd.drag===id,rad=on?11:8;
      ctx.save();ctx.globalCompositeOperation='lighter';glow(p.x,p.y,rad*2.6,c,0.6+0.2*Math.sin(T*5));ctx.restore();
      ctx.beginPath();ctx.arc(p.x,p.y,rad,0,6.283);ctx.fillStyle='rgba(8,12,34,0.85)';ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();}
    const lab=(id,t,dx,dy)=>txt(t,hd[id].x+dx,hd[id].y+dy,10.5,'rgba(225,232,255,0.8)','center',400,0.5);
    lab('top','stretch · lean',0,-16);lab('size','size',0,18);lab('tail','tail',0,18);
    txt('drag a dot to pose that part  ·  drag the body to move it',r.x+r.w/2,r.y+20,11.5,'rgba(225,232,255,0.7)','center',400,0.5);
  }
  // hearts / sparks
  ctx.save();ctx.globalCompositeOperation='lighter';
  if(sd.mood.good>0)for(let i=0;i<8;i++){const an=i*0.785+T*2,d=hd.R*(1.4+(1.4-sd.mood.good)*1.2);glow(hd.c.x+Math.cos(an)*d,hd.c.y+Math.sin(an)*d,8*a.k,PAL.food,sd.mood.good/1.4);}
  if(sd.mood.bad>0)for(let i=0;i<8;i++){const an=i*0.785-T*2,d=hd.R*(1.4+(1.4-sd.mood.bad)*1.2);glow(hd.c.x+Math.cos(an)*d,hd.c.y+Math.sin(an)*d,8*a.k,PAL.danger,sd.mood.bad/1.4);}
  ctx.restore();
  ctx.restore();
  ctx.save();rr(r.x,r.y,r.w,r.h,18);ctx.strokeStyle=hexA(PAL.glim,0.25);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  // hint line
  const sz=Math.max(12,Math.min(14,r.w/58));
  ctx.save();rr(r.x+12,r.y+r.h-40,r.w-24,28,14);ctx.fillStyle='rgba(8,12,34,0.8)';ctx.fill();ctx.strokeStyle=hexA(PAL.food,0.35);ctx.lineWidth=1;ctx.stroke();ctx.restore();
  txt(studioCoach(),r.x+r.w/2,r.y+r.h-26,sz,'rgba(240,246,255,0.96)','center',400,0.2);
}
function drawStudioTimeline(){
  const r=L.graph;if(r.h<60)return;
  const tr=studioTrick(),editing=sd.mode==='edit',poses=editing?sd.edit:tr.demo,K=poses.length;
  panel(r,'rgba(8,12,34,0.75)',editing?'your routine  ·  one pose per beat':'the routine you showed',K?K+(K===1?' beat':' beats'):'');
  const pad=16,top=r.y+34,th=Math.min(r.h-(editing?92:48),96),tw=Math.min(th*0.95,(r.w-2*pad-(editing?96:0))/Math.max(NBEAT,1)-6);
  for(let b=0;b<K;b++){
    const x=r.x+pad+b*(tw+6),on=b===sd.beat&&(editing||sd.play);
    ctx.save();rr(x,top,tw,th,10);ctx.fillStyle=on?hexA(BADGE_COL[sd.cur],0.16):'rgba(12,18,48,0.9)';ctx.fill();ctx.strokeStyle=on?'#fff':hexA(PAL.glim,0.3);ctx.lineWidth=on?2:1;ctx.stroke();ctx.clip();
    const u=tw/150;drawStudioCell(poses[b],x+tw/2,top+th*0.5,u,{mini:true});ctx.restore();
    mono(String(b+1),x+8,top+10,10,'rgba(200,215,255,0.7)','left');
    if(editing)btn('beat'+b,x,top,tw,th,()=>{sd.beat=b;sfx('click');},{});
  }
  if(!K)txt('no routine yet: press SHOW to pose one',r.x+r.w/2,top+th/2,13,'rgba(200,215,255,0.5)','center');
  if(editing){
    const bx=r.x+r.w-pad-88,bw=40,bh=Math.min(40,th/2-3);
    const sq=(id,label,x,y,fn,dis)=>{ctx.save();rr(x,y,bw,bh,10);ctx.fillStyle='rgba(12,18,48,0.9)';ctx.fill();ctx.strokeStyle=hexA(PAL.glim,dis?0.2:0.7);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();txt(label,x+bw/2,y+bh/2,18,dis?'rgba(160,180,230,0.3)':'#e6eeff','center',400);btn(id,x,y,bw,bh,fn,{disabled:dis});};
    sq('b_less','−',bx,top,()=>{if(sd.edit.length>1){sd.edit.pop();sd.beat=Math.min(sd.beat,sd.edit.length-1);sfx('click');}},K<=1);
    sq('b_more','+',bx+bw+8,top,()=>{if(sd.edit.length<NBEAT){sd.edit.push(sd.edit[sd.edit.length-1].slice());sd.beat=sd.edit.length-1;sfx('click');}},K>=NBEAT);
    txt('beats',bx+bw+4,top+bh+12,10.5,'rgba(200,215,255,0.6)','center',400,1);
    // extra controls for this beat's pose
    const cy=top+th+26,ch=30;let x=r.x+pad;
    const chip=(id,label,w,fn,col)=>{ctx.save();rr(x,cy-ch/2,w,ch,ch/2);ctx.fillStyle='rgba(12,18,48,0.9)';ctx.fill();ctx.strokeStyle=hexA(col||PAL.glim,0.6);ctx.lineWidth=1.1;ctx.stroke();ctx.restore();txt(label,x+w/2,cy,12,'#e6eeff','center',400,0.5);btn(id,x,cy-ch/2-6,w,ch+12,fn,{});x+=w+6;};
    const lbl=(t)=>{txt(t,x,cy,11,'rgba(200,215,255,0.6)','left',400,1);ctx.font='400 11px '+FONT;x+=ctx.measureText(t).width+t.length+8;};
    lbl('spin');chip('sp-','↺',36,()=>studioEditKey(12,-0.25));chip('sp+','↻',36,()=>studioEditKey(12,0.25));x+=8;
    lbl('glow');chip('gl-','−',34,()=>studioEditKey(10,-0.25));chip('gl+','+',34,()=>studioEditKey(10,0.25));x+=8;
    lbl('colour');
    for(let c=0;c<6;c++){const v=c/6,hue=(170+v*300)%360,on=Math.abs(sd.edit[sd.beat][11]-v)<0.01;
      ctx.beginPath();ctx.arc(x+12,cy,on?12:9,0,6.283);ctx.fillStyle='hsl('+hue+',78%,56%)';ctx.fill();if(on){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
      btn('hue'+c,x-2,cy-22,28,44,()=>{sd.edit[sd.beat][11]=v;sfx('click');},{});x+=28;}
    x+=8;chip('rest','rest pose',84,()=>{sd.edit[sd.beat]=restPose();sfx('click');},'#9fb4ff');
  }else if(tr.history.length){
    // how its tries have gone
    const gx=r.x+pad,gy=top+th+14,gw=r.w-2*pad,gh=r.y+r.h-gy-10;
    if(gh>16){mono('match per try',gx,gy+6,10,'rgba(200,215,255,0.6)','left');
      ctx.strokeStyle=PAL.glim;ctx.lineWidth=2;ctx.beginPath();tr.history.forEach((v,i)=>{const px=gx+110+(gw-110)*i/Math.max(tr.history.length-1,9),py=gy+gh-gh*v;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();
      const lv=tr.history[tr.history.length-1];glow(gx+110+(gw-110)*(tr.history.length-1)/Math.max(tr.history.length-1,9),gy+gh-gh*lv,9,PAL.glim,0.9);}
  }
}
function drawStudioBrain(){
  const r=L.brain,net=sd.S.net,T=st.t,tr=studioTrick();
  panel(r,'rgba(8,12,34,0.84)','the brain  ·  live neural network',net.H+' neurons · '+net.updates+' learning steps');
  ctx.save();rr(r.x,r.y,r.w,r.h,18);ctx.clip();
  ctx.fillStyle='rgba(120,150,230,0.10)';for(let gx=r.x+18;gx<r.x+r.w;gx+=22)for(let gy=r.y+34;gy<r.y+r.h-6;gy+=22)ctx.fillRect(gx,gy,1.2,1.2);
  if(sd.flash.good>0.01)glow(r.x+r.w*0.55,r.y+r.h*0.5,r.w*0.9,PAL.food,sd.flash.good*0.3);
  if(sd.flash.bad>0.01)glow(r.x+r.w*0.55,r.y+r.h*0.5,r.w*0.9,PAL.danger,sd.flash.bad*0.3);
  const top=r.y+52,bot=r.y+r.h-30,ix=r.x+34,ox=r.x+r.w-150;
  const live=sd.mode==='watch'||sd.mode==='try'||sd.mode==='edit';
  const beat=Math.max(0,Math.min(NBEAT-1,sd.beat));
  net.forward(net.input(sd.cur,beat));
  const inY=i=>i<NTRICK?top+(bot-top)*0.44*(i+0.5)/NTRICK:top+(bot-top)*(0.5+0.5*(i-NTRICK+0.5)/NBEAT);
  const hid=j=>{const col=j%4,row=(j/4)|0;return{x:r.x+r.w*0.24+col*(r.w*0.085)+((row%2)*r.w*0.02),y:top+(bot-top)*(row+0.5)/10};};
  const outY=k=>top+(bot-top)*(k+0.5)/NP;
  ctx.globalCompositeOperation='lighter';
  // which hidden neurons matter right now
  const act=[];for(let j=0;j<net.H;j++)act.push(Math.abs(net.h[j]));
  for(let j=0;j<net.H;j++){const hp=hid(j);
    for(const i of [sd.cur,NTRICK+beat]){const w=net.W1[j*net.nIn+i];if(Math.abs(w)<0.35)continue;
      ctx.strokeStyle=w>0?hexA(i<NTRICK?BADGE_COL[sd.cur]:'#cfe0ff',Math.min(0.8,0.12+Math.abs(w)*0.22)*(live?1:0.45)):hexA(PAL.danger,Math.min(0.6,0.1+Math.abs(w)*0.15)*(live?1:0.45));
      ctx.lineWidth=0.6+Math.min(2.4,Math.abs(w)*0.9);ctx.beginPath();ctx.moveTo(ix,inY(i));ctx.lineTo(hp.x,hp.y);ctx.stroke();}}
  // the strongest votes into each body part that is doing something
  for(let k=0;k<NP;k++){
    const range=PARTS[k].hi-PARTS[k].lo,dv=Math.abs(net.y[k]-PARTS[k].rest)/range;if(dv<0.06)continue;
    const votes=[];for(let j=0;j<net.H;j++)votes.push([Math.abs(net.h[j]*net.W2[k*net.H+j]),j]);votes.sort((a,b)=>b[0]-a[0]);
    for(let q=0;q<3;q++){const [v,j]=votes[q];if(v<0.02)continue;const hp=hid(j),sg=net.h[j]*net.W2[k*net.H+j];
      ctx.strokeStyle=sg>0?hexA(PAL.food,Math.min(0.95,0.25+v*2.2)):hexA('#7fb2ff',Math.min(0.9,0.25+v*2.2));ctx.lineWidth=0.8+Math.min(4.5,v*9);
      ctx.beginPath();ctx.moveTo(hp.x,hp.y);ctx.lineTo(ox,outY(k));ctx.stroke();
      if(sd.play){const ph=(T*0.9+j*0.13)%1;glow(hp.x+(ox-hp.x)*ph,hp.y+(outY(k)-hp.y)*ph,7,PAL.food,0.9);}}
  }
  if(sd.flash.learn>0.01){const wx=r.x+r.w*sd.flash.learn;const gr=ctx.createLinearGradient(wx-80,0,wx+80,0);gr.addColorStop(0,hexA(PAL.food,0));gr.addColorStop(0.5,hexA(PAL.food,0.28*sd.flash.learn));gr.addColorStop(1,hexA(PAL.food,0));ctx.fillStyle=gr;ctx.fillRect(wx-80,r.y,160,r.h);}
  ctx.globalCompositeOperation='source-over';
  // inputs: which trick, and which beat of it
  for(let i=0;i<NTRICK;i++){const y=inY(i),on=i===sd.cur;if(on)glow(ix,y,26,BADGE_COL[i],0.8);
    ctx.fillStyle='rgba(8,12,34,0.9)';ctx.beginPath();ctx.arc(ix,y,14,0,6.283);ctx.fill();drawBadge(i,ix,y,10,on?1:(sd.S.tricks[i].beats?0.5:0.2));}
  for(let b=0;b<NBEAT;b++){const y=inY(NTRICK+b),on=b===beat&&(sd.play||sd.mode==='edit'),has=b<(sd.mode==='edit'?sd.edit.length:tr.beats);
    if(on)glow(ix,y,18,'#cfe0ff',0.9);ctx.fillStyle=on?'#ffffff':has?'rgba(207,224,255,0.6)':'rgba(160,180,230,0.2)';ctx.beginPath();ctx.arc(ix,y,on?5:3.5,0,6.283);ctx.fill();
    mono(String(b+1),ix-14,y,9,'rgba(200,215,255,0.5)','right');}
  txt('trick',ix,r.y+38,11,'rgba(210,222,255,0.6)','center',400,2);
  txt('beat',ix,inY(NTRICK)-16,11,'rgba(210,222,255,0.6)','center',400,2);
  for(let j=0;j<net.H;j++){const p=hid(j),a=act[j];glow(p.x,p.y,8+a*13,PAL.mind,(0.2+a*0.75)*(live?1:0.6));ctx.fillStyle='#ece4ff';ctx.beginPath();ctx.arc(p.x,p.y,2.4+a*2.6,0,6.283);ctx.fill();}
  // outputs: one neuron per body part, with a needle showing where it is told to go
  txt('moves its body',ox+40,r.y+38,11,'rgba(210,222,255,0.6)','center',400,2);
  for(let k=0;k<NP;k++){
    const y=outY(k),P=PARTS[k],v=Math.max(P.lo,Math.min(P.hi,net.y[k])),f=(v-P.lo)/(P.hi-P.lo),fr=(P.rest-P.lo)/(P.hi-P.lo),dv=Math.abs(f-fr);
    glow(ox,y,10+dv*26,PAL.food,0.15+dv*1.2);ctx.fillStyle=dv>0.06?PAL.food:'rgba(255,216,107,0.45)';ctx.beginPath();ctx.arc(ox,y,4+dv*5,0,6.283);ctx.fill();
    txt(P.name,ox+12,y,11,dv>0.06?'#ffffff':'rgba(215,225,255,0.6)','left',dv>0.06?500:400,0.2);
    const bx=ox+84,bw=r.x+r.w-14-bx;ctx.fillStyle='rgba(160,180,230,0.14)';rr(bx,y-2.5,bw,5,2.5);ctx.fill();
    ctx.fillStyle='rgba(160,180,230,0.5)';ctx.fillRect(bx+bw*fr-0.5,y-5,1,10);
    ctx.fillStyle=PAL.food;const x0=bx+bw*Math.min(f,fr),x1=bx+bw*Math.max(f,fr);rr(x0,y-2.5,Math.max(2,x1-x0),5,2.5);ctx.fill();
    ctx.beginPath();ctx.arc(bx+bw*f,y,3.5,0,6.283);ctx.fillStyle='#fff3cf';ctx.fill();
  }
  const kn=tr.beats?sd.S.knows(sd.cur):0;
  ctx.fillStyle='rgba(8,12,34,0.8)';ctx.fillRect(r.x+1,r.y+r.h-19,r.w-2,18);
  mono('knows it '+Math.round(kn*100)+'%   wobble '+tr.wobble.toFixed(2)+'   shown '+tr.shows+'x   weights '+(net.W1.length+net.W2.length+net.b1.length+net.b2.length),r.x+r.w/2,r.y+r.h-10,10.5,'rgba(150,235,225,0.85)','center');
  ctx.restore();
}
function drawStudioTop(){
  const m=L.m,cy=L.top/2+1,tr=studioTrick();
  txt('SYNAPSE',m+2,cy-8,17,'#e8fffb','left',300,6);
  mono('free training',m+3,cy+12,11,'rgba(150,190,240,0.8)','left');
  const label=tr.beats?('trick '+(sd.cur+1)+'   '+tr.beats+(tr.beats===1?' beat':' beats')+'   best '+Math.round(tr.best*100)+'%'):('trick '+(sd.cur+1)+'   not taught yet');
  ctx.font='500 12px '+MONO;const tw=ctx.measureText(label).width;
  const gx=portrait?m+178:L.world.x,gh=38,gw=18+30+tw+22;
  ctx.save();rr(gx,cy-gh/2,gw,gh,gh/2);ctx.fillStyle='rgba(12,18,48,0.85)';ctx.fill();ctx.strokeStyle=hexA(BADGE_COL[sd.cur],0.6);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  drawBadge(sd.cur,gx+26,cy,11,1);mono(label,gx+46,cy,12,'#fff3cf','left');
  const bs2=38,bx=SW-m-bs2,by=cy-bs2/2,hx=bx-bs2-8;
  ctx.save();rr(hx,by,bs2,bs2,bs2/2);ctx.fillStyle='rgba(12,18,48,0.7)';ctx.fill();ctx.strokeStyle=hexA(PAL.food,0.7);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  txt('?',hx+bs2/2,cy+1,18,PAL.food,'center',500);btn('help',hx-3,by-3,bs2+6,bs2+6,()=>{st.help=HELP_PAGES.length-1;sfx('open');},{});
  ctx.save();rr(bx,by,bs2,bs2,bs2/2);ctx.fillStyle='rgba(12,18,48,0.7)';ctx.fill();ctx.strokeStyle=hexA(PAL.glim,0.6);ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
  ctx.save();ctx.fillStyle=PAL.glim;ctx.strokeStyle=PAL.glim;ctx.lineWidth=2;ctx.translate(bx+bs2/2,cy);ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(-3,-3);ctx.lineTo(3,-7);ctx.lineTo(3,7);ctx.lineTo(-3,3);ctx.lineTo(-7,3);ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(3,0,5.5,-0.9,0.9);ctx.stroke();ctx.restore();
  btn('sound',bx-3,by-3,bs2+6,bs2+6,()=>{setPaused(true);st.confirm=false;sfx('open');},{});
}
function drawStudioToolbar(){
  const m=L.m,gap=L.gap,bs=L.bs,tbY=L.tbY,pulse=0.5+0.5*Math.sin(st.t*6),tr=studioTrick();
  const busy=sd.mode==='watch'||sd.mode==='try',editing=sd.mode==='edit';
  // which button should the player look at
  const hint=editing?'s_done':sd.mode==='judge'?'s_treat':!tr.beats?'s_show':tr.shows&&!busy?'s_try':null;
  const lw=portrait?SW-2*m:L.brain.w,lx=m,ly=tbY;
  const sw=(lw-(NTRICK-1)*gap)/NTRICK;
  for(let i=0;i<NTRICK;i++){
    const x=lx+i*(sw+gap),t2=sd.S.tricks[i],on=i===sd.cur,c=BADGE_COL[i],dis=busy||editing;
    ctx.save();rr(x,ly,sw,bs,bs/2);ctx.fillStyle=on?hexA(c,0.2):'rgba(12,18,48,0.88)';ctx.fill();ctx.strokeStyle=hexA(c,on?1:0.5);ctx.lineWidth=on?2:1.3;ctx.stroke();ctx.restore();
    drawBadge(i,x+bs*0.5,ly+bs/2,bs*0.24,dis&&!on?0.4:1);
    if(sw>90)mono(t2.beats?Math.round(t2.best*100)+'%':'new',x+sw-12,ly+bs/2,10.5,hexA(c,0.9),'right');
    if(!TOUCHY)mono(String(i+1),x+bs*0.5,ly+bs-8,9,hexA(c,0.7),'center');
    btn('trick'+i,x,ly,sw,bs,()=>studioSelect(i),{disabled:dis});
  }
  const acts=editing?[['s_done','done',PAL.food,'Enter',()=>studioDone(),false],['s_cancel','cancel','#9fb4ff','Esc',()=>{sd.mode='idle';sfx('click');},false]]
    :[['s_show',tr.beats?'show new':'show',PAL.food,'S',()=>studioShow(),busy],['s_remind','remind','#cfe0ff','R',()=>{if(!busy)studioWatch();},busy||!tr.beats],
      ['s_try','try',BADGE_COL[sd.cur],'Space',()=>studioTry(),busy||!tr.beats],['s_treat','treat',PAL.food,'G',()=>studioReward('treat'),sd.mode!=='judge'],
      ['s_poison','poison',PAL.danger,'B',()=>studioReward('poison'),sd.mode!=='judge'],['s_menu','menu','#9fb4ff','Esc',()=>{setPaused(true);st.confirm=false;sfx('open');},false]];
  const rx=portrait?m:L.world.x,rw=portrait?SW-2*m:L.world.w,ry=portrait?tbY+bs+gap:tbY,aw=(rw-(acts.length-1)*gap)/acts.length;
  acts.forEach((a2,i)=>{
    const [id,label,col,key,fn,dis]=a2,x=rx+i*(aw+gap),h2=hint===id&&!dis;
    if(h2)glow(x+aw/2,ry+bs/2,bs*1.2,col,0.5*pulse);
    ctx.save();rr(x,ry,aw,bs,bs/2);ctx.fillStyle=h2?hexA(col,0.25):'rgba(12,18,48,0.88)';ctx.fill();ctx.strokeStyle=h2?'#fff':hexA(col,dis?0.2:0.7);ctx.lineWidth=h2?2.5+pulse:1.4;ctx.stroke();ctx.restore();
    txt(label,x+aw/2,ry+bs/2,13,dis?'rgba(200,215,255,0.35)':'#e6eeff','center',400,1);
    if(!TOUCHY&&aw>100)mono(key,x+aw-12,ry+bs/2,9.5,hexA(col,dis?0.3:0.7),'right');
    btn(id,x,ry,aw,bs,fn,{disabled:dis});
  });
}
function drawStudio(){
  drawBackdrop();drawMotes(0,0,SW,SH);
  drawStudioTop();drawStudioBrain();drawStudioPond();drawStudioTimeline();drawStudioToolbar();
}

// ---------- input ----------
function studioPointer(type,p){
  if(sd.mode!=='edit'||!sd.handles)return false;
  const hd=sd.handles,pose=sd.edit[sd.beat];
  if(type==='down'){
    let best=null,bd=26;for(const id of['handL','handR','tail','top','size','c']){const q=hd[id],d=Math.hypot(p.x-q.x,p.y-q.y);if(d<bd){bd=d;best=id;}}
    if(!best&&Math.hypot(p.x-hd.c.x,p.y-hd.c.y)<hd.R*1.05)best='c';
    if(!best)return false;sd.drag=best;sd.grabOff={x:p.x-hd.c.x,y:p.y-hd.c.y};return true;
  }
  if(type==='move'&&sd.drag){
    const R=hd.R,cs=Math.cos(-hd.rot),sn=Math.sin(-hd.rot),unit=hd.unit;
    const loc=(q)=>{const dx=p.x-q.x,dy=p.y-q.y;return{x:dx*cs-dy*sn,y:dx*sn+dy*cs};};
    if(sd.drag==='handL'||sd.drag==='handR'){
      const s=sd.drag==='handL'?-1:1,v=loc(sd.drag==='handL'?hd.shL:hd.shR),len=Math.hypot(v.x,v.y);
      const ang=Math.atan2(-v.y,Math.max(0.0001,s*v.x));
      pose[s<0?0:2]=Math.max(-1,Math.min(1,ang/1.5708));pose[s<0?1:3]=Math.max(0,Math.min(1,(len/R-0.45)/1.25));
    }else if(sd.drag==='tail'){const v=loc(hd.c);pose[4]=Math.max(-1,Math.min(1,v.x/(R*1.1)));}
    else if(sd.drag==='top'){const dx=p.x-hd.c.x,dy=hd.c.y-p.y;pose[6]=Math.max(-1,Math.min(1,(dy/R-1.3)/0.6));pose[5]=Math.max(-1,Math.min(1,dx/(R*1.4)));}
    else if(sd.drag==='size'){const d=Math.hypot(p.x-hd.c.x,p.y-hd.c.y);pose[7]=Math.max(-1,Math.min(1,(d/(34*unit)-1.45)/0.6));}
    else if(sd.drag==='c'){const g=sd.grabOff||{x:0,y:0};pose[8]=Math.max(-1,Math.min(1,(p.x-g.x-hd.cx)/(WW*0.3*unit)));pose[9]=Math.max(-1,Math.min(1,(hd.cy-(p.y-g.y))/(WH*0.24*unit)));}
    return true;
  }
  if(type==='up'&&sd.drag){sd.drag=null;return true;}
  return false;
}
function studioKey(k,e){
  if(sd.mode==='edit'){
    if(k==='enter'){e.preventDefault();studioDone();}
    else if(k==='arrowright'){sd.beat=Math.min(sd.edit.length-1,sd.beat+1);}
    else if(k==='arrowleft'){sd.beat=Math.max(0,sd.beat-1);}
    else if(k==='+'||k==='='){if(sd.edit.length<NBEAT){sd.edit.push(sd.edit[sd.edit.length-1].slice());sd.beat=sd.edit.length-1;}}
    else if(k==='-'){if(sd.edit.length>1){sd.edit.pop();sd.beat=Math.min(sd.beat,sd.edit.length-1);}}
    return;
  }
  if(k>='1'&&k<='6'){studioSelect(+k-1);return;}
  if(k==='s')studioShow();else if(k==='r'){if(sd.mode==='idle'||sd.mode==='judge')studioWatch();}
  else if(k===' '||k==='enter'){e.preventDefault();studioTry();}
  else if(k==='g')studioReward('treat');else if(k==='b'||k==='n')studioReward('poison');
}
