import { CONFIG } from './config.js';
import { ScenarioEngine, SCENARIOS } from './scenario-engine.js';

const host = document.getElementById('pixiHost');
const scenario = new ScenarioEngine();

const POSITION_META = {
  aykur: { label: 'Айкүр', assets: ['chuko_02.webp','chuko_04.webp'] },
  taa:   { label: 'Таа',   assets: ['chuko_03.webp'] },
  bok:   { label: 'Бөк',   assets: ['chuko_05.webp'] },
  chik:  { label: 'Чик',   assets: ['chuko_01.webp'] },
};
const ASSET_TO_POSITION = {};
Object.entries(POSITION_META).forEach(([pose,meta])=>meta.assets.forEach(a=>ASSET_TO_POSITION[a]=pose));

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

const COLOR_PALETTE = [
  { id:'turquoise', label:'Бирюзовый', filter:'sepia(.75) saturate(4.6) hue-rotate(118deg) brightness(1.05) contrast(1.04)' },
  { id:'azure',     label:'Лазурный',   filter:'sepia(.72) saturate(4.2) hue-rotate(155deg) brightness(1.04) contrast(1.06)' },
  { id:'violet',    label:'Фиолетовый', filter:'sepia(.72) saturate(4.3) hue-rotate(215deg) brightness(1.03) contrast(1.05)' },
  { id:'coral',     label:'Коралловый', filter:'sepia(.72) saturate(4.4) hue-rotate(320deg) brightness(1.06) contrast(1.04)' },
  { id:'lime',      label:'Салатовый',  filter:'sepia(.70) saturate(4.0) hue-rotate(62deg) brightness(1.08) contrast(1.02)' },
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
  guideFilter: null,
  suppressClickUntil: 0,
};

const drag = {
  active:false,
  pointerId:null,
  source:null,
  startX:0,
  startY:0,
  dx:0,
  dy:0,
  strength:0,
  moved:false,
  candidate:null,
  baseTransform:'',
};

injectStyles();
setupUI();
startNewGame();

function injectStyles(){
  const style=document.createElement('style');
  style.textContent=`
    #pixiHost{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}
    .game-piece{position:absolute;transform:translate(-50%,-50%);transform-origin:center;object-fit:contain;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-drag:none;touch-action:none;filter:drop-shadow(0 8px 6px rgba(0,0,0,.28));transition:filter .16s ease,opacity .16s ease}
    .game-piece.normal{width:16.2%}
    .game-piece.khan{width:17.2%;z-index:25}
    .game-piece.selected{z-index:60!important;filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 18px #63dfff) drop-shadow(0 9px 7px rgba(0,0,0,.30))!important}
    .game-piece.source-ready{filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 12px rgba(77,214,255,.95)) drop-shadow(0 8px 6px rgba(0,0,0,.26))!important}
    .game-piece.valid-target{opacity:1!important;filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 18px #ffd96c) drop-shadow(0 8px 6px rgba(0,0,0,.26))!important}
    .game-piece.invalid-target{opacity:.38!important;filter:grayscale(.28) drop-shadow(0 5px 4px rgba(0,0,0,.18))!important}
    .game-piece.aim-candidate{opacity:1!important;filter:drop-shadow(0 0 6px #fff) drop-shadow(0 0 24px #ffe078) drop-shadow(0 0 36px rgba(255,188,40,.8))!important}
    .game-piece.pose-guide-match{opacity:1!important;filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 17px #65ddff) drop-shadow(0 8px 6px rgba(0,0,0,.26))!important}
    .game-piece.pose-guide-dim{opacity:.28!important;filter:grayscale(.42) drop-shadow(0 4px 3px rgba(0,0,0,.14))!important}
    .game-piece.khan.active{opacity:1!important;filter:drop-shadow(0 0 7px #fff) drop-shadow(0 0 22px #ffd45f) drop-shadow(0 0 38px rgba(255,170,38,.9))!important;animation:khanPulse0120 1.2s ease-in-out infinite}
    @keyframes khanPulse0120{0%,100%{scale:1}50%{scale:1.07}}

    .pose-guide{position:absolute;left:58px;top:118px;z-index:8;width:132px;padding:8px 8px 9px;border:1px solid rgba(255,255,255,.24);border-radius:14px;background:rgba(6,28,49,.90);box-shadow:0 8px 18px rgba(0,0,0,.24);backdrop-filter:blur(5px);color:#fff;pointer-events:auto}
    .pose-guide-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;font-size:11px;font-weight:900;letter-spacing:.04em}
    .pose-guide-hide{width:22px;height:22px;padding:0;border:1px solid rgba(255,255,255,.25);border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:13px;line-height:18px;cursor:pointer}
    .pose-guide-sub{font-size:9px;line-height:1.15;opacity:.72;margin:-1px 0 6px}
    .pose-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
    .pose-guide-btn{height:28px;border:1px solid rgba(150,205,236,.38);border-radius:9px;background:rgba(15,55,84,.88);color:#f7fbff;font-size:10px;font-weight:850;cursor:pointer}
    .pose-guide-btn.active{background:rgba(49,110,148,.98);border-color:#f1cb74;color:#ffeaa8;box-shadow:0 0 9px rgba(116,216,255,.45)}
    .pose-guide-open{position:absolute;left:58px;top:118px;z-index:8;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(6,28,49,.92);color:#fff;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(0,0,0,.22)}

    .pull-sector{position:fixed;left:0;top:0;width:270px;height:154px;z-index:10020;display:none;pointer-events:none;transform-origin:0 77px;filter:drop-shadow(0 0 5px rgba(54,198,255,.25))}
    .pull-sector svg{width:270px;height:154px;overflow:visible}
    .pull-elastic{position:fixed;height:3px;z-index:10021;display:none;pointer-events:none;transform-origin:0 50%;background:linear-gradient(90deg,rgba(255,255,255,.88),rgba(76,207,255,.18));border-radius:3px;box-shadow:0 0 8px rgba(83,213,255,.45)}
    .pull-handle{position:fixed;width:24px;height:24px;border:2px solid rgba(255,255,255,.88);border-radius:50%;z-index:10022;display:none;pointer-events:none;transform:translate(-50%,-50%);background:rgba(46,160,215,.25);box-shadow:0 0 12px rgba(77,206,255,.55)}
    .pull-label{position:fixed;z-index:10023;display:none;pointer-events:none;padding:5px 9px;border-radius:12px;background:rgba(5,27,47,.9);color:#fff;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:0 5px 12px rgba(0,0,0,.24)}
    .impact-burst{position:fixed;width:14px;height:14px;border:3px solid rgba(255,255,255,.95);border-radius:50%;z-index:9998;pointer-events:none;transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(240,198,108,.42),0 0 18px rgba(255,255,255,.9)}
    .impact-burst i{position:absolute;left:50%;top:50%;width:3px;height:22px;border-radius:3px;background:linear-gradient(#fff,#f0c66c);transform-origin:50% 0}

    @media(max-width:700px){
      .game-piece.normal{width:16.8%}.game-piece.khan{width:17.8%}
      .pose-guide{left:52px;top:112px;width:118px;padding:7px}.pose-guide-open{left:52px;top:112px}.pose-guide-head{font-size:10px}.pose-guide-sub{font-size:8px}.pose-guide-btn{height:25px;font-size:9px}
      .pull-sector{width:235px;height:136px;transform-origin:0 68px}.pull-sector svg{width:235px;height:136px}
    }
  `;
  document.head.appendChild(style);
}

