const fs=require('fs'),p=require('path');const d=p.join(__dirname,'..');
const core=fs.readFileSync(p.join(d,'src/core.js'),'utf8'),game=fs.readFileSync(p.join(d,'src/game.js'),'utf8');
const html=fs.readFileSync(p.join(d,'src/template.html'),'utf8').replace('/*CORE*/',()=>core).replace('/*GAME*/',()=>game);
fs.writeFileSync(p.join(d,'game.html'),html);console.log('game.html',html.length,'bytes');
