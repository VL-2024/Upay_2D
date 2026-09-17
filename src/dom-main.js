import { CONFIG } from './config.js';
import { ScenarioEngine, SCENARIOS } from './scenario-engine.js';

const host = document.getElementById('pixiHost');
const scenario = new ScenarioEngine();
const chukoFiles = [
  './assets/chuko/chuko_01.webp',
  './assets/chuko/chuko_02.webp',
  './assets/chuko/chuko_03.webp',
  './assets/chuko/chuko_04.webp',
  './assets/chuko/chuko_05.webp',
];
const khanFiles = [
  './assets/khan/khan_01.webp',
  './assets/khan/khan_02.webp',
  './assets/khan/khan_03.webp',
];

const state = {
  denomination: CONFIG.defaultDenomination,
  denominations: [...CONFIG.denominations],
  currency: CONFIG.currency,
  pieces: [],
  slots: Array(CONFIG.zones.totalSlots).fill(null),
  selectedSourceId: null,
  phase: 'idle',
  demoHasStarted: false,
  externalScenarioCode: null,
  lastObjective: '',
};

injectStyles();
setupUI();
startNewGame();

function injectStyles(){
  const style = document.createElement('style');
  style.textContent = `
    #pixiHost{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}
    .game-piece{position:absolute;transform:translate(-50%,-50%);transform-origin:center;object-fit:contain;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-drag:none;filter:drop-shadow(0 7px 5px rgba(0,0,0,.23));transition:filter .15s ease,opacity .15s ease}
    .game-piece.normal{width:12.5%}
    .game-piece.khan{width:13.8%;z-index:25}
    .game-piece.selected{filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 12px #55c7ff) drop-shadow(0 7px 5px rgba(0,0,0,.23))}
    .game-piece.khan.active{filter:drop-shadow(0 0 8px #ffd36a) drop-shadow(0 0 22px #ffae32) drop-shadow(0 7px 5px rgba(0,0,0,.23))}
    .impact-burst{position:fixed;width:14px;height:14px;border:3px solid rgba(255,255,255,.95);border-radius:50%;z-index:9998;pointer-events:none;transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(240,198,108,.42),0 0 18px rgba(255,255,255,.9)}
    .impact-burst i{position:absolute;left:50%;top:50%;width:3px;height:22px;border-radius:3px;background:linear-gradient(#fff,#f0c66c);transform-origin:50% 0}
  `;
  document.head.appendChild(style);
}

function setupUI(){
  ensureSlots('zone1',0);
  ensureSlots('zone2',3);
  renderStakeMenu();
  syncStakeUI();

  document.getElementById('stakeSelect').addEventListener('click', e=>{
    e.stopPropagation();
    if(!selectorInteractive()) return;
    const menu=document.getElementById('stakeMenu');
    menu.hidden=!menu.hidden;
    document.getElementById('stakeSelect').setAttribute('aria-expanded',String(!menu.hidden));
  });
  document.getElementById('stakeMenu').addEventListener('click',e=>{
    const option=e.target.closest('.stake-option');
    if(!option || !selectorInteractive()) return;
    selectDenomination(Number(option.dataset.value));
  });
  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.status-panel')) closeStakeMenu();
  });
  document.getElementById('newGameBtn').addEventListener('click',startNewGame);
}

function ensureSlots(zoneId,startIndex){
  const zone=document.getElementById(zoneId);
  zone.innerHTML='';
  for(let i=0;i<3;i++){
    const slot=document.createElement('div');
    slot.className='slot';
    slot.dataset.slotIndex=String(startIndex+i);
    zone.appendChild(slot);
  }
}

function selectorInteractive(){ return state.phase==='idle' || state.phase==='settled'; }

function selectDenomination(n){
  if(!selectorInteractive() || !state.denominations.includes(n)) return;
  state.denomination=n;
  syncStakeUI();
  closeStakeMenu();
}

function renderStakeMenu(){
  document.getElementById('stakeMenu').innerHTML=state.denominations.map(v=>
    `<button type="button" class="stake-option${v===state.denomination?' selected':''}" data-value="${v}">${v} ${state.currency}</button>`
  ).join('');
}

function syncStakeUI(){
  document.getElementById('stakeValue').textContent=state.denomination;
  document.getElementById('currencyValue').textContent=state.currency;
  document.getElementById('betLabel').textContent=`${state.denomination} ${state.currency}`;
  renderStakeMenu();
  syncSelectorLock();
}

