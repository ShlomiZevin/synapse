// ===== CORE (no DOM): the pup, its moves, the hand signals and its real neural network =====
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gauss(rng){let u=0,v=0;while(!u)u=rng();v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*v);}
const WW=800, WH=520, MAXH=36;
// hand signals the pup can see, and the moves it is born with
const CUES=['clap','beckon','palmup','palmdown','circle','handup','pointleft','pointright'];
const MOVES=['stand','sit','down','spin','jump','come','look','left','right','wander'];
const NCUE=CUES.length, NMOVE=MOVES.length, NIN=NCUE+1;   // 8 signals + "no signal"
// which move each signal is meant to teach (lesson order = this order)
const TARGET=[6,5,1,2,3,4,7,8];
const EPS=0.12, ROLL=2, ADAM_B1=0.9, ADAM_B2=0.999;
const HOLD=2.0, REST=1.2, CUE_T=1.3, DECIDE_AT=0.45, OFFER_AFTER=8, AFTER_REWARD=0.7;

class Brain{
  constructor(rng,H0){
    this.rng=rng; this.nIn=NIN; this.nOut=NMOVE; this.H=0;
    this.x=new Float64Array(NIN); this.logit=new Float64Array(NMOVE); this.p=new Float64Array(NMOVE).fill(1/NMOVE); this.V=0; this.h=new Float64Array(MAXH);
    this.alloc(H0||27,true);
    this.buf=[]; this.delta=0; this.blame=new Float64Array(MAXH); this.steps=0; this.updates=0; this.choice=0;
  }
  alloc(H,init){
    const n=this.nIn,O=this.nOut,old=this.H,rng=this.rng;
    const grow=(a,len)=>{const b=new Float64Array(len);if(a)b.set(a.subarray(0,Math.min(a.length,len)));return b;};
    const cpO=(a)=>{const b=new Float64Array(O*H);if(a){for(let k=0;k<O;k++)for(let j=0;j<old;j++)b[k*H+j]=a[k*old+j];}return b;};
    const sizes={W1:H*n,b1:H,W2:O*H,b2:O,w3:H,b3:1};
    const P={W1:grow(this.W1,H*n),b1:grow(this.b1,H),w3:grow(this.w3,H),W2:cpO(this.W2),b2:this.b2||new Float64Array(O),b3:this.b3||new Float64Array(1)};
    for(let j=old;j<H;j++){
      // receptive fields: each hidden neuron starts out listening mostly to one signal
      const own=j%n;
      for(let i=0;i<n;i++)P.W1[j*n+i]=(init?(i===own?1.6+gauss(rng)*0.15:0):gauss(rng)*0.1);
      P.b1[j]=0;P.w3[j]=gauss(rng)*0.05;
      for(let k=0;k<O;k++)P.W2[k*H+j]=gauss(rng)*(init?0.3:0.1);
    }
    const M={},Vv={};
    for(const k in P){const m0=this['m_'+k],v0=this['v_'+k];
      if(k==='W2'){M[k]=cpO(m0);Vv[k]=cpO(v0);}else{M[k]=grow(m0,sizes[k]);Vv[k]=grow(v0,sizes[k]);}}
    for(const k in P){this[k]=P[k];this['m_'+k]=M[k];this['v_'+k]=Vv[k];}
    this.H=H;this.adamT=this.adamT||0;
  }
  forward(x,temp){
    const n=this.nIn,H=this.H,O=this.nOut,h=this.h,T=temp||1;
    for(let j=0;j<H;j++){let s=this.b1[j];const o=j*n;for(let i=0;i<n;i++)s+=this.W1[o+i]*x[i];h[j]=Math.tanh(s);}
    let mx=-1e9;
    for(let k=0;k<O;k++){let s=this.b2[k];for(let j=0;j<H;j++)s+=this.W2[k*H+j]*h[j];this.logit[k]=s;if(s>mx)mx=s;}
    const mk=this.mask;if(mk){mx=-1e9;for(let k=0;k<O;k++)if(mk[k]&&this.logit[k]>mx)mx=this.logit[k];}
    let z=0;for(let k=0;k<O;k++){this.p[k]=(mk&&!mk[k])?0:Math.exp((this.logit[k]-mx)/T);z+=this.p[k];}
    for(let k=0;k<O;k++)this.p[k]/=z;
    let v=this.b3[0];for(let j=0;j<H;j++)v+=this.w3[j]*h[j];this.V=v;
  }
  // learn from the stored decisions (each already holds the reward it earned)
  learn(lr){
    const buf=this.buf,N=buf.length,n=this.nIn,H=this.H,O=this.nOut; if(!N)return;
    const gW1=new Float64Array(H*n),gb1=new Float64Array(H),gW2=new Float64Array(O*H),gb2=new Float64Array(O),gw3=new Float64Array(H),gb3=new Float64Array(1);
    let advSum=0;const dp=new Float64Array(O);
    for(let t=0;t<N;t++){
      const e=buf[t];this.forward(e.x);
      const A=Math.max(-2,Math.min(2,e.r-this.V));advSum+=A;
      for(let k=0;k<O;k++)dp[k]=A*((k===e.a?1:0)-this.p[k])+0.1*(-this.p[k]*(Math.log(this.p[k]+1e-9)+1));
      const cv=lr.v*(e.r-this.V);
      for(let j=0;j<H;j++){
        const hj=this.h[j];let gh=0;
        for(let k=0;k<O;k++){gW2[k*H+j]+=dp[k]*hj;gh+=dp[k]*this.W2[k*H+j];}
        gw3[j]+=cv*hj;
        const hd=1-hj*hj,gp=(gh+cv*this.w3[j])*hd,o=j*n;
        gb1[j]+=gp;this.blame[j]=this.blame[j]*0.8+Math.abs(gp)*0.2;
        for(let i=0;i<n;i++){const xi=e.x[i];if(xi!==0)gW1[o+i]+=gp*xi;}
      }
      for(let k=0;k<O;k++)gb2[k]+=dp[k];gb3[0]+=cv;
    }
    const grads={W1:gW1,b1:gb1,W2:gW2,b2:gb2,w3:gw3,b3:gb3};
    let nrm=0;for(const k in grads){const a=grads[k];for(let i=0;i<a.length;i++){a[i]/=N;nrm+=a[i]*a[i];}}
    nrm=Math.sqrt(nrm);const sc=nrm>4?4/nrm:1;
    // plain gradient steps: a bigger reward (a treat) teaches more than a click
    for(const k in grads){if(k==='b2'||k==='b1')continue;const p=this[k],gg=grads[k];
      for(let i=0;i<p.length;i++){p[i]+=lr.a*gg[i]*sc;if(p[i]>8)p[i]=8;else if(p[i]<-8)p[i]=-8;}}
    this.delta=advSum/N;this.updates++;this.buf.length=0;
  }
  // choose a move for a signal (x). With learn=true the decision is remembered until close() gives it a reward.
  choose(x,learn,temp){
    this.x.set(x);this.forward(this.x,temp);
    let u=this.rng(),a=0,c=0;for(let k=0;k<this.nOut;k++){c+=this.p[k];if(u<=c){a=k;break;}a=k;}
    if(learn&&this.rng()<EPS){let q=(this.rng()*this.nOut)|0,g=0;while(this.mask&&!this.mask[q]&&g++<40)q=(this.rng()*this.nOut)|0;a=q;}   // curiosity: sometimes it just tries something
    if(learn)this.pending={x:Float64Array.from(this.x),a:a,r:0};
    this.steps++;this.choice=a;return a;
  }
  // the reward window of the last decision has closed: learn from it
  close(r,lr){
    if(!this.pending)return;
    this.pending.r=r;this.buf.push(this.pending);this.pending=null;
    if(this.buf.length>=ROLL)this.learn(lr);
  }
  clone(seed){
    const b=new Brain(mulberry(seed||7),this.H);
    for(const k of ['W1','b1','w3','W2','b2','b3'])b[k]=this[k].slice();
    return b;
  }
  export(){ const o={H:this.H}; for(const k of ['W1','b1','w3','W2','b2'])o[k]=Array.from(this[k],v=>Math.round(v*1e4)/1e4); o.b3=this.b3[0]; return o; }
  static fromData(o,rng){
    if(!o||typeof o!=='object')return null;
    const H=o.H|0; if(H<1||H>MAXH)return null;
    const ok=(a,len)=>Array.isArray(a)&&a.length===len&&a.every(v=>typeof v==='number'&&isFinite(v)&&Math.abs(v)<50);
    if(!(ok(o.W1,H*NIN)&&ok(o.b1,H)&&ok(o.w3,H)&&ok(o.W2,NMOVE*H)&&ok(o.b2,NMOVE)&&typeof o.b3==='number'&&isFinite(o.b3)))return null;
    const b=new Brain(rng,H);
    b.W1.set(o.W1);b.b1.set(o.b1);b.w3.set(o.w3);b.W2.set(o.W2);b.b2.set(o.b2);b.b3[0]=o.b3; return b;
  }
}
// the moves the creature can do so far: float, wander, and the move of every signal it has met
function movesFor(unlocked){const m=new Uint8Array(NMOVE);m[0]=1;m[9]=1;for(let i=0;i<unlocked&&i<NCUE;i++)m[TARGET[i]]=1;return m;}
function cueVec(c,x){x.fill(0);if(c>=0&&c<NCUE)x[c]=1;else x[NCUE]=1;return x;}

