const fs=require('fs'),p=require('path');const d=p.join(__dirname,'..');
const rd=f=>fs.readFileSync(p.join(d,'src',f),'utf8');
const core=rd('core.js')+'\n'+rd('studio-core.js'),game=rd('game.js')+'\n'+rd('studio.js');
const html=rd('template.html').replace('/*CORE*/',()=>core).replace('/*GAME*/',()=>game);
fs.writeFileSync(p.join(d,'game.html'),html);console.log('game.html',html.length,'bytes');