function syncSelectorLock(){
  const locked=!selectorInteractive();
  document.getElementById('stakeSelect').classList.toggle('locked',locked);
  if(locked) closeStakeMenu();
}

function closeStakeMenu(){
  const menu=document.getElementById('stakeMenu');
  menu.hidden=true;
  document.getElementById('stakeSelect').setAttribute('aria-expanded','false');
}

function startNewGame(){
  closeStakeMenu();
  state.phase='idle';
  state.selectedSourceId=null;
  state.slots=Array(6).fill(null);

  const demoMode=document.getElementById('demoToggle').checked;
  if(state.externalScenarioCode){
    scenario.setScenario(state.externalScenarioCode);
  } else if(demoMode){
    scenario.reset({advanceDemo:state.demoHasStarted});
    state.demoHasStarted=true;
  } else {
    state.demoHasStarted=false;
    scenario.setScenario(SCENARIOS.TWO);
  }

  resetSlotDom();
  buildPieces();
  renderPieces();
  updateProgress();
  setObjectiveFromScenario();
  syncSelectorLock();
}

function buildPieces(){
  state.pieces=[];
  const layouts=makeScatterLayout();
  for(let i=0;i<15;i++){
    const pos=layouts[i];
    state.pieces.push({
      id:`C${i+1}`,
      type:'normal',
      src:chukoFiles[i%chukoFiles.length],
      x:pos.x,
      y:pos.y,
      rotation:(Math.random()-.5)*52,
      spawnDx:-150-Math.random()*190,
      spawnDy:-35+Math.random()*100,
      collected:false,
      el:null,
    });
  }
  state.pieces.push({
    id:'KHAN',type:'khan',src:khanFiles[Math.floor(Math.random()*khanFiles.length)],
    x:50,y:45.2,rotation:(Math.random()-.5)*12,spawnDx:-80,spawnDy:30,collected:false,el:null,
  });
}

function makeScatterLayout(){
  const cx=50, cy=45.2;
  const rings=[
    {count:5,rx:10.5,ry:4.7,offset:-78},
    {count:5,rx:18.5,ry:8.3,offset:-44},
    {count:5,rx:27.0,ry:11.6,offset:-12},
  ];
  const out=[];
  for(const ring of rings){
    for(let i=0;i<ring.count;i++){
      const deg=ring.offset+(360/ring.count)*i+(Math.random()-.5)*18;
      const a=deg*Math.PI/180;
      out.push({
        x:cx+Math.cos(a)*ring.rx+(Math.random()-.5)*1.6,
        y:cy+Math.sin(a)*ring.ry+(Math.random()-.5)*1.3,
      });
    }
  }
  return out;
}

function renderPieces(){
  host.innerHTML='';
  state.pieces.forEach((p,index)=>{
    if(p.collected) return;
    const img=document.createElement('img');
    img.src=p.src;
    img.alt=p.type==='khan'?'Хан':'Чуко';
    img.draggable=false;
    img.className=`game-piece ${p.type}`;
    img.style.left=`${p.x}%`;
    img.style.top=`${p.y}%`;
    img.style.transform=`translate(-50%,-50%) rotate(${p.rotation}deg)`;
    img.addEventListener('click',()=>onPieceTap(p));
    p.el=img;
    host.appendChild(img);
    animateScatterIn(p,index);
  });
  refreshPieceVisuals();
}

function animateScatterIn(piece,index){
  const el=piece.el;
  if(!el) return;
  const base=`translate(-50%,-50%) rotate(${piece.rotation}deg)`;
  const spin=piece.rotation+(Math.random()-.5)*65;
  el.animate([
    {opacity:0,transform:`translate(-50%,-50%) translate(${piece.spawnDx}px,${piece.spawnDy}px) rotate(${spin}deg) scale(.25)`},
    {opacity:1,offset:.72,transform:`translate(-50%,-50%) translate(8px,-12px) rotate(${piece.rotation+8}deg) scale(1.05)`},
    {opacity:1,transform:base}
  ],{duration:440+Math.random()*140,delay:index*18,easing:'cubic-bezier(.18,.78,.2,1)',fill:'both'});
}