function setupUI(){
  ensureSlots('zone1',0);
  ensureSlots('zone2',3);
  buildPoseGuide();
  buildPullGuide();
  renderStakeMenu();
  syncStakeUI();

  document.getElementById('stakeSelect').addEventListener('click',e=>{
    e.stopPropagation();
    if(!selectorInteractive()) return;
    const menu=document.getElementById('stakeMenu');
    menu.hidden=!menu.hidden;
    document.getElementById('stakeSelect').setAttribute('aria-expanded',String(!menu.hidden));
  });
  document.getElementById('stakeMenu').addEventListener('click',e=>{
    const option=e.target.closest('.stake-option');
    if(!option||!selectorInteractive()) return;
    selectDenomination(Number(option.dataset.value));
  });
  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.status-panel')) closeStakeMenu();
  });
  document.getElementById('newGameBtn').addEventListener('click',()=>{
    if(state.phase==='settled') startNewGame();
    else flashObjective('Выбери чуко-биту, оттяни назад и отпусти');
  });

  document.addEventListener('pointermove',onPointerMove,{passive:false});
  document.addEventListener('pointerup',onPointerUp,{passive:false});
  document.addEventListener('pointercancel',cancelPull,{passive:false});
}

function ensureSlots(zoneId,startIndex){
  const zone=document.getElementById(zoneId);zone.innerHTML='';
  for(let i=0;i<3;i++){
    const slot=document.createElement('div');slot.className='slot';slot.dataset.slotIndex=String(startIndex+i);zone.appendChild(slot);
  }
}

function buildPoseGuide(){
  const shell=document.getElementById('appShell');
  const panel=document.createElement('div');
  panel.className='pose-guide';
  panel.innerHTML=`<div class="pose-guide-head"><span>ПОЛОЖЕНИЯ ЧУКО</span><button class="pose-guide-hide" type="button">×</button></div><div class="pose-guide-sub">Нажми название — подсветим на поле</div><div class="pose-guide-grid">${Object.entries(POSITION_META).map(([id,m])=>`<button class="pose-guide-btn" data-pose="${id}">${m.label}</button>`).join('')}</div>`;
  shell.appendChild(panel);
  const open=document.createElement('button');open.className='pose-guide-open';open.type='button';open.textContent='Положения';open.hidden=true;shell.appendChild(open);
  panel.querySelector('.pose-guide-hide').addEventListener('click',()=>{panel.hidden=true;open.hidden=false});
  open.addEventListener('click',()=>{panel.hidden=false;open.hidden=true});
  panel.querySelectorAll('.pose-guide-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const pose=btn.dataset.pose;
    state.guideFilter=state.guideFilter===pose?null:pose;
    updateGuideButtons();refreshPieceVisuals();
  }));
  state.poseGuide={panel,open};
}

