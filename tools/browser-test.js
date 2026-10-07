// Looks at the game in a real browser and plays lesson 1 the way the hint line tells a player to
const {chromium}=require('playwright-core');
const out=__dirname+'/../shots/';require('fs').mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SECS=+process.argv[2]||55;
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const p=await b.newPage({viewport:{width:1280,height:720}});
 const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push(m.text());});
 await p.goto('http://localhost:5190');await wait(1500);
 await p.screenshot({path:out+'a_title.png'});
 await p.mouse.click(640,425);await wait(900);
 const F=()=>p.frames().find(f=>f!==p.mainFrame()&&f.url().length);
 if(await F().evaluate(()=>__synapse.st.screen)!=='play'){await p.mouse.click(640,452);await wait(600);}
 await p.screenshot({path:out+'b_start.png'});
 await p.keyboard.press('1');await wait(900);await p.screenshot({path:out+'c_signal.png'});
 await wait(1500);await p.screenshot({path:out+'d_move.png'});
 // stay at x1: measure the real pace
 // follow the game's own hint: shine the signal, then treat if right / poison if wrong
 await F().evaluate(()=>{const s=__synapse,st=s.st;
   window.__trainer=setInterval(()=>{if(st.test||st.result||st.paused)return;const pup=st.pup;
     if(pup.phase==='idle'&&pup.idleT>0.4){s.giveSignal(st.cur);pup.__r=false;return;}
     if(pup.phase==='move'&&pup.windowOpen&&pup.moveT>0.8&&!pup.__r){pup.__r=true;
       if(pup.move===TARGET[st.cur]){if(Math.random()<0.85)s.reward('treat');}else if(Math.random()<0.6)s.reward('poison');}
   },80);});
 await wait(SECS*1000);
 await p.screenshot({path:out+'e_trained.png'});
 console.log(JSON.stringify(await F().evaluate(()=>({taught:__synapse.st.taught,series:__synapse.st.series.map(v=>Math.round(v*100))}))));
 await F().evaluate(()=>{clearInterval(window.__trainer);});
 await wait(4000);await p.keyboard.press('t');await wait(6000);await p.screenshot({path:out+'f_test.png'});
 await wait(24000);await p.screenshot({path:out+'g_result.png'});
 console.log(JSON.stringify(await F().evaluate(()=>__synapse.st.result)),errs);
 await b.close();
})();
