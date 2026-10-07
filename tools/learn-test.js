// Headless proof for the pup: one decision per hand signal, a human-like teacher (praise / treat / no), lessons one at a time with review.
const fs=require('fs'),path=require('path');
let src=fs.readFileSync(path.join(__dirname,'..','src','core.js'),'utf8');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?+process.argv[i+1]:d;};
if(arg('roll',0))src=src.replace(/ROLL=\d+/,'ROLL='+arg('roll'));
if(arg('ent',-1)>=0)src=src.replace('0.01*(-this.p[k]',arg('ent')+'*(-this.p[k]');
if(arg('eps',-1)>=0)src=src.replace(/EPS=[0-9.]+/,'EPS='+arg('eps'));
if(arg('w1',0))src=src.replace('const s=init?0.5:0.2;','const s=init?'+arg('w1')+':0.2;');
const C=new Function(src+';return{Brain,mulberry,cueVec,NIN,NCUE,NMOVE,TARGET,movesFor};')();
const lr={a:arg('lr',0.05),v:arg('lv',0.5)},PG=arg('pg',0.85),PB=arg('pb',0.6),NB=arg('brains',10),TREAT=arg('treat',0.3);
const xv=new Float64Array(C.NIN);
// the human: right move -> clicker (+1) or treat (+1.6), wrong move -> "no" (-0.7) sometimes, or just nothing
function teacherReward(cue,move,rng){
  if(move===C.TARGET[cue]){if(rng()<TREAT)return arg('pos',1.2);return rng()<PG?arg('pos',1.2):0;}
  return rng()<PB?-arg('neg',0.7):0;
}
function accuracy(b,cues,temp=0.25,n=20){const bb=b.clone(3);bb.mask=b.mask;let ok=0,tot=0;
  for(const c of cues)for(let i=0;i<n;i++){bb.forward(C.cueVec(c,xv),temp);let u=Math.random(),a=0,cum=0;for(let k=0;k<C.NMOVE;k++){cum+=bb.p[k];if(u<=cum){a=k;break;}a=k;}ok+=a===C.TARGET[c]?1:0;tot++;}
  return ok/tot;}
const res=[];let allDone=0,tot=0,cnt=0;
for(let bi=0;bi<NB;bi++){
  const b=new C.Brain(C.mulberry(100+bi),arg('H',27)),rng=C.mulberry(7+bi),per=[];let ok=true;
  for(let lv=0;lv<C.NCUE;lv++){
    if(!process.argv.includes("--nomask"))b.mask=C.movesFor(lv+1);
    let n=0,passed=false;
    while(n<150){
      const c=(lv>0&&rng()<0.3)?(rng()*lv)|0:lv;      // 30% review of older signals
      const x=C.cueVec(c,xv);const a=b.choose(x,true,1);b.close(teacherReward(c,a,rng),lr);n++;
      if(n%2===0){const cur=accuracy(b,[lv]),old=lv?accuracy(b,[...Array(lv).keys()]):1;if(cur>=0.85&&old>=0.75){passed=true;break;}}
    }
    per.push(passed?n:'FAIL');if(passed){tot+=n;cnt++;}if(!passed){ok=false;break;}
  }
  console.log('brain'+bi+' signals taught per lesson: '+per.join(' '));if(ok)allDone++;
}
console.log('brains that learned all 8 signals:',allDone+'/'+NB+'  avg decisions per lesson: '+(tot/Math.max(1,cnt)).toFixed(0));
