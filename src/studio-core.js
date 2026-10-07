// ===== STUDIO CORE (no DOM): a body the cell can move freely, and a network that learns any routine you show it =====
// the body: every part is one number the brain controls
const PARTS=[
  {id:'armL',  name:'left arm',   lo:-1,hi:1,rest:-0.75},   // -1 hanging down ... +1 straight up
  {id:'reachL',name:'left reach', lo:0, hi:1,rest:0.25},
  {id:'armR',  name:'right arm',  lo:-1,hi:1,rest:-0.75},
  {id:'reachR',name:'right reach',lo:0, hi:1,rest:0.25},
  {id:'tail',  name:'tail',       lo:-1,hi:1,rest:0},
  {id:'lean',  name:'lean',       lo:-1,hi:1,rest:0},
  {id:'stretch',name:'stretch',   lo:-1,hi:1,rest:0},
  {id:'size',  name:'size',       lo:-1,hi:1,rest:0},
  {id:'x',     name:'move side',  lo:-1,hi:1,rest:0},
  {id:'y',     name:'move up',    lo:-1,hi:1,rest:0},
  {id:'glow',  name:'glow',       lo:0, hi:1,rest:0.15},
  {id:'hue',   name:'colour',     lo:0, hi:1,rest:0},
  {id:'spin',  name:'spin',       lo:-1,hi:1,rest:0}
];
const NP=PARTS.length, NTRICK=6, NBEAT=8, SIN=NTRICK+NBEAT, SH_=40;
const BEAT_SECS=0.5;
function restPose(){return PARTS.map(p=>p.rest);}
function clampPose(v){for(let i=0;i<NP;i++)v[i]=Math.max(PARTS[i].lo,Math.min(PARTS[i].hi,v[i]));return v;}
// how alike two poses are, 0..1 (1 = identical)
function poseMatch(a,b){let e=0;for(let i=0;i<NP;i++)e+=Math.abs(a[i]-b[i])/(PARTS[i].hi-PARTS[i].lo);return Math.max(0,1-(e/NP)*3.2);}

class StudioNet{
  constructor(rng){
    this.rng=rng;this.nIn=SIN;this.H=SH_;this.nOut=NP;
    const g=()=>{let u=0,v=0;while(!u)u=rng();v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*v);};
    this.W1=new Float64Array(this.H*this.nIn);this.b1=new Float64Array(this.H);this.W2=new Float64Array(this.nOut*this.H);this.b2=Float64Array.from(restPose());
    for(let i=0;i<this.W1.length;i++)this.W1[i]=g()*0.45;
    for(let i=0;i<this.W2.length;i++)this.W2[i]=g()*0.03;
    this.x=new Float64Array(this.nIn);this.h=new Float64Array(this.H);this.y=new Float64Array(this.nOut);
    this.adam={};for(const k of ['W1','b1','W2','b2'])this.adam[k]={m:new Float64Array(this[k].length),v:new Float64Array(this[k].length)};
    this.t=0;this.updates=0;
  }
  input(trick,beat,x){x=x||this.x;x.fill(0);x[trick]=1;x[NTRICK+beat]=1;return x;}
  forward(x){
    const n=this.nIn,H=this.H,O=this.nOut;if(x!==this.x)this.x.set(x);
    for(let j=0;j<H;j++){let s=this.b1[j];const o=j*n;for(let i=0;i<n;i++)if(x[i]!==0)s+=this.W1[o+i]*x[i];this.h[j]=Math.tanh(s);}
    for(let k=0;k<O;k++){let s=this.b2[k];const o=k*H;for(let j=0;j<H;j++)s+=this.W2[o+j]*this.h[j];this.y[k]=s;}
    return this.y;
  }
  pose(trick,beat){return clampPose(Array.from(this.forward(this.input(trick,beat))));}
  // one step of gradient descent on a list of {trick,beat,target,w} (real backpropagation, Adam)
  step(samples,lr){
    const n=this.nIn,H=this.H,O=this.nOut;
    const gW1=new Float64Array(H*n),gb1=new Float64Array(H),gW2=new Float64Array(O*H),gb2=new Float64Array(O);let tw=0,loss=0;
    for(const s of samples){
      this.forward(this.input(s.trick,s.beat));const w=s.w===undefined?1:w0(s.w);tw+=w;
      const gh=new Float64Array(H);
      for(let k=0;k<O;k++){const d=(this.y[k]-s.target[k])*w;loss+=d*d;gb2[k]+=d;const o=k*H;for(let j=0;j<H;j++){gW2[o+j]+=d*this.h[j];gh[j]+=d*this.W2[o+j];}}
      for(let j=0;j<H;j++){const gp=gh[j]*(1-this.h[j]*this.h[j]);gb1[j]+=gp;const o=j*n;for(let i=0;i<n;i++)if(this.x[i]!==0)gW1[o+i]+=gp*this.x[i];}
    }
    if(!tw)return 0;
    const G={W1:gW1,b1:gb1,W2:gW2,b2:gb2};this.t++;
    const b1=0.9,b2=0.999,c1=1-Math.pow(b1,this.t),c2=1-Math.pow(b2,this.t);
    for(const k in G){const p=this[k],g=G[k],a=this.adam[k];for(let i=0;i<p.length;i++){const gi=g[i]/tw;a.m[i]=b1*a.m[i]+(1-b1)*gi;a.v[i]=b2*a.v[i]+(1-b2)*gi*gi;p[i]-=lr*(a.m[i]/c1)/(Math.sqrt(a.v[i]/c2)+1e-8);}}
    this.updates++;return loss/tw;
  }
  export(){const o={};for(const k of ['W1','b1','W2','b2'])o[k]=Array.from(this[k],v=>Math.round(v*1e4)/1e4);o.u=this.updates;return o;}
  load(o){
    if(!o||typeof o!=='object')return false;
    const ok=(a,len)=>Array.isArray(a)&&a.length===len&&a.every(v=>typeof v==='number'&&isFinite(v)&&Math.abs(v)<100);
    if(!(ok(o.W1,this.W1.length)&&ok(o.b1,this.b1.length)&&ok(o.W2,this.W2.length)&&ok(o.b2,this.b2.length)))return false;
    this.W1.set(o.W1);this.b1.set(o.b1);this.W2.set(o.W2);this.b2.set(o.b2);this.updates=Math.max(0,o.u|0);return true;
  }
}
function w0(w){return w;}