function buildPullGuide(){
  const sector=document.createElement('div');sector.className='pull-sector';sector.innerHTML=`<svg viewBox="0 0 270 154" preserveAspectRatio="none"><defs><linearGradient id="pullGrad0120" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#6ee7ff" stop-opacity=".60"/><stop offset="58%" stop-color="#53cfff" stop-opacity=".23"/><stop offset="100%" stop-color="#3abcf5" stop-opacity="0"/></linearGradient></defs><path d="M0,77 L250,18 Q270,77 250,136 Z" fill="url(#pullGrad0120)" stroke="rgba(151,229,255,.58)" stroke-width="1.2"/><line x1="8" y1="77" x2="247" y2="77" stroke="rgba(255,255,255,.86)" stroke-width="1.8" stroke-dasharray="5 7"/></svg>`;document.body.appendChild(sector);
  const elastic=document.createElement('div');elastic.className='pull-elastic';document.body.appendChild(elastic);
  const handle=document.createElement('div');handle.className='pull-handle';document.body.appendChild(handle);
  const label=document.createElement('div');label.className='pull-label';label.textContent='ОТТЯНИ НАЗАД';document.body.appendChild(label);
  state.pullUI={sector,elastic,handle,label};
}

function selectorInteractive(){return state.phase==='idle'||state.phase==='settled'}
function selectDenomination(n){if(!selectorInteractive()||!state.denominations.includes(n))return;state.denomination=n;syncStakeUI();closeStakeMenu()}
function renderStakeMenu(){document.getElementById('stakeMenu').innerHTML=state.denominations.map(v=>`<button type="button" class="stake-option${v===state.denomination?' selected':''}" data-value="${v}">${v} ${state.currency}</button>`).join('')}
function syncStakeUI(){document.getElementById('stakeValue').textContent=state.denomination;document.getElementById('currencyValue').textContent=state.currency;document.getElementById('betLabel').textContent=`${state.denomination} ${state.currency}`;renderStakeMenu();syncSelectorLock();updateActionButton()}
function syncSelectorLock(){const locked=!selectorInteractive();document.getElementById('stakeSelect').classList.toggle('locked',locked);if(locked)closeStakeMenu()}
function closeStakeMenu(){const menu=document.getElementById('stakeMenu');menu.hidden=true;document.getElementById('stakeSelect').setAttribute('aria-expanded','false')}

function updateActionButton(){
  const btn=document.getElementById('newGameBtn');
  if(!btn)return;
  const settled=state.phase==='settled';
  btn.childNodes[0].nodeValue=settled?'НОВАЯ ИГРА ':'БРОСОК ';
  const small=btn.querySelector('small');if(small)small.textContent=`${state.denomination} ${state.currency}`;
}

function startNewGame(){
  closeStakeMenu();cancelPull();state.phase='idle';state.selectedSourceId=null;state.slots=Array(6).fill(null);state.guideFilter=null;
  const demoMode=document.getElementById('demoToggle').checked;
  if(state.externalScenarioCode)scenario.setScenario(state.externalScenarioCode);
  else if(demoMode){scenario.reset({advanceDemo:state.demoHasStarted});state.demoHasStarted=true}
  else{state.demoHasStarted=false;scenario.setScenario(SCENARIOS.TWO)}
  resetSlotDom();buildPieces();renderPieces();updateProgress();setObjectiveFromScenario();syncSelectorLock();updateActionButton();updateGuideButtons();
}

function buildPieces(){
  state.pieces=[];const layouts=makeScatterLayout();
  for(let i=0;i<15;i++){
    const src=chukoFiles[i%chukoFiles.length],file=src.split('/').pop(),pos=layouts[i],color=COLOR_PALETTE[i%COLOR_PALETTE.length];
    state.pieces.push({id:`C${i+1}`,type:'normal',src,pose:ASSET_TO_POSITION[file],colorId:color.id,colorFilter:color.filter,x:pos.x,y:pos.y,rotation:(Math.random()-.5)*52,spawnDx:-150-Math.random()*190,spawnDy:-35+Math.random()*100,collected:false,el:null});
  }
  state.pieces.push({id:'KHAN',type:'khan',src:khanFiles[Math.floor(Math.random()*khanFiles.length)],x:50,y:45.2,rotation:(Math.random()-.5)*12,spawnDx:-80,spawnDy:30,collected:false,el:null});
}

function makeScatterLayout(){
  const cx=50,cy=45.2,rings=[{count:5,rx:11.5,ry:5.2,offset:-78},{count:5,rx:20.5,ry:9.2,offset:-44},{count:5,rx:29.5,ry:12.8,offset:-12}],out=[];
  for(const ring of rings)for(let i=0;i<ring.count;i++){const deg=ring.offset+(360/ring.count)*i+(Math.random()-.5)*18,a=deg*Math.PI/180;out.push({x:cx+Math.cos(a)*ring.rx+(Math.random()-.5)*1.5,y:cy+Math.sin(a)*ring.ry+(Math.random()-.5)*1.2})}
  return out;
}