function onPieceTap(piece){
  if(piece.collected || state.phase==='animating' || state.phase==='settled') return;
  const snap=scenario.snapshot();
  if(piece.type==='khan') return onKhanTap(piece,snap);
  if(snap.khanActive){
    flashObjective('ХАН активирован — нажми на Хана');
    pulse(getKhanPiece()?.el,1.14);
    return;
  }

  const source=getSelectedSource();
  if(!source){
    state.selectedSourceId=piece.id;
    state.phase='aiming';
    pulse(piece.el,1.08);
    setObjective(snap.failedStrikeRequired?'Последний удар — попробуй выбить ещё один чуко':'Теперь выбери чуко-цель');
    refreshPieceVisuals();
    return;
  }

  if(source.id===piece.id){
    state.selectedSourceId=null;
    state.phase='idle';
    setObjectiveFromScenario();
    refreshPieceVisuals();
    return;
  }
  strikeTarget(source,piece,snap);
}

function onKhanTap(piece,snap){
  if(!snap.khanActive){
    flashObjective(snap.khanRequired?'Сначала собери нужные чуко':'В этом сценарии Хан не используется');
    pulse(piece.el,1.12);
    return;
  }
  scenario.registerKhanHit();
  state.phase='settled';
  state.selectedSourceId=null;
  setObjective(scenario.resultText());
  piece.el?.classList.add('active');
  celebrateKhan(piece.el);
  syncSelectorLock();
  refreshPieceVisuals();
}

function strikeTarget(source,target,snap){
  state.phase='animating';
  syncSelectorLock();
  state.selectedSourceId=null;
  refreshPieceVisuals();

  const failed=snap.failedStrikeRequired;
  if(!failed && !scenario.canCollectNormal()){
    state.phase='idle';
    setObjectiveFromScenario();
    syncSelectorLock();
    return;
  }

  const nextSlot=failed?-1:state.slots.findIndex(v=>v===null);
  if(!failed && nextSlot<0){
    state.phase='idle';
    syncSelectorLock();
    return;
  }

  if(!failed){
    target.collected=true;
    state.slots[nextSlot]={id:target.id,type:target.type,src:target.src};
    scenario.registerCollection();
  }

  animateStrike(source,target,()=>{
    if(failed){
      animateFailedStrike(target,()=>{
        scenario.registerFailedStrike();
        state.phase='settled';
        setObjective(scenario.resultText());
        syncSelectorLock();
      });
      return;
    }

    flyToSlot(target,nextSlot,()=>{
      updateSlotDom(nextSlot,target.src);
      updateProgress();
      const after=scenario.snapshot();
      if(after.finished){
        state.phase='settled';
        setObjective(scenario.resultText());
      } else if(after.khanActive){
        state.phase='idle';
        setObjective('ХАН активирован! Нажми на Хана');
        getKhanPiece()?.el?.classList.add('active');
        pulse(getKhanPiece()?.el,1.15);
      } else if(after.failedStrikeRequired){
        state.phase='idle';
        setObjective('Последний удар — попробуй выбить ещё один чуко');
      } else {
        state.phase='idle';
        setObjectiveFromScenario();
      }
      syncSelectorLock();
    });
  });
}

function animateStrike(source,target,onDone){
  const sourceEl=source.el, targetEl=target.el;
  if(!sourceEl || !targetEl){ onDone?.(); return; }
  const a=sourceEl.getBoundingClientRect();
  const b=targetEl.getBoundingClientRect();
  const dx=(b.left+b.width/2)-(a.left+a.width/2);
  const dy=(b.top+b.height/2)-(a.top+a.height/2);
  const d=Math.max(1,Math.hypot(dx,dy));
  const ux=dx/d, uy=dy/d;
  const base=sourceEl.style.transform;
  const back=14;
  const forward=Math.min(36,d*.22);
  const duration=360;

  const anim=sourceEl.animate([
    {offset:0,transform:base},
    {offset:.22,transform:`${base} translate(${-ux*back}px,${-uy*back}px) rotate(-8deg) scale(1.03)`},
    {offset:.56,transform:`${base} translate(${ux*forward}px,${uy*forward}px) rotate(11deg) scale(1.08)`},
    {offset:1,transform:base}
  ],{duration,easing:'cubic-bezier(.2,.72,.18,1)'});

  setTimeout(()=>{
    createImpactBurst(b.left+b.width/2,b.top+b.height/2);
    nudgeNearbyPieces(target,source);
    kickTarget(targetEl,ux,uy);
  },duration*.52);

  anim.finished.then(()=>onDone?.()).catch(()=>onDone?.());
}