// ---- the pup in its room: a slow, readable cycle: signal -> perk ears -> ONE move held ~3 s -> rest (reward window) ----
class Pup{
  constructor(seed){
    this.rng=mulberry(seed||1);
    this.x=WW*0.5;this.y=WH*0.46;this.face=0;this.move=0;this.moveT=0;this.walk=0;this.t=0;
    this.phase='idle';this.phT=0;this.cue=-1;this.decided=false;this.reward=0;this.events=[];
    this.idleT=0;this.jumpT=0;this.spin=0;this.lastMove=0;this.cueForMove=-1;this.windowOpen=false;this.moveGoal={x:this.x,y:this.y};
    this.praiseT=0;this.noT=0;this.eatT=0;this.listen=0;this.xv=new Float64Array(NIN);
    this.homeX=WW*0.5;this.homeY=WH*0.46;
  }
  canCue(){return this.phase==='idle'||this.phase==='rest'||(this.phase==='move'&&this.moveT>0.35);}
  giveCue(c,brain,learn,lr){
    if(!this.canCue())return false;
    this.closeWindow(brain,learn,lr);
    this.phase='cue';this.phT=0;this.cue=c;this.decided=false;this.idleT=0;this.listen=1;
    this.events.push({t:'cue',c});return true;
  }
  closeWindow(brain,learn,lr){
    if(this.windowOpen){
      this.windowOpen=false;if(brain&&learn)brain.close(this.reward,lr);
      this.events.push({t:'closed',r:this.reward,move:this.lastMove,cue:this.cueForMove});this.reward=0;
    }
  }
  addReward(v,kind){
    this.reward+=v;
    // you have answered: wrap this try up quickly so the next signal can come
    if(this.windowOpen){if(this.phase==='move'){this.phase='rest';this.phT=0;this.events.push({t:'rest'});}this.endAt=this.t+AFTER_REWARD;}
    if(kind==='praise')this.praiseT=1.5;else if(kind==='no')this.noT=1.5;else if(kind==='treat'){this.praiseT=1.5;this.eatT=1.3;}
    this.events.push({t:kind});
  }
  decide(brain,learn,temp,cueId){
    const x=cueVec(cueId,this.xv);
    const m=brain?brain.choose(x,learn,temp):0;
    this.move=m;this.lastMove=m;this.cueForMove=cueId;this.moveT=0;this.reward=0;this.windowOpen=true;this.decided=true;this.walk=0;this.endAt=0;
    if(m===4){this.jumpT=0.8;this.events.push({t:'jump'});}
    if(m===3){this.spin=0;this.events.push({t:'spin'});}
    const R=this.rng;
    if(m===5)this.moveGoal={x:WW*0.5+(R()-0.5)*60,y:WH*0.68};
    else if(m===7)this.moveGoal={x:WW*0.14,y:this.y};
    else if(m===8)this.moveGoal={x:WW*0.86,y:this.y};
    else if(m===9)this.moveGoal={x:Math.max(90,Math.min(WW-90,this.x+(R()-0.5)*300)),y:Math.max(WH*0.35,Math.min(WH*0.75,this.y+(R()-0.5)*140))};
    else this.moveGoal={x:this.x,y:this.y};
    this.events.push({t:'move',m});
  }
  step(dt,brain,learn,temp,lr){
    this.t+=dt;this.phT+=dt;
    if(this.praiseT>0)this.praiseT-=dt;if(this.noT>0)this.noT-=dt;if(this.eatT>0)this.eatT-=dt;if(this.jumpT>0)this.jumpT-=dt;
    if(this.listen>0)this.listen-=dt*0.35;
    if(this.phase==='idle'){
      this.idleT+=dt;this.goHome(dt);
    }else if(this.phase==='cue'){
      this.walk*=0.9;this.face=0;
      if(!this.decided&&this.phT>=DECIDE_AT){this.decide(brain,learn,temp,this.cue);this.phase='move';this.phT=0;}
    }
    if(this.phase==='move'){
      this.moveT+=dt;this.runMove(dt,false);
      if(this.phT>=HOLD){this.phase='rest';this.phT=0;this.events.push({t:'rest'});}
    }else if(this.phase==='rest'){
      this.runMove(dt,true);
      if(this.phT>=REST||(this.endAt&&this.t>=this.endAt)){this.endAt=0;this.closeWindow(brain,learn,lr);this.phase='idle';this.phT=0;this.idleT=0;this.events.push({t:'idle'});}
    }
  }
  goHome(dt){
    const dx=this.homeX-this.x,dy=this.homeY-this.y,d=Math.hypot(dx,dy);
    if(d>12){const v=Math.min(90,d*2);this.x+=dx/d*v*dt;this.y+=dy/d*v*dt;this.walk=Math.min(1,this.walk+dt*4);
      this.face=Math.abs(dx)>Math.abs(dy)*0.8?(dx>0?1:-1):0;}
    else{this.walk*=0.85;this.face=0;}
  }
  runMove(dt,rest){
    const m=this.move;
    if(m===3){if(!rest)this.spin+=dt*7.2;this.walk=0;return;}
    if(m===5||m===7||m===8||m===9){
      if(rest){this.walk*=0.85;if(m===5)this.face=0;return;}
      const g=this.moveGoal,dx=g.x-this.x,dy=g.y-this.y,d=Math.hypot(dx,dy);
      if(d>14){const v=m===5?118:105;this.x+=dx/d*Math.min(v,d*3)*dt;this.y+=dy/d*Math.min(v,d*3)*dt;this.walk=Math.min(1,this.walk+dt*5);
        this.face=m===5?0:(Math.abs(dx)>Math.abs(dy)?(dx>0?1:-1):0);}
      else{this.walk*=0.8;if(m===5)this.face=0;}
      return;
    }
    this.walk*=0.8;if(m===6)this.face=0;
  }
}
// ===== END CORE =====
