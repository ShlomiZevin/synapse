// Plays the free-training mode in a real browser: pose a routine, let the cell watch, try, remind, treat.
const {chromium}=require('playwright-core');
const out=__dirname+'/../shots/';require('fs').mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const p=await b.newPage({viewport:{width:1600,height:860}});
 const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push(m.text());});
 await p.goto('http://localhost:5190');await wait(1500);
 await p.screenshot({path:out+'st_title.png'});
 const F=()=>p.frames().find(f=>f!==p.mainFrame()&&f.url().length);
 await p.mouse.click(800,300);await wait(200);            // give the frame focus
 await F().evaluate(()=>{enterStudio();});await wait(600);
 await p.screenshot({path:out+'st_empty.png'});
 await p.keyboard.press('s');await wait(500);              // SHOW: start posing
 // drag the right hand up with the real mouse
 const h=await F().evaluate(()=>({x:sd.handles.handR.x*S,y:sd.handles.handR.y*S,cx:sd.handles.c.x*S,cy:sd.handles.c.y*S}));
 await p.mouse.move(h.x,h.y);await p.mouse.down();await p.mouse.move(h.x+70,h.y-150,{steps:8});await p.mouse.up();await wait(200);
 const armAfter=await F().evaluate(()=>[sd.edit[0][2],sd.edit[0][3]].map(v=>Math.round(v*100)/100));
 // the rest of a 4-beat routine, set directly (beat 1 keeps the dragged arm)
 await F().evaluate(()=>{const e=sd.edit;e[1][0]=0.9;e[1][1]=0.9;e[1][2]=0.9;e[1][3]=0.9;e[1][6]=0.6;e[1][10]=0.8;e[1][11]=0.5;
   e[2]=e[1].slice();e[2][12]=0.5;e[2][7]=0.6;e[2][5]=0.4;e[3]=restPose();e[3][4]=0.8;e[3][9]=0.5;e[3][11]=0.83;sd.beat=1;});
 await wait(300);await p.screenshot({path:out+'st_edit.png'});
 await p.keyboard.press('Enter');await wait(900);await p.screenshot({path:out+'st_watch.png'});
 await wait(2600);
 const log=[];
 const step=async(key,ms)=>{await p.keyboard.press(key);await wait(ms);};
 for(let round=0;round<6;round++){
   await step(' ',3200);                                    // TRY
   const r=await F().evaluate(()=>({mode:sd.mode,match:Math.round(sd.score*100),knows:Math.round(sd.S.knows(sd.cur)*100),wobble:Math.round(studioTrick().wobble*100)/100,shows:studioTrick().shows}));
   log.push(r);
   if(round===1)await p.screenshot({path:out+'st_judge.png'});
   if(round>=3)await step('g',500);                         // treats in the later rounds
   await step('r',3300);                                    // REMIND
 }
 await step(' ',1100);await p.screenshot({path:out+'st_perform.png'});await wait(2400);
 const last=await F().evaluate(()=>({match:Math.round(sd.score*100),knows:Math.round(sd.S.knows(sd.cur)*100),wobble:Math.round(studioTrick().wobble*100)/100}));
 console.log('arm after a real drag [angle, reach]:',JSON.stringify(armAfter));
 console.log('rounds:',log.map(r=>'match '+r.match+'% knows '+r.knows+'% wobble '+r.wobble+' shown '+r.shows).join(' | '));
 console.log('final:',JSON.stringify(last),errs);
 await p.keyboard.press('Escape');await wait(400);await p.screenshot({path:out+'st_menu.png'});
 await b.close();
})();
