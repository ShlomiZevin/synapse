// Headless proof for the free-training mode:
//  1. the cell gets better a bit at a time as you show a routine again and again (not all at once)
//  2. treats make it steadier
//  3. learning a new routine does not wipe the old ones
const fs=require('fs'),path=require('path');
const core=fs.readFileSync(path.join(__dirname,'..','src','core.js'),'utf8');
let sc=fs.readFileSync(path.join(__dirname,'..','src','studio-core.js'),'utf8');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?+process.argv[i+1]:d;};
if(arg('steps',0))sc=sc.replace(/WATCH_STEPS=\d+/,'WATCH_STEPS='+arg('steps'));
if(arg('lr',0))sc=sc.replace(/WATCH_LR=[0-9.]+/,'WATCH_LR='+arg('lr'));
if(arg('rw',0))sc=sc.replace('t===focus?1:0.45','t===focus?1:'+arg('rw'));
const C=new Function(core+'\n'+sc+';return{Studio,PARTS,NP,NTRICK,NBEAT,restPose,mulberry};')();
const pct=v=>Math.round(v*100);
function randomRoutine(rng,beats){const r=[];for(let b=0;b<beats;b++)r.push(C.PARTS.map(p=>p.lo+rng()*(p.hi-p.lo)));return r;}
const runs=arg('runs',5);let needShows=[],keep=[],afterTreat=[];
for(let run=0;run<runs;run++){
  const st=new C.Studio(100+run),rng=C.mulberry(7+run);
  // trick 0: a 4-beat routine, shown again and again
  st.setDemo(0,randomRoutine(rng,4));
  const curve=[pct(st.knows(0))];let need=-1;
  for(let s=1;s<=14;s++){st.watch(0);const k=st.knows(0);curve.push(pct(k));if(k>=0.9&&need<0)need=s;}
  needShows.push(need);
  // wobble: before and after five treats
  const tryAvg=()=>{let a=0;for(let i=0;i<20;i++)a+=st.score(0,st.attempt(0));return a/20;};
  const before=tryAvg();for(let i=0;i<5;i++)st.treat(0);const after=tryAvg();afterTreat.push([pct(before),pct(after)]);
  // now teach five more routines, 8 shows each, and see what is left of the first
  const k0=st.knows(0);
  for(let t=1;t<C.NTRICK;t++){st.setDemo(t,randomRoutine(rng,2+((t*3)%7)));for(let s=0;s<8;s++)st.watch(t);}
  const all=[];for(let t=0;t<C.NTRICK;t++)all.push(pct(st.knows(t)));
  keep.push([pct(k0),all[0]]);
  console.log('run'+run+'  knows trick after each show: '+curve.join(' ')+'   (>=90% after '+need+' shows)');
  console.log('      a try scores '+pct(before)+'% before treats, '+pct(after)+'% after 5 treats;  first trick '+pct(k0)+'% -> '+all[0]+'% after learning 5 more;  all six: '+all.join(' '));
}
console.log('SUMMARY shows needed: '+needShows.join(' ')+' | try before/after treats: '+afterTreat.map(a=>a.join('->')).join(' ')+' | first trick kept: '+keep.map(a=>a.join('->')).join(' '));