function renderPieces(){
  host.innerHTML='';
  state.pieces.forEach((p,index)=>{
    if(p.collected)return;
    const img=document.createElement('img');img.src=p.src;img.alt=p.type==='khan'?'Хан':'Чуко';img.draggable=false;img.className=`game-piece ${p.type}`;img.style.left=`${p.x}%`;img.style.top=`${p.y}%`;img.style.transform=`translate(-50%,-50%) rotate(${p.rotation}deg)`;
    if(p.type==='normal'){img.dataset.pose=p.pose;img.dataset.color=p.colorId;applyPieceColor(p);img.addEventListener('pointerdown',e=>onPiecePointerDown(e,p))}
    img.addEventListener('click',e=>onPieceTap(e,p));p.el=img;host.appendChild(img);animateScatterIn(p,index);
  });
  refreshPieceVisuals();
}

function applyPieceColor(piece){
  if(!piece?.el||piece.type!=='normal')return;
  piece.el.style.filter=`${piece.colorFilter} drop-shadow(0 8px 6px rgba(0,0,0,.28))`;
}

function animateScatterIn(piece,index){
  const el=piece.el;if(!el)return;const base=`translate(-50%,-50%) rotate(${piece.rotation}deg)`,spin=piece.rotation+(Math.random()-.5)*65;
  el.animate([{opacity:0,transform:`translate(-50%,-50%) translate(${piece.spawnDx}px,${piece.spawnDy}px) rotate(${spin}deg) scale(.25)`},{opacity:1,offset:.72,transform:`translate(-50%,-50%) translate(8px,-12px) rotate(${piece.rotation+8}deg) scale(1.05)`},{opacity:1,transform:base}],{duration:470+Math.random()*140,delay:index*18,easing:'cubic-bezier(.18,.78,.2,1)',fill:'both'});
}

function onPieceTap(event,piece){
  if(Date.now()<state.suppressClickUntil){event.preventDefault();return}
  if(piece.collected||state.phase==='animating'||state.phase==='settled')return;
  const snap=scenario.snapshot();
  if(piece.type==='khan'){
    event.preventDefault();
    flashObjective(snap.khanActive?(state.selectedSourceId?'Оттяни выбранный чуко назад и отпусти в Хана':'Сначала выбери чуко-биту'):'Хан пока не активирован');
    pulse(piece.el,1.12);return;
  }
  if(snap.khanActive){selectSource(piece,'ХАН! Оттяни чуко назад и отпусти в Хана');return}
  const source=getSelectedSource();
  if(!source){
    if(getValidTargets(piece).length===0){flashObjective('Нет пары в таком же положении — выбери другой чуко');pulse(piece.el,1.08);return}
    selectSource(piece,'Оттяни чуко назад от цели и отпусти');return;
  }
  if(source.id===piece.id){clearSelection();setObjectiveFromScenario();return}
  if(!isValidTarget(source,piece)){flashObjective('Бить можно только по чуко в том же положении');pulse(piece.el,1.08);return}
  flashObjective('Удар делается оттягиванием бьющего чуко назад');
}

function selectSource(piece,text){state.selectedSourceId=piece.id;state.phase='aiming';setObjective(text);pulse(piece.el,1.07);refreshPieceVisuals();updateActionButton()}
function clearSelection(){state.selectedSourceId=null;state.phase='idle';refreshPieceVisuals();updateActionButton()}

function onPiecePointerDown(e,piece){
  if(piece.collected||state.phase==='animating'||state.phase==='settled')return;
  const snap=scenario.snapshot();
  if(snap.khanActive){if(state.selectedSourceId!==piece.id)selectSource(piece,'ХАН! Оттяни чуко назад и отпусти в Хана')}
  else if(state.selectedSourceId!==piece.id){if(getValidTargets(piece).length===0)return;selectSource(piece,'Оттяни чуко назад от цели и отпусти')}
  if(state.selectedSourceId!==piece.id)return;
  drag.active=true;drag.pointerId=e.pointerId;drag.source=piece;drag.dx=drag.dy=drag.strength=0;drag.moved=false;drag.candidate=null;drag.baseTransform=piece.el.style.transform;
  const r=piece.el.getBoundingClientRect();drag.startX=r.left+r.width/2;drag.startY=r.top+r.height/2;showPullGuide(drag.startX,drag.startY,0,0,drag.startX,drag.startY);
  try{piece.el.setPointerCapture?.(e.pointerId)}catch{}
  e.preventDefault();
}