function kickTarget(el,ux,uy){
  if(!el) return;
  const base=el.style.transform;
  el.animate([
    {transform:base},
    {transform:`${base} translate(${ux*18}px,${uy*12-8}px) rotate(14deg) scale(1.05)`},
    {transform:base}
  ],{duration:220,easing:'ease-out'});
}

function nudgeNearbyPieces(target,source){
  if(!target.el) return;
  const tr=target.el.getBoundingClientRect();
  const tx=tr.left+tr.width/2, ty=tr.top+tr.height/2;
  for(const p of state.pieces){
    if(!p.el || p.collected || p.id===target.id || p.id===source.id) continue;
    const r=p.el.getBoundingClientRect();
    const px=r.left+r.width/2, py=r.top+r.height/2;
    const dx=px-tx, dy=py-ty;
    const d=Math.hypot(dx,dy);
    if(d>170 || d<1) continue;
    const amp=5+(1-d/170)*12;
    const nx=dx/d, ny=dy/d;
    const base=p.el.style.transform;
    p.el.animate([
      {transform:base},
      {transform:`${base} translate(${nx*amp}px,${ny*amp*.7}px) rotate(${nx*5}deg)`},
      {transform:base}
    ],{duration:300,easing:'ease-out'});
  }
}

function createImpactBurst(x,y){
  const burst=document.createElement('span');
  burst.className='impact-burst';
  burst.style.left=`${x}px`;
  burst.style.top=`${y}px`;
  for(let i=0;i<8;i++){
    const ray=document.createElement('i');
    ray.style.transform=`rotate(${i*45}deg) translateY(-5px)`;
    burst.appendChild(ray);
  }
  document.body.appendChild(burst);
  burst.animate([
    {opacity:1,transform:'translate(-50%,-50%) scale(.35)'},
    {opacity:.95,offset:.35,transform:'translate(-50%,-50%) scale(1.1)'},
    {opacity:0,transform:'translate(-50%,-50%) scale(1.8)'}
  ],{duration:260,easing:'ease-out'}).onfinish=()=>burst.remove();
}

function animateFailedStrike(piece,onDone){
  const el=piece.el;
  if(!el){onDone?.();return;}
  const base=el.style.transform;
  const anim=el.animate([
    {transform:base},
    {transform:`${base} translate(-7px,-3px) rotate(-7deg)`},
    {transform:`${base} translate(8px,-1px) rotate(7deg)`},
    {transform:`${base} translate(-5px,0) rotate(-4deg)`},
    {transform:base}
  ],{duration:360,easing:'ease-out'});
  anim.finished.then(()=>onDone?.()).catch(()=>onDone?.());
}

function flyToSlot(piece,slotIndex,onDone){
  const el=piece.el;
  const slot=document.querySelector(`.slot[data-slot-index="${slotIndex}"]`);
  if(!el || !slot){ onDone?.(); return; }
  const a=el.getBoundingClientRect(), b=slot.getBoundingClientRect();
  const clone=el.cloneNode(true);
  Object.assign(clone.style,{position:'fixed',left:`${a.left}px`,top:`${a.top}px`,width:`${a.width}px`,height:`${a.height}px`,transform:'none',zIndex:'9999',pointerEvents:'none'});
  document.body.appendChild(clone);
  el.style.visibility='hidden';
  const endLeft=b.left+b.width*.12;
  const endTop=b.top+b.height*.12;
  const midLeft=(a.left+endLeft)/2;
  const midTop=Math.min(a.top,endTop)-42;
  clone.animate([
    {offset:0,left:`${a.left}px`,top:`${a.top}px`,width:`${a.width}px`,height:`${a.height}px`,opacity:1,transform:'rotate(0deg)'},
    {offset:.45,left:`${midLeft}px`,top:`${midTop}px`,width:`${a.width*.72}px`,height:`${a.height*.72}px`,opacity:.95,transform:'rotate(150deg)'},
    {offset:1,left:`${endLeft}px`,top:`${endTop}px`,width:`${b.width*.76}px`,height:`${b.height*.76}px`,opacity:.18,transform:'rotate(290deg)'}
  ],{duration:520,easing:'cubic-bezier(.18,.72,.2,1)'}).onfinish=()=>{
    clone.remove();
    el.remove();
    piece.el=null;
    onDone?.();
  };
}

