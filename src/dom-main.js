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

const anchors = [
  [20,34.5],[34,32.5],[48,34.5],[62,32.5],[77,34.8],
  [16,42.5],[30,45.5],[42,42],[61,44.5],[77,43.2],
  [20,53.5],[36,51.5],[54,53.5],[70,50.5],[82,54.5],
];

injectStyles();
setupUI();
startNewGame();

function injectStyles(){
  const style = document.createElement('style');
  style.textContent = `
    #pixiHost{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}
    .game-piece{position:absolute;transform:translate(-50%,-50%);transform-origin:center;object-fit:contain;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-drag:none;filter:drop-shadow(0 7px 5px rgba(0,0,0,.23));transition:filter .15s ease,opacity .15s ease}
    .game-piece.normal{width:12.5%}
    .game-piece.khan{width:13.5%;z-index:25}
    .game-piece.selected{filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px #55c7ff) drop-shadow(0 7px 5px rgba(0,0,0,.23))}
    .game-piece.khan.active{filter:drop-shadow(0 0 8px #ffd36a) drop-shadow(0 0 20px #ffae32) drop-shadow(0 7px 5px rgba(0,0,0,.23))}
    .game-piece.appear{animation:pieceAppear .42s cubic-bezier(.2,.8,.2,1) both}
    @keyframes pieceAppear{from{opacity:0;transform:translate(-50%,-50%) scale(.25)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
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
  for(let i=0;i<15;i++){
    const [x,y]=anchors[i];
    state.pieces.push({
      id:`C${i+1}`,
      type:'normal',
      src:chukoFiles[i%chukoFiles.length],
      x:x+(Math.random()-.5)*2.6,
      y:y+(Math.random()-.5)*1.8,
      rotation:(Math.random()-.5)*42,
      collected:false,
      el:null,
    });
  }
  state.pieces.push({
    id:'KHAN',type:'khan',src:khanFiles[Math.floor(Math.random()*khanFiles.length)],
    x:50,y:45.3,rotation:(Math.random()-.5)*12,collected:false,el:null,
  });
}

function renderPieces(){
  host.innerHTML='';
  for(const p of state.pieces){
    if(p.collected) continue;
    const img=document.createElement('img');
    img.src=p.src;
    img.alt=p.type==='khan'?'Хан':'Чуко';
    img.draggable=false;
    img.className=`game-piece ${p.type} appear`;
    img.style.left=`${p.x}%`;
    img.style.top=`${p.y}%`;
    img.style.transform=`translate(-50%,-50%) rotate(${p.rotation}deg)`;
    img.style.animationDelay=`${Math.random()*120}ms`;
    img.addEventListener('click',()=>onPieceTap(p));
    p.el=img;
    host.appendChild(img);
  }
  refreshPieceVisuals();
}

function onPieceTap(piece){
  if(piece.collected || state.phase==='animating' || state.phase==='settled') return;
  const snap=scenario.snapshot();
  if(piece.type==='khan') return onKhanTap(piece,snap);
  if(snap.khanActive){
    flashObjective('ХАН активирован — нажми на Хана');
    pulse(getKhanPiece()?.el);
    return;
  }

  const source=getSelectedSource();
  if(!source){
    state.selectedSourceId=piece.id;
    state.phase='aiming';
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
    pulse(piece.el);
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
  nudgeSource(source.el,target.el);

  if(snap.failedStrikeRequired){
    pulse(target.el);
    setTimeout(()=>{
      scenario.registerFailedStrike();
      state.phase='settled';
      setObjective(scenario.resultText());
      syncSelectorLock();
    },320);
    return;
  }

  if(!scenario.canCollectNormal()){
    state.phase='idle';
    setObjectiveFromScenario();
    syncSelectorLock();
    return;
  }

  const nextSlot=state.slots.findIndex(v=>v===null);
  if(nextSlot<0) return;

  target.collected=true;
  state.slots[nextSlot]={id:target.id,type:target.type,src:target.src};
  updateSlotDom(nextSlot,target.src);
  scenario.registerCollection();
  updateProgress();
  flyToSlot(target,nextSlot,()=>{
    const after=scenario.snapshot();
    if(after.finished){
      state.phase='settled';
      setObjective(scenario.resultText());
    } else if(after.khanActive){
      state.phase='idle';
      setObjective('ХАН активирован! Нажми на Хана');
      getKhanPiece()?.el?.classList.add('active');
      pulse(getKhanPiece()?.el);
    } else if(after.failedStrikeRequired){
      state.phase='idle';
      setObjective('Последний удар — попробуй выбить ещё один чуко');
    } else {
      state.phase='idle';
      setObjectiveFromScenario();
    }
    syncSelectorLock();
  });
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

function nudgeSource(source,target){
  if(!source || !target) return;
  const a=source.getBoundingClientRect(), b=target.getBoundingClientRect();
  const dx=(b.left-a.left)*.10, dy=(b.top-a.top)*.10;
  source.animate([
    {transform:source.style.transform},
    {transform:`${source.style.transform} translate(${dx}px,${dy}px) scale(1.06)`},
    {transform:source.style.transform}
  ],{duration:260,easing:'ease-out'});
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
  clone.animate([
    {left:`${a.left}px`,top:`${a.top}px`,width:`${a.width}px`,height:`${a.height}px`,opacity:1},
    {left:`${b.left+b.width*.12}px`,top:`${b.top+b.height*.12}px`,width:`${b.width*.76}px`,height:`${b.height*.76}px`,opacity:.15}
  ],{duration:420,easing:'cubic-bezier(.2,.75,.2,1)'}).onfinish=()=>{
    clone.remove();
    el.remove();
    piece.el=null;
    onDone?.();
  };
}

function pulse(el){
  if(!el) return;
  el.animate([{scale:'1'},{scale:'1.14'},{scale:'1'}],{duration:380,easing:'ease-out'});
}

function celebrateKhan(el){
  if(!el) return;
  el.animate([
    {filter:'drop-shadow(0 0 8px #ffd36a)'},
    {filter:'drop-shadow(0 0 30px #ffd36a) drop-shadow(0 0 45px #fff1a0)',transform:`${el.style.transform} scale(1.18)`},
    {filter:'drop-shadow(0 0 8px #ffd36a)',transform:el.style.transform}
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