function onPointerMove(e){
  if(!drag.active||e.pointerId!==drag.pointerId||!drag.source?.el)return;
  let x=e.clientX-drag.startX,y=e.clientY-drag.startY;const len=Math.hypot(x,y),max=112,scale=len>max?max/len:1;x*=scale;y*=scale;
  drag.dx=x;drag.dy=y;drag.strength=Math.hypot(x,y);if(drag.strength>6)drag.moved=true;
  drag.source.el.style.transform=`${drag.baseTransform} translate(${x*.58}px,${y*.58}px) scale(${1+Math.min(.07,drag.strength/1500)})`;
  const shotAngle=Math.atan2(-y,-x);drag.candidate=findAimCandidate(drag.source,shotAngle);document.querySelectorAll('.aim-candidate').forEach(el=>el.classList.remove('aim-candidate'));drag.candidate?.el?.classList.add('aim-candidate');
  showPullGuide(drag.startX,drag.startY,shotAngle,drag.strength,e.clientX,e.clientY);
  e.preventDefault();
}

function onPointerUp(e){
  if(!drag.active||e.pointerId!==drag.pointerId)return;
  const source=drag.source,candidate=drag.candidate,power=drag.strength,moved=drag.moved,missDx=drag.dx,missDy=drag.dy;
  source?.el?.classList.remove('aim-candidate');document.querySelectorAll('.aim-candidate').forEach(el=>el.classList.remove('aim-candidate'));
  if(source?.el)source.el.style.transform=drag.baseTransform;
  hidePullGuide();drag.active=false;drag.pointerId=null;drag.source=null;drag.candidate=null;state.suppressClickUntil=Date.now()+250;
  if(!moved||power<24){flashObjective('Оттяни чуко назад сильнее и отпусти');return}
  const snap=scenario.snapshot();
  if(snap.failedStrikeRequired){animateMiss(source,missDx,missDy,()=>{scenario.registerFailedStrike();state.phase='settled';state.selectedSourceId=null;setObjective(scenario.resultText());syncSelectorLock();refreshPieceVisuals();updateActionButton()});return}
  if(snap.khanActive){
    if(candidate?.type!=='khan'){flashObjective('Оттяни назад по линии к Хану');return}
    strikeKhan(source,candidate);return;
  }
  if(!candidate){flashObjective('Оттяни назад по линии к подсвеченному чуко');return}
  strikeTarget(source,candidate,snap);
}

function cancelPull(){if(!drag.active)return;if(drag.source?.el)drag.source.el.style.transform=drag.baseTransform;hidePullGuide();drag.active=false;drag.pointerId=null;drag.source=null;drag.candidate=null;document.querySelectorAll('.aim-candidate').forEach(el=>el.classList.remove('aim-candidate'))}

function findAimCandidate(source,angle){
  const sr=source.el.getBoundingClientRect(),sx=sr.left+sr.width/2,sy=sr.top+sr.height/2,snap=scenario.snapshot();
  const targets=snap.khanActive?[getKhanPiece()].filter(Boolean):getValidTargets(source);let best=null,bestScore=Infinity;const maxDiff=(snap.khanActive?30:23)*Math.PI/180;
  for(const p of targets){if(!p.el)continue;const r=p.el.getBoundingClientRect(),tx=r.left+r.width/2,ty=r.top+r.height/2,a=Math.atan2(ty-sy,tx-sx),diff=Math.abs(normalizeAngle(a-angle));if(diff>maxDiff)continue;const dist=Math.hypot(tx-sx,ty-sy),score=diff*800+dist*.1;if(score<bestScore){bestScore=score;best=p}}
  return best;
}

function showPullGuide(sx,sy,angle,power,px,py){
  const ui=state.pullUI;if(!ui)return;ui.sector.style.left=`${sx}px`;ui.sector.style.top=`${sy-77}px`;ui.sector.style.transform=`rotate(${angle}rad) scaleX(${.72+Math.min(.28,power/120)})`;ui.sector.style.display='block';
  const ex=px-sx,ey=py-sy,len=Math.min(112,Math.hypot(ex,ey));ui.elastic.style.left=`${sx}px`;ui.elastic.style.top=`${sy}px`;ui.elastic.style.width=`${len}px`;ui.elastic.style.transform=`rotate(${Math.atan2(ey,ex)}rad)`;ui.elastic.style.display=power>2?'block':'none';ui.handle.style.left=`${sx+drag.dx}px`;ui.handle.style.top=`${sy+drag.dy}px`;ui.handle.style.display=power>2?'block':'none';ui.label.textContent=power<24?'ОТТЯНИ НАЗАД':'ОТПУСТИ';ui.label.style.left=`${sx+drag.dx+14}px`;ui.label.style.top=`${sy+drag.dy+14}px`;ui.label.style.display='block';
}
function hidePullGuide(){const ui=state.pullUI;if(!ui)return;ui.sector.style.display='none';ui.elastic.style.display='none';ui.handle.style.display='none';ui.label.style.display='none'}