function getSelectedSource(){ return state.pieces.find(p=>p.id===state.selectedSourceId && !p.collected) || null; }
function getKhanPiece(){ return state.pieces.find(p=>p.type==='khan' && !p.collected) || null; }

function refreshPieceVisuals(){
  const snap=scenario.snapshot();
  for(const p of state.pieces){
    if(!p.el || p.collected) continue;
    p.el.classList.toggle('selected',p.id===state.selectedSourceId);
    if(p.type==='khan') p.el.classList.toggle('active',snap.khanActive);
  }
}

function resetSlotDom(){
  document.querySelectorAll('.slot').forEach(slot=>{slot.innerHTML='';slot.classList.remove('filled')});
  document.getElementById('upayZone1').classList.remove('complete');
  document.getElementById('upayZone2').classList.remove('complete');
}

function updateSlotDom(index,src){
  const slot=document.querySelector(`.slot[data-slot-index="${index}"]`);
  if(!slot) return;
  const img=document.createElement('img');
  img.src=src;
  slot.innerHTML='';
  slot.appendChild(img);
  slot.classList.add('filled');
}

function updateProgress(){
  const c1=state.slots.slice(0,3).filter(Boolean).length;
  const c2=state.slots.slice(3,6).filter(Boolean).length;
  document.getElementById('zone1Progress').textContent=`${c1}/3`;
  document.getElementById('zone2Progress').textContent=`${c2}/3`;
  document.getElementById('upayZone1').classList.toggle('complete',c1===3);
  document.getElementById('upayZone2').classList.toggle('complete',c2===3);
}

function scenarioLabel(code){ return code.replaceAll('_',' + '); }
function setObjective(text){ state.lastObjective=text; document.getElementById('objective').textContent=text; }
function setObjectiveFromScenario(){
  const s=scenario.snapshot();
  if(s.finished) return setObjective(scenario.resultText());
  if(s.khanActive) return setObjective('ХАН активирован! Нажми на Хана');
  if(s.failedStrikeRequired) return setObjective('Последний удар — попробуй выбить ещё один чуко');
  if(s.collected===0) return setObjective(`${document.getElementById('demoToggle').checked?'DEMO ':''}${scenarioLabel(s.scenario)} • Выбери чуко-биту`);
  setObjective(`${document.getElementById('demoToggle').checked?'DEMO ':''}${scenarioLabel(s.scenario)} • собрано ${s.collected}/${s.normalLimit}`);
}

let flashTimer=null;
function flashObjective(text){
  clearTimeout(flashTimer);
  const old=state.lastObjective;
  document.getElementById('objective').textContent=text;
  flashTimer=setTimeout(()=>document.getElementById('objective').textContent=old,1200);
}

function pulse(el,scale=1.14){
  if(!el) return;
  const base=el.style.transform;
  el.animate([{transform:base},{transform:`${base} scale(${scale})`},{transform:base}],{duration:380,easing:'ease-out'});
}

function celebrateKhan(el){
  if(!el) return;
  const base=el.style.transform;
  el.animate([
    {filter:'drop-shadow(0 0 8px #ffd36a)',transform:base},
    {filter:'drop-shadow(0 0 30px #ffd36a) drop-shadow(0 0 45px #fff1a0)',transform:`${base} scale(1.18)`},
    {filter:'drop-shadow(0 0 8px #ffd36a)',transform:base}
  ],{duration:850,easing:'ease-in-out'});
}

window.UPAY2D={
  setDenominations(list,selected=null){
    const valid=[...new Set((list||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0))];
    if(!valid.length) return;
    state.denominations=valid;
    const req=Number(selected);
    state.denomination=valid.includes(req)?req:valid[0];
    syncStakeUI();
  },
  getDenomination(){return state.denomination},
  setScenario(code){
    if(!Object.values(SCENARIOS).includes(code)) return false;
    state.externalScenarioCode=code;
    startNewGame();
    return true;
  },
  clearScenarioOverride(){state.externalScenarioCode=null},
  getScenario(){return scenario.snapshot()},
};