// a trainer's notebook: the routines you showed (demos), and how sure the cell is of each (wobble)
class Studio{
  constructor(seed){
    this.rng=mulberry(seed||1);this.net=new StudioNet(this.rng);
    this.tricks=[];for(let i=0;i<NTRICK;i++)this.tricks.push({beats:0,demo:[],wobble:0.34,shows:0,tries:0,best:0,last:0,history:[]});
  }
  setDemo(t,poses){const tr=this.tricks[t];tr.demo=poses.map(p=>clampPose(p.slice()));tr.beats=tr.demo.length;}
  // every routine it has been shown, as training examples (old ones are rehearsed more softly so they are not forgotten)
  samples(focus){
    const out=[];
    for(let t=0;t<NTRICK;t++){const tr=this.tricks[t];for(let b=0;b<tr.beats;b++)out.push({trick:t,beat:b,target:tr.demo[b],w:t===focus?1:1.5});}
    return out;
  }
  // SHOW: the cell watches the routine once. Its brain moves part of the way toward it.
  watch(t){const s=this.samples(t);for(let i=0;i<WATCH_STEPS;i++)this.net.step(s,WATCH_LR);this.tricks[t].shows++;}
  // TRY: what the brain produces, plus the wobble of a cell that is not sure yet
  attempt(t){
    const tr=this.tricks[t],out=[];
    for(let b=0;b<tr.beats;b++){const p=this.net.pose(t,b);for(let i=0;i<NP;i++)p[i]+=gauss(this.rng)*tr.wobble*(PARTS[i].hi-PARTS[i].lo)*0.5;out.push(clampPose(p));}
    return out;
  }
  score(t,att){const tr=this.tricks[t];if(!tr.beats)return 0;let s=0;for(let b=0;b<tr.beats;b++)s+=poseMatch(att[b],tr.demo[b]);return s/tr.beats;}
  // how well the brain itself knows it, without wobble
  knows(t){const tr=this.tricks[t];if(!tr.beats)return 0;let s=0;for(let b=0;b<tr.beats;b++)s+=poseMatch(this.net.pose(t,b),tr.demo[b]);return s/tr.beats;}
  // TREAT: "yes, like that" -> it grows surer (less wobble) and the routine settles in a little more
  treat(t){const tr=this.tricks[t];tr.wobble=Math.max(0.02,tr.wobble*0.62);const s=this.samples(t);for(let i=0;i<TREAT_STEPS;i++)this.net.step(s,WATCH_LR);}
  // POISON: "no" -> it doubts itself (more wobble) and lets go of some of what it learned for this signal
  poison(t){
    const tr=this.tricks[t];tr.wobble=Math.min(0.5,tr.wobble*1.35+0.03);
    const rest=restPose(),s=[];for(let b=0;b<tr.beats;b++)s.push({trick:t,beat:b,target:rest,w:1});
    for(let i=0;i<POISON_STEPS;i++)this.net.step(s,WATCH_LR);
  }
  export(){return{net:this.net.export(),tricks:this.tricks.map(t=>({b:t.beats,d:t.demo.map(p=>p.map(v=>Math.round(v*1000)/1000)),w:Math.round(t.wobble*1000)/1000,s:t.shows,n:t.tries,best:Math.round(t.best*1000)/1000}))};}
  load(o){
    if(!o||typeof o!=='object'||!Array.isArray(o.tricks)||!this.net.load(o.net))return false;
    for(let i=0;i<NTRICK;i++){const s=o.tricks[i],tr=this.tricks[i];if(!s||typeof s!=='object')continue;
      const beats=Math.max(0,Math.min(NBEAT,s.b|0)),d=[];
      if(Array.isArray(s.d))for(let b=0;b<beats;b++){const p=s.d[b];if(!Array.isArray(p)||p.length!==NP||!p.every(v=>typeof v==='number'&&isFinite(v))){d.length=0;break;}d.push(clampPose(p.slice()));}
      tr.demo=d;tr.beats=d.length;tr.wobble=typeof s.w==='number'&&isFinite(s.w)?Math.max(0.02,Math.min(0.5,s.w)):0.34;
      tr.shows=Math.max(0,s.s|0);tr.tries=Math.max(0,s.n|0);tr.best=typeof s.best==='number'&&isFinite(s.best)?Math.max(0,Math.min(1,s.best)):0;
    }
    return true;
  }
}
const WATCH_STEPS=6, WATCH_LR=0.006, TREAT_STEPS=3, POISON_STEPS=5;
// ===== END STUDIO CORE =====