function strikeTarget(source,target,snap){
  state.phase='animating';state.selectedSourceId=null;syncSelectorLock();refreshPieceVisuals();updateActionButton();
  if(!scenario.canCollectNormal()){state.phase='idle';setObjectiveFromScenario();syncSelectorLock();refreshPieceVisuals();updateActionButton();return}
  const nextSlot=state.slots.findIndex(v=>v===null);if(nextSlot<0){state.phase='idle';syncSelectorLock();updateActionButton();return}
  target.collected=true;state.slots[nextSlot]={id:target.id,type:target.type,src:target.src,colorFilter:target.colorFilter};scenario.registerCollection();
  animateStrike(source,target,()=>{
    flipSourcePose(source);
    flyToSlot(target,nextSlot,()=>{
      updateSlotDom(nextSlot,target);updateProgress();const after=scenario.snapshot();
      if(after.finished){state.phase='settled';setObjective(scenario.resultText())}
      else if(after.khanActive){state.phase='idle';setObjective('ХАН активирован! Выбери чуко-биту, оттяни и отпусти');getKhanPiece()?.el?.classList.add('active');pulse(getKhanPiece()?.el,1.15)}
      else if(after.failedStrikeRequired){state.phase='idle';setObjective('Последний удар: оттяни чуко и отпусти — следующий бросок будет промахом')}
      else{state.phase='idle';setObjectiveFromScenario()}
      syncSelectorLock();refreshPieceVisuals();updateActionButton();
    });
  });
}

function strikeKhan(source,khan){
  state.phase='animating';state.selectedSourceId=null;syncSelectorLock();refreshPieceVisuals();updateActionButton();
  animateStrike(source,khan,()=>{
    flipSourcePose(source);scenario.registerKhanHit();state.phase='settled';setObjective(scenario.resultText());celebrateKhan(khan.el);syncSelectorLock();refreshPieceVisuals();updateActionButton();
  },true);
}

function animateStrike(source,target,onDone,isKhan=false){
  const sourceEl=source?.el,targetEl=target?.el;if(!sourceEl||!targetEl){onDone?.();return}
  const a=sourceEl.getBoundingClientRect(),b=targetEl.getBoundingClientRect(),sx=a.left,sy=a.top,sw=a.width,sh=a.height,scx=a.left+a.width/2,scy=a.top+a.height/2,tcx=b.left+b.width/2,tcy=b.top+b.height/2,dx=tcx-scx,dy=tcy-scy,d=Math.max(1,Math.hypot(dx,dy)),ux=dx/d,uy=dy/d,contact=Math.max(18,d-Math.max(b.width,b.height)*.34);
  const clone=sourceEl.cloneNode(true);clone.classList.remove('selected','source-ready','valid-target','invalid-target','aim-candidate');Object.assign(clone.style,{position:'fixed',left:`${sx}px`,top:`${sy}px`,width:`${sw}px`,height:`${sh}px`,margin:'0',transform:'none',zIndex:'10080',pointerEvents:'none',opacity:'1'});document.body.appendChild(clone);sourceEl.style.visibility='hidden';
  const duration=860;const flight=clone.animate([{offset:0,left:`${sx}px`,top:`${sy}px`,transform:'rotate(0deg) scale(1)'},{offset:.16,left:`${sx-ux*13}px`,top:`${sy-uy*13-3}px`,transform:'rotate(-10deg) scale(1.03)'},{offset:.62,left:`${sx+ux*contact}px`,top:`${sy+uy*contact-18}px`,transform:'rotate(155deg) scale(1.10)'},{offset:.72,left:`${sx+ux*(contact+10)}px`,top:`${sy+uy*(contact+10)-10}px`,transform:'rotate(210deg) scale(1.06)'},{offset:1,left:`${sx}px`,top:`${sy}px`,transform:'rotate(350deg) scale(1)'}],{duration,easing:'cubic-bezier(.18,.70,.18,1)',fill:'forwards'});
  setTimeout(()=>{createImpactBurst(tcx,tcy);nudgeNearbyPieces(target,source);if(isKhan)kickKhan(targetEl,ux,uy);else kickTarget(targetEl,ux,uy)},500);
  flight.finished.catch(()=>{}).finally(()=>{clone.remove();sourceEl.style.visibility='';onDone?.()});
}

function animateMiss(source,missDx,missDy,onDone){
  const el=source?.el;if(!el){onDone?.();return}const a=el.getBoundingClientRect(),sx=a.left,sy=a.top,sw=a.width,sh=a.height,dx=-missDx||70,dy=-missDy||-20,d=Math.max(1,Math.hypot(dx,dy)),ux=dx/d,uy=dy/d;
  const clone=el.cloneNode(true);Object.assign(clone.style,{position:'fixed',left:`${sx}px`,top:`${sy}px`,width:`${sw}px`,height:`${sh}px`,margin:'0',transform:'none',zIndex:'10080',pointerEvents:'none'});document.body.appendChild(clone);el.style.visibility='hidden';
  clone.animate([{left:`${sx}px`,top:`${sy}px`,opacity:1,transform:'rotate(0deg)'},{left:`${sx+ux*180}px`,top:`${sy+uy*180-18}px`,opacity:.95,transform:'rotate(240deg)'},{left:`${sx+ux*245}px`,top:`${sy+uy*245+10}px`,opacity:0,transform:'rotate(420deg)'}],{duration:760,easing:'cubic-bezier(.18,.7,.2,1)',fill:'forwards'}).onfinish=()=>{clone.remove();el.style.visibility='';flipSourcePose(source);onDone?.()};
}

function kickTarget(el,ux,uy){if(!el)return;const base=el.style.transform;el.animate([{transform:base},{transform:`${base} translate(${ux*34}px,${uy*25-11}px) rotate(24deg) scale(1.08)`},{transform:base}],{duration:360,easing:'ease-out'})}
function kickKhan(el,ux,uy){if(!el)return;const base=el.style.transform;el.animate([{transform:base},{transform:`${base} translate(${ux*58}px,${uy*44-18}px) rotate(70deg) scale(1.1)`},{transform:`${base} translate(${ux*88}px,${uy*68-30}px) rotate(180deg) scale(.94)`}],{duration:470,easing:'cubic-bezier(.16,.72,.18,1)',fill:'forwards'})}

function nudgeNearbyPieces(target,source){if(!target?.el)return;const tr=target.el.getBoundingClientRect(),tx=tr.left+tr.width/2,ty=tr.top+tr.height/2;for(const p of state.pieces){if(!p.el||p.collected||p.id===target.id||p.id===source.id)continue;const r=p.el.getBoundingClientRect(),px=r.left+r.width/2,py=r.top+r.height/2,dx=px-tx,dy=py-ty,d=Math.hypot(dx,dy);if(d>190||d<1)continue;const amp=6+(1-d/190)*13,nx=dx/d,ny=dy/d,base=p.el.style.transform;p.el.animate([{transform:base},{transform:`${base} translate(${nx*amp}px,${ny*amp*.7}px) rotate(${nx*5}deg)`},{transform:base}],{duration:330,easing:'ease-out'})}}

function createImpactBurst(x,y){const burst=document.createElement('span');burst.className='impact-burst';burst.style.left=`${x}px`;burst.style.top=`${y}px`;for(let i=0;i<8;i++){const ray=document.createElement('i');ray.style.transform=`rotate(${i*45}deg) translateY(-5px)`;burst.appendChild(ray)}document.body.appendChild(burst);burst.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.35)'},{opacity:.95,offset:.35,transform:'translate(-50%,-50%) scale(1.1)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.8)'}],{duration:300,easing:'ease-out'}).onfinish=()=>burst.remove()}

function flyToSlot(piece,slotIndex,onDone){
  const el=piece.el,slot=document.querySelector(`.slot[data-slot-index="${slotIndex}"]`);if(!el||!slot){onDone?.();return}const a=el.getBoundingClientRect(),b=slot.getBoundingClientRect(),clone=el.cloneNode(true);Object.assign(clone.style,{position:'fixed',left:`${a.left}px`,top:`${a.top}px`,width:`${a.width}px`,height:`${a.height}px`,transform:'none',zIndex:'9999',pointerEvents:'none'});document.body.appendChild(clone);el.style.visibility='hidden';const endLeft=b.left+b.width*.12,endTop=b.top+b.height*.12,midLeft=(a.left+endLeft)/2,midTop=Math.min(a.top,endTop)-42;clone.animate([{offset:0,left:`${a.left}px`,top:`${a.top}px`,width:`${a.width}px`,height:`${a.height}px`,opacity:1,transform:'rotate(0deg)'},{offset:.45,left:`${midLeft}px`,top:`${midTop}px`,width:`${a.width*.72}px`,height:`${a.height*.72}px`,opacity:.95,transform:'rotate(150deg)'},{offset:1,left:`${endLeft}px`,top:`${endTop}px`,width:`${b.width*.76}px`,height:`${b.height*.76}px`,opacity:.18,transform:'rotate(290deg)'}],{duration:560,easing:'cubic-bezier(.18,.72,.2,1)'}).onfinish=()=>{clone.remove();el.remove();piece.el=null;onDone?.()};
}

function flipSourcePose(piece){
  if(!piece?.el||piece.type!=='normal')return;const old=piece.pose,available=[...new Set(state.pieces.filter(p=>p.type==='normal'&&!p.collected&&p.id!==piece.id).map(p=>p.pose))],choices=available.filter(p=>p!==old);const pool=choices.length?choices:available;const nextPose=pool[Math.floor(Math.random()*Math.max(1,pool.length))]||old,assets=POSITION_META[nextPose].assets,nextAsset=assets[Math.floor(Math.random()*assets.length)],nextSrc=`./assets/chuko/${nextAsset}`,el=piece.el,base=el.style.transform;
  const anim=el.animate([{transform:base},{offset:.45,transform:`${base} scaleX(.08) rotate(70deg)`},{offset:.55,transform:`${base} scaleX(.08) rotate(105deg)`},{transform:base}],{duration:430,easing:'cubic-bezier(.25,.7,.22,1)'});
  setTimeout(()=>{piece.pose=nextPose;piece.src=nextSrc;el.src=nextSrc;el.dataset.pose=nextPose;applyPieceColor(piece)},210);anim.finished.catch(()=>{}).finally(()=>refreshPieceVisuals());
}

function isValidTarget(source,target){return !!source&&!!target&&source.id!==target.id&&source.type==='normal'&&target.type==='normal'&&!source.collected&&!target.collected&&source.pose===target.pose}
function getValidTargets(source){return state.pieces.filter(p=>isValidTarget(source,p))}
function getSelectedSource(){return state.pieces.find(p=>p.id===state.selectedSourceId&&!p.collected)||null}
function getKhanPiece(){return state.pieces.find(p=>p.type==='khan'&&!p.collected)||null}

function refreshPieceVisuals(){
  const snap=scenario.snapshot(),source=getSelectedSource(),validIds=new Set(source&&!snap.khanActive?getValidTargets(source).map(p=>p.id):[]);
  for(const p of state.pieces){if(!p.el||p.collected)continue;p.el.classList.remove('selected','source-ready','valid-target','invalid-target','pose-guide-match','pose-guide-dim');
    if(p.type==='normal'){
      if(p.id===state.selectedSourceId)p.el.classList.add('selected');
      else if(source){if(snap.khanActive)p.el.classList.add('invalid-target');else p.el.classList.add(validIds.has(p.id)?'valid-target':'invalid-target')}
      else if(getValidTargets(p).length>0)p.el.classList.add('source-ready');
      if(!source&&state.guideFilter)p.el.classList.add(p.pose===state.guideFilter?'pose-guide-match':'pose-guide-dim');
      applyPieceColor(p);
    }else if(p.type==='khan')p.el.classList.toggle('active',snap.khanActive);
  }
}

function updateGuideButtons(){if(!state.poseGuide)return;state.poseGuide.panel.querySelectorAll('.pose-guide-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.pose===state.guideFilter))}
function resetSlotDom(){document.querySelectorAll('.slot').forEach(slot=>{slot.innerHTML='';slot.classList.remove('filled')});document.getElementById('upayZone1').classList.remove('complete');document.getElementById('upayZone2').classList.remove('complete')}
function updateSlotDom(index,piece){const slot=document.querySelector(`.slot[data-slot-index="${index}"]`);if(!slot)return;const img=document.createElement('img');img.src=piece.src;img.style.filter=`${piece.colorFilter} drop-shadow(0 4px 3px rgba(0,0,0,.22))`;slot.innerHTML='';slot.appendChild(img);slot.classList.add('filled')}
function updateProgress(){const c1=state.slots.slice(0,3).filter(Boolean).length,c2=state.slots.slice(3,6).filter(Boolean).length;document.getElementById('zone1Progress').textContent=`${c1}/3`;document.getElementById('zone2Progress').textContent=`${c2}/3`;document.getElementById('upayZone1').classList.toggle('complete',c1===3);document.getElementById('upayZone2').classList.toggle('complete',c2===3)}

function scenarioLabel(code){return code.replaceAll('_',' + ')}
function setObjective(text){state.lastObjective=text;document.getElementById('objective').textContent=text}
function setObjectiveFromScenario(){const s=scenario.snapshot();if(s.finished)return setObjective(scenario.resultText());if(s.khanActive)return setObjective('ХАН! Выбери чуко-биту, оттяни назад и отпусти');if(s.failedStrikeRequired)return setObjective('Последний бросок — оттяни чуко и отпусти');if(s.collected===0)return setObjective(`${document.getElementById('demoToggle').checked?'DEMO ':''}${scenarioLabel(s.scenario)} • Выбери чуко-биту`);setObjective(`${document.getElementById('demoToggle').checked?'DEMO ':''}${scenarioLabel(s.scenario)} • собрано ${s.collected}/${s.normalLimit}`)}
let flashTimer=null;function flashObjective(text){clearTimeout(flashTimer);const old=state.lastObjective;document.getElementById('objective').textContent=text;flashTimer=setTimeout(()=>{document.getElementById('objective').textContent=old},1250)}
function pulse(el,scale=1.14){if(!el)return;const base=el.style.transform;el.animate([{transform:base},{transform:`${base} scale(${scale})`},{transform:base}],{duration:380,easing:'ease-out'})}
function celebrateKhan(el){if(!el)return;const base=el.style.transform;el.animate([{filter:'drop-shadow(0 0 8px #ffd36a)',transform:base},{filter:'drop-shadow(0 0 30px #ffd36a) drop-shadow(0 0 45px #fff1a0)',transform:`${base} scale(1.18)`},{filter:'drop-shadow(0 0 8px #ffd36a)',transform:base}],{duration:850,easing:'ease-in-out'})}
function normalizeAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}

window.UPAY2D={
  setDenominations(list,selected=null){const valid=[...new Set((list||[]).map(Number).filter(v=>Number.isFinite(v)&&v>0))];if(!valid.length)return;state.denominations=valid;const req=Number(selected);state.denomination=valid.includes(req)?req:valid[0];syncStakeUI()},
  getDenomination(){return state.denomination},
  setScenario(code){if(!Object.values(SCENARIOS).includes(code))return false;state.externalScenarioCode=code;startNewGame();return true},
  clearScenarioOverride(){state.externalScenarioCode=null},
  getScenario(){return scenario.snapshot()},
};