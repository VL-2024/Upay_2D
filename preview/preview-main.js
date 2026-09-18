import { CONFIG } from '../src/config.js';
import { ScenarioEngine, SCENARIOS } from '../src/scenario-engine.js';

const host = document.getElementById('pixiHost');
const shell = document.getElementById('appShell');
const scenario = new ScenarioEngine();

const POSITION_META = {
  aykur: { label: 'Айкүр', src: './assets/chuko/chuko_aykur.webp', color: '#2f72ff' },
  taa:   { label: 'Таа',   src: './assets/chuko/chuko_taa.webp',   color: '#36b953' },
  bok:   { label: 'Бөк',   src: './assets/chuko/chuko_bok.webp',   color: '#f2389d' },
  chik:  { label: 'Чик',   src: './assets/chuko/chuko_chik.webp',  color: '#f59a23' },
};
const POSES = Object.keys(POSITION_META);
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
  guideFilter: null,
  suppressClickUntil: 0,
  layoutRevision: 0,
};

const drag = {
  active: false,
  pointerId: null,
  source: null,
  startX: 0,
  startY: 0,
  dx: 0,
  dy: 0,
  strength: 0,
  moved: false,
  candidate: null,
  baseTransform: '',
};


const DEFAULT_TUNING = {
  chukoSize: 15.2,
  khanSize: 16.7,
  carpetSize: window.innerWidth <= 700 ? 88 : 84,
  carpetTop: 45.5,
  pileYOffset: 0,
  scatterScale: 1.0,
};
const TUNING_STORAGE_KEY = 'upay-preview-tuning-0136';

function loadTuning() {
  try {
    const saved = JSON.parse(localStorage.getItem(TUNING_STORAGE_KEY) || '{}');
    return { ...DEFAULT_TUNING, ...saved };
  } catch {
    return { ...DEFAULT_TUNING };
  }
}

const tuning = loadTuning();

function saveTuning() {
  try { localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(tuning)); } catch {}
}

injectStyles();
setupUI();
startNewGame();

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #pixiHost{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}
    .game-piece{position:absolute;transform:translate(-50%,-50%);transform-origin:center;object-fit:contain;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-drag:none;touch-action:none;filter:drop-shadow(0 6px 5px rgba(0,0,0,.24));transition:filter .14s ease,opacity .14s ease}
    .game-piece.normal{width:var(--chuko-size,15.2%)}
    .game-piece.khan{width:var(--khan-size,16.7%);z-index:25}
    .game-piece.selected{z-index:60!important;filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 14px #63dfff) drop-shadow(0 7px 5px rgba(0,0,0,.28))!important}
    .game-piece.source-ready{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 9px rgba(77,214,255,.85)) drop-shadow(0 6px 5px rgba(0,0,0,.22))!important}
    .game-piece.valid-target{opacity:1!important;filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 14px #ffd96c) drop-shadow(0 6px 5px rgba(0,0,0,.22))!important}
    .game-piece.invalid-target{opacity:.45!important;filter:brightness(.88) drop-shadow(0 4px 3px rgba(0,0,0,.16))!important}
    .game-piece.aim-candidate{opacity:1!important;filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 20px #ffe078) drop-shadow(0 0 28px rgba(255,188,40,.68))!important}
    .game-piece.pose-guide-match{opacity:1!important;filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 14px #65ddff) drop-shadow(0 6px 5px rgba(0,0,0,.22))!important}
    .game-piece.pose-guide-dim{opacity:.34!important;filter:brightness(.82) drop-shadow(0 4px 3px rgba(0,0,0,.14))!important}
    .game-piece.khan.active{opacity:1!important;filter:drop-shadow(0 0 7px #fff) drop-shadow(0 0 22px #ffd45f) drop-shadow(0 0 35px rgba(255,170,38,.86))!important;animation:khanPulse0128 1.2s ease-in-out infinite}
    @keyframes khanPulse0128{0%,100%{scale:1}50%{scale:1.06}}

    .pose-guide{position:absolute;left:58px;top:118px;z-index:8;width:132px;padding:8px 8px 9px;border:1px solid rgba(255,255,255,.24);border-radius:14px;background:rgba(6,28,49,.90);box-shadow:0 8px 18px rgba(0,0,0,.24);backdrop-filter:blur(5px);color:#fff;pointer-events:auto}
    .pose-guide-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;font-size:11px;font-weight:900;letter-spacing:.04em}
    .pose-guide-hide{width:22px;height:22px;padding:0;border:1px solid rgba(255,255,255,.25);border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:13px;line-height:18px;cursor:pointer}
    .pose-guide-sub{font-size:9px;line-height:1.15;opacity:.72;margin:-1px 0 6px}
    .pose-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
    .pose-guide-btn{height:28px;border:2px solid rgba(150,205,236,.38);border-radius:9px;background:rgba(15,55,84,.88);color:#f7fbff;font-size:10px;font-weight:850;cursor:pointer}
    .pose-guide-btn.active{color:#fff;box-shadow:0 0 10px rgba(255,255,255,.36),inset 0 0 0 1px rgba(255,255,255,.5)}
    .pose-guide-open{position:absolute;left:58px;top:118px;z-index:8;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(6,28,49,.92);color:#fff;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(0,0,0,.22)}

    .pull-sector{position:fixed;left:0;top:0;width:270px;height:154px;z-index:10020;display:none;pointer-events:none;transform-origin:0 77px;filter:drop-shadow(0 0 5px rgba(54,198,255,.25))}
    .pull-sector svg{width:270px;height:154px;overflow:visible}
    .pull-elastic{position:fixed;height:3px;z-index:10021;display:none;pointer-events:none;transform-origin:0 50%;background:linear-gradient(90deg,rgba(255,255,255,.88),rgba(76,207,255,.18));border-radius:3px;box-shadow:0 0 8px rgba(83,213,255,.45)}
    .pull-handle{position:fixed;width:24px;height:24px;border:2px solid rgba(255,255,255,.88);border-radius:50%;z-index:10022;display:none;pointer-events:none;transform:translate(-50%,-50%);background:rgba(46,160,215,.25);box-shadow:0 0 12px rgba(77,206,255,.55)}
    .pull-label{position:fixed;z-index:10023;display:none;pointer-events:none;padding:5px 9px;border-radius:12px;background:rgba(5,27,47,.9);color:#fff;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:0 5px 12px rgba(0,0,0,.24)}
    .impact-burst{position:fixed;width:14px;height:14px;border:3px solid rgba(255,255,255,.95);border-radius:50%;z-index:10090;pointer-events:none;transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(240,198,108,.42),0 0 18px rgba(255,255,255,.9)}
    .impact-burst i{position:absolute;left:50%;top:50%;width:3px;height:22px;border-radius:3px;background:linear-gradient(#fff,#f0c66c);transform-origin:50% 0}

    .main-btn{font-size:34px!important;letter-spacing:-.025em}
    .slot img{filter:drop-shadow(0 3px 2px rgba(0,0,0,.18))!important}

    @media(max-width:700px){
      .game-piece.normal{width:var(--chuko-size,15.2%)}.game-piece.khan{width:var(--khan-size,16.7%)}
      .pose-guide{left:52px;top:112px;width:118px;padding:7px}.pose-guide-open{left:52px;top:112px}.pose-guide-head{font-size:10px}.pose-guide-sub{font-size:8px}.pose-guide-btn{height:25px;font-size:9px}
      .pull-sector{width:235px;height:136px;transform-origin:0 68px}.pull-sector svg{width:235px;height:136px}
      .main-btn{font-size:22px!important}
    }
  `;
  document.head.appendChild(style);
}

function setupUI() {
  ensureSlots('zone1', 0);
  ensureSlots('zone2', 3);
  buildPoseGuide();
  buildPullGuide();
  buildTuningPanel();
  applyTuning();
  renderStakeMenu();
  syncStakeUI();

  document.getElementById('stakeSelect').addEventListener('click', e => {
    e.stopPropagation();
    if (!selectorInteractive()) return;
    const menu = document.getElementById('stakeMenu');
    menu.hidden = !menu.hidden;
    document.getElementById('stakeSelect').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.getElementById('stakeMenu').addEventListener('click', e => {
    const option = e.target.closest('.stake-option');
    if (!option || !selectorInteractive()) return;
    selectDenomination(Number(option.dataset.value));
  });
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.status-panel')) closeStakeMenu();
  });
  document.getElementById('newGameBtn').addEventListener('click', () => {
    if (state.phase === 'settled') startNewGame();
    else flashObjective('Выбери чуко-биту, оттяни назад и отпусти');
  });
  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', onPointerUp, { passive: false });
  document.addEventListener('pointercancel', cancelPull, { passive: false });
}

function ensureSlots(zoneId, startIndex) {
  const zone = document.getElementById(zoneId);
  zone.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slotIndex = String(startIndex + i);
    zone.appendChild(slot);
  }
}

function buildPoseGuide() {
  const panel = document.createElement('div');
  panel.className = 'pose-guide';
  panel.innerHTML = `<div class="pose-guide-head"><span>ПОЛОЖЕНИЯ ЧУКО</span><button class="pose-guide-hide" type="button">×</button></div><div class="pose-guide-sub">Нажми название — подсветим на поле</div><div class="pose-guide-grid">${Object.entries(POSITION_META).map(([id, m]) => `<button class="pose-guide-btn" data-pose="${id}" style="border-color:${m.color}">${m.label}</button>`).join('')}</div>`;
  shell.appendChild(panel);
  const open = document.createElement('button');
  open.className = 'pose-guide-open';
  open.type = 'button';
  open.textContent = 'Положения';
  open.hidden = true;
  shell.appendChild(open);
  panel.querySelector('.pose-guide-hide').addEventListener('click', () => { panel.hidden = true; open.hidden = false; });
  open.addEventListener('click', () => { panel.hidden = false; open.hidden = true; });
  panel.querySelectorAll('.pose-guide-btn').forEach(btn => btn.addEventListener('click', () => {
    const pose = btn.dataset.pose;
    state.guideFilter = state.guideFilter === pose ? null : pose;
    updateGuideButtons();
    refreshPieceVisuals();
  }));
  state.poseGuide = { panel, open };
}

function buildPullGuide() {
  const sector = document.createElement('div');
  sector.className = 'pull-sector';
  sector.innerHTML = `<svg viewBox="0 0 270 154" preserveAspectRatio="none"><defs><linearGradient id="pullGrad0128" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#6ee7ff" stop-opacity=".60"/><stop offset="58%" stop-color="#53cfff" stop-opacity=".23"/><stop offset="100%" stop-color="#3abcf5" stop-opacity="0"/></linearGradient></defs><path d="M0,77 L250,18 Q270,77 250,136 Z" fill="url(#pullGrad0128)" stroke="rgba(151,229,255,.58)" stroke-width="1.2"/><line x1="8" y1="77" x2="247" y2="77" stroke="rgba(255,255,255,.86)" stroke-width="1.8" stroke-dasharray="5 7"/></svg>`;
  document.body.appendChild(sector);
  const elastic = document.createElement('div'); elastic.className = 'pull-elastic'; document.body.appendChild(elastic);
  const handle = document.createElement('div'); handle.className = 'pull-handle'; document.body.appendChild(handle);
  const label = document.createElement('div'); label.className = 'pull-label'; label.textContent = 'ОТТЯНИ НАЗАД'; document.body.appendChild(label);
  state.pullUI = { sector, elastic, handle, label };
}


function buildTuningPanel() {
  const tools = document.querySelector('.side-tools');
  const button = document.createElement('button');
  button.className = 'tool tuning-open';
  button.type = 'button';
  button.setAttribute('aria-label', 'Настройки сцены');
  button.textContent = '⚙';
  tools?.appendChild(button);

  const panel = document.createElement('section');
  panel.className = 'tuning-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="tuning-head">
      <b>НАСТРОЙКА СЦЕНЫ</b>
      <button type="button" class="tuning-close">×</button>
    </div>
    <label>Размер чуко <output data-out="chukoSize"></output>
      <input data-key="chukoSize" type="range" min="11" max="20" step=".2">
    </label>
    <label>Размер Хана <output data-out="khanSize"></output>
      <input data-key="khanSize" type="range" min="13" max="22" step=".2">
    </label>
    <label>Размер ковра <output data-out="carpetSize"></output>
      <input data-key="carpetSize" type="range" min="72" max="102" step=".5">
    </label>
    <label>Ковер выше / ниже <output data-out="carpetTop"></output>
      <input data-key="carpetTop" type="range" min="38" max="54" step=".2">
    </label>
    <label>Кучка выше / ниже <output data-out="pileYOffset"></output>
      <input data-key="pileYOffset" type="range" min="-7" max="8" step=".2">
    </label>
    <label>Разброс чуко <output data-out="scatterScale"></output>
      <input data-key="scatterScale" type="range" min=".72" max="1.28" step=".02">
    </label>
    <div class="tuning-actions">
      <button type="button" class="tuning-reroll">Новая раскладка</button>
      <button type="button" class="tuning-reset">Сброс</button>
    </div>
  `;
  shell.appendChild(panel);
  state.tuningPanel = panel;

  panel.querySelectorAll('input[data-key]').forEach(input => {
    const key = input.dataset.key;
    input.value = tuning[key];
    input.addEventListener('input', () => {
      tuning[key] = Number(input.value);
      applyTuning();
    });
    input.addEventListener('change', () => {
      if (['carpetSize','carpetTop','pileYOffset','scatterScale'].includes(key)) rerollPreviewLayout();
    });
  });

  button.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  panel.querySelector('.tuning-close').addEventListener('click', () => { panel.hidden = true; });
  panel.querySelector('.tuning-reroll').addEventListener('click', rerollPreviewLayout);
  panel.querySelector('.tuning-reset').addEventListener('click', () => {
    Object.assign(tuning, DEFAULT_TUNING);
    panel.querySelectorAll('input[data-key]').forEach(input => { input.value = tuning[input.dataset.key]; });
    applyTuning();
    rerollPreviewLayout();
  });
}

function applyTuning() {
  shell.style.setProperty('--chuko-size', `${tuning.chukoSize}%`);
  shell.style.setProperty('--khan-size', `${tuning.khanSize}%`);
  shell.style.setProperty('--carpet-size', `${tuning.carpetSize}%`);
  shell.style.setProperty('--carpet-top', `${tuning.carpetTop}%`);
  saveTuning();

  const panel = state.tuningPanel;
  if (!panel) return;
  const formats = {
    chukoSize: v => `${Number(v).toFixed(1)}%`,
    khanSize: v => `${Number(v).toFixed(1)}%`,
    carpetSize: v => `${Number(v).toFixed(1)}%`,
    carpetTop: v => `${Number(v).toFixed(1)}%`,
    pileYOffset: v => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`,
    scatterScale: v => `${Number(v).toFixed(2)}×`,
  };
  panel.querySelectorAll('output[data-out]').forEach(out => {
    const key = out.dataset.out;
    out.textContent = formats[key](tuning[key]);
  });
}

function rerollPreviewLayout() {
  if (state.phase === 'animating') return;
  if (state.slots.some(Boolean)) {
    flashObjective('Положение применится полностью с новой игрой');
    return;
  }
  state.selectedSourceId = null;
  state.phase = 'idle';
  buildPieces();
  renderPieces();
  setObjectiveFromScenario();
  refreshPieceVisuals();
}

function selectorInteractive() { return state.phase === 'idle' || state.phase === 'settled'; }
function selectDenomination(n) { if (!selectorInteractive() || !state.denominations.includes(n)) return; state.denomination = n; syncStakeUI(); closeStakeMenu(); }
function renderStakeMenu() { document.getElementById('stakeMenu').innerHTML = state.denominations.map(v => `<button type="button" class="stake-option${v === state.denomination ? ' selected' : ''}" data-value="${v}">${v} ${state.currency}</button>`).join(''); }
function syncStakeUI() { document.getElementById('stakeValue').textContent = state.denomination; document.getElementById('currencyValue').textContent = state.currency; document.getElementById('betLabel').textContent = `${state.denomination} ${state.currency}`; renderStakeMenu(); syncSelectorLock(); updateActionButton(); }
function syncSelectorLock() { const locked = !selectorInteractive(); document.getElementById('stakeSelect').classList.toggle('locked', locked); if (locked) closeStakeMenu(); }
function closeStakeMenu() { const menu = document.getElementById('stakeMenu'); menu.hidden = true; document.getElementById('stakeSelect').setAttribute('aria-expanded', 'false'); }

function updateActionButton() {
  const btn = document.getElementById('newGameBtn');
  if (!btn) return;
  const settled = state.phase === 'settled';
  btn.childNodes[0].nodeValue = settled ? 'НОВАЯ ИГРА ' : 'БРОСОК / УДАР ';
  const small = btn.querySelector('small');
  if (small) small.textContent = `${state.denomination} ${state.currency}`;
}

function startNewGame() {
  closeStakeMenu();
  cancelPull();
  state.phase = 'idle';
  state.selectedSourceId = null;
  state.slots = Array(CONFIG.zones.totalSlots).fill(null);
  state.guideFilter = null;
  const demoMode = document.getElementById('demoToggle').checked;
  if (state.externalScenarioCode) scenario.setScenario(state.externalScenarioCode);
  else if (demoMode) { scenario.reset({ advanceDemo: state.demoHasStarted }); state.demoHasStarted = true; }
  else { state.demoHasStarted = false; scenario.setScenario(SCENARIOS.TWO); }
  resetSlotDom();
  buildPieces();
  renderPieces();
  updateProgress();
  setObjectiveFromScenario();
  syncSelectorLock();
  updateActionButton();
  updateGuideButtons();
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function buildPieces() {
  state.pieces = [];
  const positions = makeRandomScatter(15);
  const shortPose = POSES[Math.floor(Math.random() * POSES.length)];
  const poseBag = [];
  for (const pose of POSES) {
    const count = pose === shortPose ? 3 : 4;
    for (let i = 0; i < count; i++) poseBag.push(pose);
  }
  const poses = shuffled(poseBag);
  positions.forEach((pos, i) => {
    const pose = poses[i];
    state.pieces.push({
      id: `C${i + 1}`,
      type: 'normal',
      pose,
      src: POSITION_META[pose].src,
      x: pos.x,
      y: pos.y,
      rotation: -38 + Math.random() * 76,
      spawnDx: -120 - Math.random() * 190,
      spawnDy: -50 + Math.random() * 120,
      collected: false,
      el: null,
    });
  });
  const br = host.getBoundingClientRect();
  const carpet = getCarpetGeometry(br);
  const pileCenterY = carpet.cy + br.height * (tuning.pileYOffset / 100);
  state.pieces.push({
    id: 'KHAN',
    type: 'khan',
    src: khanFiles[Math.floor(Math.random() * khanFiles.length)],
    x: (carpet.cx / br.width) * 100,
    y: (pileCenterY / br.height) * 100,
    rotation: -8 + Math.random() * 16,
    spawnDx: -70,
    spawnDy: 25,
    collected: false,
    el: null,
  });
}


function getCarpetGeometry(referenceRect = host.getBoundingClientRect()) {
  const carpetEl = document.getElementById('carpetLayer');
  const r = carpetEl?.getBoundingClientRect();
  if (!r || !r.width || !r.height) {
    const radius = referenceRect.width * .40;
    return { cx: referenceRect.width * .50, cy: referenceRect.height * .455, rx: radius, ry: radius, radius };
  }
  const cx = (r.left + r.width / 2) - referenceRect.left;
  const cy = (r.top + r.height / 2) - referenceRect.top;
  const radius = Math.min(r.width, r.height) * .485;
  return { cx, cy, rx: radius, ry: radius, radius };
}


function makeRandomScatter(count) {
  const out = [];
  const br = host.getBoundingClientRect();
  const carpet = getCarpetGeometry(br);
  const cx = carpet.cx;
  const cy = carpet.cy + br.height * (tuning.pileYOffset / 100);
  const spread = tuning.scatterScale;
  const rx = carpet.radius * .70 * spread;
  const ry = carpet.radius * .285 * spread;
  const centerExclusion = Math.max(
    carpet.radius * .235,
    br.width * ((tuning.chukoSize + tuning.khanSize) / 200) * .72
  );
  let minDist = Math.max(64, br.width * .086 * Math.min(1.08, spread));

  for (let i = 0; i < count; i++) {
    let best = null;
    for (let attempt = 0; attempt < 460; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(.10 + Math.random() * .90);
      const px = cx + Math.cos(a) * rx * r + (Math.random() - .5) * br.width * .018;
      const py = cy + Math.sin(a) * ry * r + (Math.random() - .5) * br.height * .006;

      const carpetNorm = Math.hypot((px - carpet.cx) / carpet.radius, (py - carpet.cy) / carpet.radius);
      if (carpetNorm > .76) continue;

      // The Khan owns the centre. No chuko may overlap or sit on top of him.
      const centreDistance = Math.hypot(px - cx, (py - cy) * 1.34);
      if (centreDistance < centerExclusion) continue;

      const score = out.length
        ? Math.min(...out.map(q => Math.hypot(px - q.px, (py - q.py) * 1.42)))
        : 999;

      if (!best || score > best.score) best = { px, py, score };
      if (score >= minDist) break;
    }

    const fallbackAngle = (Math.PI * 2 * i / count) + Math.random() * .22;
    const fallbackRadius = centerExclusion * 1.18 + (i % 3) * 18;
    const chosen = best || {
      px: cx + Math.cos(fallbackAngle) * fallbackRadius,
      py: cy + Math.sin(fallbackAngle) * fallbackRadius * .44,
      score: 0
    };

    out.push({
      px: chosen.px,
      py: chosen.py,
      x: (chosen.px / br.width) * 100,
      y: (chosen.py / br.height) * 100
    });
    if (i > 8) minDist *= .982;
  }
  return shuffled(out.map(({x,y}) => ({x,y})));
}

function renderPieces() {
  host.innerHTML = '';
  const layoutRevision = ++state.layoutRevision;
  state.pieces.forEach((p, index) => {
    if (p.collected) return;
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.type === 'khan' ? 'Хан' : 'Чуко';
    img.draggable = false;
    img.className = `game-piece ${p.type}`;
    img.style.left = `${p.x}%`;
    img.style.top = `${p.y}%`;
    img.style.transform = `translate(-50%,-50%) rotate(${p.rotation}deg)`;
    if (p.type === 'normal') {
      img.dataset.pose = p.pose;
      img.addEventListener('pointerdown', e => onPiecePointerDown(e, p));
    }
    img.addEventListener('click', e => onPieceTap(e, p));
    p.el = img;
    host.appendChild(img);
    animateScatterIn(p, index);
  });
  refreshPieceVisuals();

  // Longest scatter animation is below 1 second. Resolving overlaps only after
  // it finishes avoids reading temporary transformed positions at the left edge.
  setTimeout(() => {
    if (layoutRevision !== state.layoutRevision) return;
    resolveAllPieceOverlaps();
  }, 1050);
}

function animateScatterIn(piece, index) {
  const el = piece.el;
  if (!el) return;
  const base = `translate(-50%,-50%) rotate(${piece.rotation}deg)`;
  const spin = piece.rotation + (Math.random() - .5) * 70;
  el.animate([
    { opacity: 0, transform: `translate(-50%,-50%) translate(${piece.spawnDx}px,${piece.spawnDy}px) rotate(${spin}deg) scale(.3)` },
    { opacity: 1, offset: .76, transform: `translate(-50%,-50%) translate(5px,-8px) rotate(${piece.rotation + 6}deg) scale(1.03)` },
    { opacity: 1, transform: base },
  ], { duration: 500 + Math.random() * 170, delay: index * 16, easing: 'cubic-bezier(.18,.78,.2,1)', fill: 'both' });
}

function onPieceTap(event, piece) {
  if (Date.now() < state.suppressClickUntil) { event.preventDefault(); return; }
  if (piece.collected || state.phase === 'animating' || state.phase === 'settled') return;
  const snap = scenario.snapshot();
  if (piece.type === 'khan') {
    event.preventDefault();
    flashObjective(snap.khanActive ? (state.selectedSourceId ? 'Оттяни выбранный чуко назад и отпусти в Хана' : 'Сначала выбери чуко-биту') : 'Хан пока не активирован');
    pulse(piece.el, 1.10);
    return;
  }
  if (snap.khanActive) { selectSource(piece, 'ХАН! Оттяни чуко назад и отпусти в Хана'); return; }
  const source = getSelectedSource();
  if (!source) {
    if (getValidTargets(piece).length === 0) { flashObjective('Нет пары такого цвета — выбери другой чуко'); pulse(piece.el, 1.06); return; }
    selectSource(piece, 'Оттяни чуко назад от цели и отпусти');
    return;
  }
  if (source.id === piece.id) { clearSelection(); setObjectiveFromScenario(); return; }
  if (!isValidTarget(source, piece)) { flashObjective('Бить можно только по чуко того же цвета'); pulse(piece.el, 1.06); return; }
  flashObjective('Удар делается оттягиванием чуко-биты назад');
}

function selectSource(piece, text) { state.selectedSourceId = piece.id; state.phase = 'aiming'; setObjective(text); pulse(piece.el, 1.05); refreshPieceVisuals(); updateActionButton(); }
function clearSelection() { state.selectedSourceId = null; state.phase = 'idle'; refreshPieceVisuals(); updateActionButton(); }

function onPiecePointerDown(e, piece) {
  if (piece.collected || state.phase === 'animating' || state.phase === 'settled') return;
  const snap = scenario.snapshot();
  if (snap.khanActive) {
    if (state.selectedSourceId !== piece.id) selectSource(piece, 'ХАН! Оттяни чуко назад и отпусти в Хана');
  } else if (state.selectedSourceId !== piece.id) {
    if (getValidTargets(piece).length === 0) return;
    selectSource(piece, 'Оттяни чуко назад от цели и отпусти');
  }
  if (state.selectedSourceId !== piece.id) return;
  drag.active = true;
  drag.pointerId = e.pointerId;
  drag.source = piece;
  drag.dx = drag.dy = drag.strength = 0;
  drag.moved = false;
  drag.candidate = null;
  drag.baseTransform = piece.el.style.transform;
  const r = piece.el.getBoundingClientRect();
  drag.startX = r.left + r.width / 2;
  drag.startY = r.top + r.height / 2;
  showPullGuide(drag.startX, drag.startY, 0, 0, drag.startX, drag.startY);
  try { piece.el.setPointerCapture?.(e.pointerId); } catch {}
  e.preventDefault();
}

function onPointerMove(e) {
  if (!drag.active || e.pointerId !== drag.pointerId || !drag.source?.el) return;
  let x = e.clientX - drag.startX, y = e.clientY - drag.startY;
  const len = Math.hypot(x, y), max = 112, scale = len > max ? max / len : 1;
  x *= scale; y *= scale;
  drag.dx = x; drag.dy = y; drag.strength = Math.hypot(x, y);
  if (drag.strength > 6) drag.moved = true;
  drag.source.el.style.transform = `${drag.baseTransform} translate(${x * .58}px,${y * .58}px) scale(${1 + Math.min(.06, drag.strength / 1700)})`;
  const shotAngle = Math.atan2(-y, -x);
  drag.candidate = findAimCandidate(drag.source, shotAngle);
  document.querySelectorAll('.aim-candidate').forEach(el => el.classList.remove('aim-candidate'));
  drag.candidate?.el?.classList.add('aim-candidate');
  showPullGuide(drag.startX, drag.startY, shotAngle, drag.strength, e.clientX, e.clientY);
  e.preventDefault();
}

function onPointerUp(e) {
  if (!drag.active || e.pointerId !== drag.pointerId) return;
  const source = drag.source, candidate = drag.candidate, power = drag.strength, moved = drag.moved, missDx = drag.dx, missDy = drag.dy;
  document.querySelectorAll('.aim-candidate').forEach(el => el.classList.remove('aim-candidate'));
  if (source?.el) source.el.style.transform = drag.baseTransform;
  hidePullGuide();
  drag.active = false; drag.pointerId = null; drag.source = null; drag.candidate = null;
  state.suppressClickUntil = Date.now() + 240;
  if (!moved || power < 24) { flashObjective('Оттяни чуко назад сильнее и отпусти'); return; }
  const snap = scenario.snapshot();
  if (snap.failedStrikeRequired) {
    if (!candidate || candidate.type !== 'normal') {
      flashObjective('Оттяни назад по линии к чуко того же цвета');
      return;
    }
    strikeFailedTarget(source, candidate);
    return;
  }
  if (snap.khanActive) {
    if (candidate?.type !== 'khan') { flashObjective('Оттяни назад по линии к Хану'); return; }
    strikeKhan(source, candidate);
    return;
  }
  if (!candidate) { flashObjective('Оттяни назад по линии к подсвеченному чуко'); return; }
  strikeTarget(source, candidate);
}

function cancelPull() {
  if (!drag.active) return;
  if (drag.source?.el) drag.source.el.style.transform = drag.baseTransform;
  hidePullGuide();
  drag.active = false; drag.pointerId = null; drag.source = null; drag.candidate = null;
  document.querySelectorAll('.aim-candidate').forEach(el => el.classList.remove('aim-candidate'));
}

function findAimCandidate(source, angle) {
  const sr = source.el.getBoundingClientRect(), sx = sr.left + sr.width / 2, sy = sr.top + sr.height / 2, snap = scenario.snapshot();
  const targets = snap.khanActive ? [getKhanPiece()].filter(Boolean) : getValidTargets(source);
  let best = null, bestScore = Infinity;
  const maxDiff = (snap.khanActive ? 32 : 26) * Math.PI / 180;
  for (const p of targets) {
    if (!p.el) continue;
    const r = p.el.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    const a = Math.atan2(ty - sy, tx - sx), diff = Math.abs(normalizeAngle(a - angle));
    if (diff > maxDiff) continue;
    const dist = Math.hypot(tx - sx, ty - sy), score = diff * 900 + dist * .08;
    if (score < bestScore) { bestScore = score; best = p; }
  }
  return best;
}

function showPullGuide(sx, sy, angle, power, px, py) {
  const ui = state.pullUI; if (!ui) return;
  ui.sector.style.left = `${sx}px`; ui.sector.style.top = `${sy - 77}px`; ui.sector.style.transform = `rotate(${angle}rad) scaleX(${.72 + Math.min(.28, power / 120)})`; ui.sector.style.display = 'block';
  const ex = px - sx, ey = py - sy, len = Math.min(112, Math.hypot(ex, ey));
  ui.elastic.style.left = `${sx}px`; ui.elastic.style.top = `${sy}px`; ui.elastic.style.width = `${len}px`; ui.elastic.style.transform = `rotate(${Math.atan2(ey, ex)}rad)`; ui.elastic.style.display = power > 2 ? 'block' : 'none';
  ui.handle.style.left = `${sx + drag.dx}px`; ui.handle.style.top = `${sy + drag.dy}px`; ui.handle.style.display = power > 2 ? 'block' : 'none';
  ui.label.textContent = power < 24 ? 'ОТТЯНИ НАЗАД' : 'ОТПУСТИ'; ui.label.style.left = `${sx + drag.dx + 14}px`; ui.label.style.top = `${sy + drag.dy + 14}px`; ui.label.style.display = 'block';
}
function hidePullGuide() { const ui = state.pullUI; if (!ui) return; ui.sector.style.display = 'none'; ui.elastic.style.display = 'none'; ui.handle.style.display = 'none'; ui.label.style.display = 'none'; }

async function strikeTarget(source, target) {
  state.phase = 'animating';
  state.selectedSourceId = null;
  syncSelectorLock();
  refreshPieceVisuals();
  updateActionButton();

  if (!scenario.canCollectNormal()) {
    state.phase = 'idle';
    setObjectiveFromScenario();
    syncSelectorLock();
    refreshPieceVisuals();
    updateActionButton();
    return;
  }

  const nextSlot = state.slots.findIndex(v => v === null);
  if (nextSlot < 0) {
    state.phase = 'idle';
    syncSelectorLock();
    updateActionButton();
    return;
  }

  // Scenario result is fixed, but visually the target remains on the carpet
  // until the v20.72-style collision actually happens.
  target.collected = true;
  state.slots[nextSlot] = {
    id: target.id,
    type: target.type,
    src: target.src,
    pose: target.pose
  };
  scenario.registerCollection();

  const hit = await animateChukoStrike2072(source, target, { eject: true });
  if (!hit) {
    state.phase = 'idle';
    syncSelectorLock();
    refreshPieceVisuals();
    updateActionButton();
    return;
  }

  // v20.72 had one single fly-out per winning piece. The piece is already
  // visibly outside the carpet here; only then it pauses briefly and goes to UPAY.
  await sleep(150);
  await flyToSlot(target, nextSlot);

  updateSlotDom(nextSlot, target);
  updateProgress();

  const after = scenario.snapshot();
  if (after.finished) {
    state.phase = 'settled';
    setObjective(scenario.resultText());
  } else if (after.khanActive) {
    state.phase = 'idle';
    setObjective('ХАН активирован! Выбери чуко-биту, оттяни и отпусти');
    getKhanPiece()?.el?.classList.add('active');
    pulse(getKhanPiece()?.el, 1.13);
  } else if (after.failedStrikeRequired) {
    state.phase = 'idle';
    setObjective('Последний удар: оттяни чуко и отпусти — следующий бросок будет промахом');
  } else {
    state.phase = 'idle';
    setObjectiveFromScenario();
  }

  syncSelectorLock();
  refreshPieceVisuals();
  updateActionButton();
}


async function strikeFailedTarget(source, target) {
  state.phase = 'animating';
  state.selectedSourceId = null;
  syncSelectorLock();
  refreshPieceVisuals();
  updateActionButton();

  const hit = await animateChukoStrike2072(source, target, { eject: false });
  if (!hit) {
    state.phase = 'idle';
    setObjectiveFromScenario();
    syncSelectorLock();
    refreshPieceVisuals();
    updateActionButton();
    return;
  }

  scenario.registerFailedStrike();
  state.phase = 'settled';
  setObjective(scenario.resultText());
  syncSelectorLock();
  refreshPieceVisuals();
  updateActionButton();
}



async function animateChukoStrike2072(source, target, { eject = true } = {}) {
  const sourceEl = source?.el;
  const targetEl = target?.el;
  if (!sourceEl || !targetEl) return null;

  const frozenSrc = source.src;
  const frozenPose = source.pose;
  const hostRect = host.getBoundingClientRect();
  const sr = sourceEl.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();

  const sx = sr.left + sr.width / 2;
  const sy = sr.top + sr.height / 2;
  const tx = tr.left + tr.width / 2;
  const ty = tr.top + tr.height / 2;

  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / dist;
  const uy = dy / dist;

  // Visual contact point. Transparent margins in the WebP assets are ignored.
  const contactGap = Math.max(15, (sr.width + tr.width) * .155);
  const impactX = tx - ux * contactGap;
  const impactY = ty - uy * contactGap;

  const sourceStartLeft = sx - hostRect.left;
  const sourceStartTop = sy - hostRect.top;
  const impactLeft = impactX - hostRect.left;
  const impactTop = impactY - hostRect.top;

  const baseRot = source.rotation;
  const spinSign = ux >= 0 ? 1 : -1;
  const impactRot = normalizeDeg(baseRot + spinSign * 30);

  // Striker rebound: a small hop, visible spin and a short backwards bounce.
  const rebound = clamp(sr.width * .16, 10, 18);
  const reboundSide = (Math.random() - .5) * clamp(sr.width * .07, 3, 7);
  const reboundLeft = impactLeft - ux * rebound + (-uy) * reboundSide;
  const reboundTop = impactTop - uy * rebound + ux * reboundSide;
  const reboundHop = clamp(sr.height * .12, 7, 13);
  const reboundRot = normalizeDeg(impactRot + spinSign * (72 + Math.random() * 34));
  const settleLeft = reboundLeft + ux * clamp(sr.width * .035, 2, 5);
  const settleTop = reboundTop + uy * clamp(sr.height * .025, 1, 4);
  const settleRot = normalizeDeg(reboundRot - spinSign * (12 + Math.random() * 8));

  const targetLocalX = tx - hostRect.left;
  const targetLocalY = ty - hostRect.top;
  const carpet = getCarpetGeometry(hostRect);

  const tangentAmount = (Math.random() * .12) - .06;
  let dirX = ux + (-uy) * tangentAmount;
  let dirY = uy + ux * tangentAmount;
  const dirLen = Math.hypot(dirX, dirY) || 1;
  dirX /= dirLen;
  dirY /= dirLen;

  const px = targetLocalX - carpet.cx;
  const py = targetLocalY - carpet.cy;
  const A = (dirX * dirX) / (carpet.rx * carpet.rx) + (dirY * dirY) / (carpet.ry * carpet.ry);
  const B = 2 * ((px * dirX) / (carpet.rx * carpet.rx) + (py * dirY) / (carpet.ry * carpet.ry));
  const C = (px * px) / (carpet.rx * carpet.rx) + (py * py) / (carpet.ry * carpet.ry) - 1;
  const disc = Math.max(0, B * B - 4 * A * C);
  let edgeDistance = (-B + Math.sqrt(disc)) / (2 * A);
  if (!Number.isFinite(edgeDistance) || edgeDistance < 18) edgeDistance = Math.min(hostRect.width * .22, 125);

  let endX, endY, c1x, c1y, c2x, c2y, targetDuration, targetSpin, hopHeight;

  if (eject) {
    const exitExtra = clamp(hostRect.width * .050, 20, 32);
    endX = targetLocalX + dirX * (edgeDistance + exitExtra);
    endY = targetLocalY + dirY * (edgeDistance + exitExtra);

    const halfW = tr.width * .52;
    const halfH = tr.height * .52;
    endX = clamp(endX, halfW + 9, hostRect.width - halfW - 9);
    endY = clamp(endY, halfH + 9, hostRect.height - halfH - 9);

    const exNorm = (endX - carpet.cx) / carpet.rx;
    const eyNorm = (endY - carpet.cy) / carpet.ry;
    if (exNorm * exNorm + eyNorm * eyNorm <= 1.02) {
      const scaleOut = 1.045 / Math.max(.001, Math.sqrt(exNorm * exNorm + eyNorm * eyNorm));
      endX = carpet.cx + (endX - carpet.cx) * scaleOut;
      endY = carpet.cy + (endY - carpet.cy) * scaleOut;
      endX = clamp(endX, halfW + 9, hostRect.width - halfW - 9);
      endY = clamp(endY, halfH + 9, hostRect.height - halfH - 9);
    }

    const push = clamp(tr.width * .52, 34, 52);
    c1x = targetLocalX + dirX * push;
    c1y = targetLocalY + dirY * push;
    c2x = endX - dirX * clamp(tr.width * .38, 28, 44);
    c2y = endY - dirY * clamp(tr.width * .38, 28, 44);
    targetDuration = 690 + Math.random() * 120;
    targetSpin = ((Math.random() * 2.2) - 1.1) * Math.PI;
    hopHeight = clamp(tr.height * .11, 7, 14);
  } else {
    const moveTowardEdge = Math.random() < .58;
    if (moveTowardEdge) {
      const safeTravel = Math.max(20, edgeDistance - clamp(tr.width * .72, 38, 62));
      const maxTravel = Math.max(28, Math.min(115, safeTravel));
      const travel = clamp(safeTravel * (.58 + Math.random() * .20), 28, maxTravel);
      endX = targetLocalX + dirX * travel;
      endY = targetLocalY + dirY * travel;

      const nx = (endX - carpet.cx) / carpet.rx;
      const ny = (endY - carpet.cy) / carpet.ry;
      const n = Math.hypot(nx, ny);
      if (n > .86) {
        const k = .86 / n;
        endX = carpet.cx + (endX - carpet.cx) * k;
        endY = carpet.cy + (endY - carpet.cy) * k;
      }

      c1x = targetLocalX + dirX * Math.min(34, travel * .38);
      c1y = targetLocalY + dirY * Math.min(34, travel * .38);
      c2x = targetLocalX + (endX - targetLocalX) * .78;
      c2y = targetLocalY + (endY - targetLocalY) * .78;
      targetDuration = 450 + Math.random() * 90;
      targetSpin = ((Math.random() * 1.0) - .5) * Math.PI;
      hopHeight = clamp(tr.height * .15, 9, 17);
    } else {
      const travel = clamp(tr.width * (.11 + Math.random() * .09), 8, 17);
      endX = targetLocalX + dirX * travel;
      endY = targetLocalY + dirY * travel;
      c1x = targetLocalX + dirX * travel * .52;
      c1y = targetLocalY + dirY * travel * .52;
      c2x = targetLocalX + dirX * travel * .88;
      c2y = targetLocalY + dirY * travel * .88;
      targetDuration = 360 + Math.random() * 70;
      targetSpin = ((Math.random() * .50) - .25) * Math.PI;
      hopHeight = clamp(tr.height * .20, 11, 21);
    }
  }

  const targetStartRot = target.rotation;

  sourceEl.classList.remove(
    'selected', 'source-ready', 'valid-target', 'invalid-target',
    'aim-candidate', 'pose-guide-match', 'pose-guide-dim'
  );
  sourceEl.style.zIndex = '90';
  sourceEl.style.pointerEvents = 'none';
  targetEl.style.zIndex = '80';
  targetEl.style.pointerEvents = 'none';

  let targetMotionPromise = null;
  let impactStarted = false;

  function startImpactNow() {
    if (impactStarted) return;
    impactStarted = true;

    createImpactBurst(
      impactX + ux * contactGap * .58,
      impactY + uy * contactGap * .58
    );

    // Any chuko physically close to the first part of the target's path gets
    // a small permanent displacement, as if the moving chuko clipped it.
    nudgeNeighboringChuko(
      source,
      target,
      targetLocalX,
      targetLocalY,
      endX,
      endY,
      dirX,
      dirY,
      carpet
    );

    targetMotionPromise = new Promise(resolve => {
      const startTime = performance.now();

      function moveTarget(now) {
        const raw = Math.min(1, (now - startTime) / targetDuration);
        // Strong initial acceleration: the target moves on the same rendered
        // frame as the visible impact, not after the striker has rebounded.
        const t = 1 - Math.pow(1 - raw, 2.7);
        const mt = 1 - t;

        const x =
          mt * mt * mt * targetLocalX +
          3 * mt * mt * t * c1x +
          3 * mt * t * t * c2x +
          t * t * t * endX;
        const pathY =
          mt * mt * mt * targetLocalY +
          3 * mt * mt * t * c1y +
          3 * mt * t * t * c2y +
          t * t * t * endY;
        const y = pathY - Math.sin(Math.PI * raw) * hopHeight;

        targetEl.style.left = `${x}px`;
        targetEl.style.top = `${y}px`;
        targetEl.style.transform =
          `translate(-50%,-50%) rotate(${targetStartRot + (targetSpin * t * 180 / Math.PI)}deg)`;

        if (raw < 1) {
          requestAnimationFrame(moveTarget);
        } else {
          target.x = (endX / hostRect.width) * 100;
          target.y = (endY / hostRect.height) * 100;
          target.rotation = normalizeDeg(targetStartRot + targetSpin * 180 / Math.PI);
          targetEl.style.left = `${target.x}%`;
          targetEl.style.top = `${target.y}%`;
          targetEl.style.transform =
            `translate(-50%,-50%) rotate(${target.rotation}deg)`;
          targetEl.style.zIndex = '';
          targetEl.style.pointerEvents = '';
          if (!eject) settlePieceNoOverlap(target, { carpet, keepInside: true });
          resolve();
        }
      }

      requestAnimationFrame(moveTarget);
    });
  }

  // One RAF loop controls the striker. Starting the target from inside this
  // loop eliminates the old timeout-induced pause at collision.
  const sourcePromise = new Promise(resolve => {
    const sourceDuration = 430;
    const impactAt = .47;
    const startTime = performance.now();

    function moveSource(now) {
      const raw = Math.min(1, (now - startTime) / sourceDuration);

      let x, y, rot, scale = 1;
      if (raw < .12) {
        const e = 1 - Math.pow(1 - raw / .12, 3);
        x = sourceStartLeft - ux * 7 * e;
        y = sourceStartTop - uy * 7 * e - Math.sin(Math.PI * e) * 1.5;
        rot = baseRot - spinSign * 6 * e;
        scale = 1 + .012 * e;
      } else if (raw < impactAt) {
        const e = 1 - Math.pow(1 - (raw - .12) / (impactAt - .12), 3);
        const fromX = sourceStartLeft - ux * 7;
        const fromY = sourceStartTop - uy * 7;
        x = fromX + (impactLeft - fromX) * e;
        y = fromY + (impactTop - fromY) * e - Math.sin(Math.PI * e) * 4;
        rot = baseRot - spinSign * 6 + spinSign * 36 * e;
        scale = 1.012 + .022 * e;

        if (!impactStarted && raw >= impactAt - .012) startImpactNow();
      } else if (raw < .76) {
        if (!impactStarted) startImpactNow();
        const e = 1 - Math.pow(1 - (raw - impactAt) / (.76 - impactAt), 2.7);
        x = impactLeft + (reboundLeft - impactLeft) * e;
        y = impactTop + (reboundTop - impactTop) * e - Math.sin(Math.PI * e) * reboundHop;
        rot = impactRot + normalizeDeg(reboundRot - impactRot) * e;
        scale = 1.034 - .015 * e + Math.sin(Math.PI * e) * .025;
      } else {
        const e = 1 - Math.pow(1 - (raw - .76) / .24, 3);
        x = reboundLeft + (settleLeft - reboundLeft) * e;
        y = reboundTop + (settleTop - reboundTop) * e - Math.sin(Math.PI * e) * 2;
        rot = reboundRot + normalizeDeg(settleRot - reboundRot) * e;
        scale = 1.019 - .019 * e;
      }

      sourceEl.style.left = `${x}px`;
      sourceEl.style.top = `${y}px`;
      sourceEl.style.transform =
        `translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`;

      if (raw < 1) {
        requestAnimationFrame(moveSource);
      } else {
        if (!impactStarted) startImpactNow();
        resolve();
      }
    }

    requestAnimationFrame(moveSource);
  });

  await sourcePromise;
  if (targetMotionPromise) await targetMotionPromise;

  source.x = (settleLeft / hostRect.width) * 100;
  source.y = (settleTop / hostRect.height) * 100;
  source.rotation = settleRot;
  source.src = frozenSrc;
  source.pose = frozenPose;
  sourceEl.src = frozenSrc;
  sourceEl.dataset.pose = frozenPose;
  sourceEl.style.left = `${source.x}%`;
  sourceEl.style.top = `${source.y}%`;
  sourceEl.style.transform =
    `translate(-50%,-50%) rotate(${source.rotation}deg)`;
  sourceEl.style.zIndex = '';
  sourceEl.style.pointerEvents = '';
  settlePieceNoOverlap(source, { carpet, keepInside: true });

  return {
    ux: dirX,
    uy: dirY,
    impactX,
    impactY,
    targetEndX: endX,
    targetEndY: endY,
    eject
  };
}


function getPieceCollisionRadius(piece) {
  const r = piece?.el?.getBoundingClientRect?.();
  if (!r) return 22;
  const base = Math.min(r.width, r.height);
  return clamp(base * (piece.type === 'khan' ? .34 : .30), 17, 42);
}

function getPieceCenterPx(piece, br = host.getBoundingClientRect()) {
  const r = piece?.el?.getBoundingClientRect?.();
  if (!r) return null;
  return {
    x: r.left + r.width / 2 - br.left,
    y: r.top + r.height / 2 - br.top
  };
}

function resolvePointNoOverlap(piece, x, y, {
  carpet = getCarpetGeometry(host.getBoundingClientRect()),
  keepInside = true,
  ignoreIds = [],
  reserved = []
} = {}) {
  const br = host.getBoundingClientRect();
  const radius = getPieceCollisionRadius(piece);
  const ignore = new Set(ignoreIds);
  let px = x;
  let py = y;

  const obstacles = [];
  for (const other of state.pieces) {
    if (!other?.el || other.collected || other.id === piece.id || ignore.has(other.id)) continue;
    const c = getPieceCenterPx(other, br);
    if (!c) continue;
    obstacles.push({
      x: c.x,
      y: c.y,
      radius: getPieceCollisionRadius(other) * (other.type === 'khan' ? 1.06 : 1)
    });
  }
  for (const p of reserved) obstacles.push(p);

  for (let pass = 0; pass < 9; pass++) {
    let changed = false;
    for (const o of obstacles) {
      let dx = px - o.x;
      let dy = py - o.y;
      let d = Math.hypot(dx, dy);
      const minDist = (radius + o.radius) * .94 + 2.5;
      if (d >= minDist) continue;

      if (d < .001) {
        const a = (piece.id.charCodeAt(piece.id.length - 1) || 1) * 1.618 + pass;
        dx = Math.cos(a);
        dy = Math.sin(a);
        d = 1;
      }
      const push = minDist - d + .6;
      px += (dx / d) * push;
      py += (dy / d) * push;
      changed = true;
    }

    if (keepInside && carpet?.radius) {
      const maxR = Math.max(20, carpet.radius - radius * .72);
      const dx = px - carpet.cx;
      const dy = py - carpet.cy;
      const d = Math.hypot(dx, dy);
      if (d > maxR) {
        const k = maxR / Math.max(1, d);
        px = carpet.cx + dx * k;
        py = carpet.cy + dy * k;
        changed = true;
      }
    }

    px = clamp(px, radius + 6, br.width - radius - 6);
    py = clamp(py, radius + 6, br.height - radius - 6);
    if (!changed) break;
  }

  return { x: px, y: py, radius };
}

function settlePieceNoOverlap(piece, options = {}) {
  if (!piece?.el || piece.collected) return null;
  const br = host.getBoundingClientRect();
  const c = getPieceCenterPx(piece, br);
  if (!c) return null;
  const resolved = resolvePointNoOverlap(piece, c.x, c.y, options);

  piece.x = (resolved.x / br.width) * 100;
  piece.y = (resolved.y / br.height) * 100;
  piece.el.style.left = `${piece.x}%`;
  piece.el.style.top = `${piece.y}%`;
  return resolved;
}

function resolveAllPieceOverlaps() {
  const br = host.getBoundingClientRect();
  const carpet = getCarpetGeometry(br);
  const khan = state.pieces.find(p => p.type === 'khan' && p.el && !p.collected);

  // Reset ordinary pieces to their intended model coordinates first. That makes
  // this pass independent of any entry/impact transforms still present in layout.
  for (const piece of state.pieces) {
    if (!piece?.el || piece.collected || piece.type === 'khan') continue;
    piece.el.getAnimations().forEach(anim => {
      try { if (anim.playState === 'finished') anim.cancel(); } catch {}
    });
    piece.el.style.left = `${piece.x}%`;
    piece.el.style.top = `${piece.y}%`;
    piece.el.style.transform = `translate(-50%,-50%) rotate(${piece.rotation}deg)`;
  }

  // Khan remains exactly where the game placed him.
  if (khan?.el) {
    khan.el.style.left = `${khan.x}%`;
    khan.el.style.top = `${khan.y}%`;
    khan.el.style.transform = `translate(-50%,-50%) rotate(${khan.rotation}deg)`;
  }

  // Resolve all final resting positions. Multiple light passes are preferable
  // to one large jump and leave a small visible gap between neighbouring chuko.
  for (let pass = 0; pass < 7; pass++) {
    let totalMove = 0;
    for (const piece of state.pieces) {
      if (!piece?.el || piece.collected || piece.type === 'khan') continue;
      const before = getPieceCenterPx(piece, br);
      const after = settlePieceNoOverlap(piece, { carpet, keepInside: true });
      if (before && after) totalMove += Math.hypot(after.x - before.x, after.y - before.y);
    }
    if (totalMove < 1.0) break;
  }
}


function nudgeNeighboringChuko(source, target, startX, startY, endX, endY, dirX, dirY, carpet) {
  const travel = Math.hypot(endX - startX, endY - startY);
  const corridorLength = Math.min(travel * .52, 112);
  const pathEndX = startX + dirX * corridorLength;
  const pathEndY = startY + dirY * corridorLength;
  const pathDx = pathEndX - startX;
  const pathDy = pathEndY - startY;
  const pathLen2 = Math.max(1, pathDx * pathDx + pathDy * pathDy);

  const candidates = [];
  const reserved = [];

  for (const p of state.pieces) {
    if (
      !p?.el ||
      p.collected ||
      p.type !== 'normal' ||
      p.id === source.id ||
      p.id === target.id
    ) continue;

    const r = p.el.getBoundingClientRect();
    const br = host.getBoundingClientRect();
    const cx = r.left + r.width / 2 - br.left;
    const cy = r.top + r.height / 2 - br.top;

    let u = ((cx - startX) * pathDx + (cy - startY) * pathDy) / pathLen2;
    u = clamp(u, 0, 1);
    const closestX = startX + pathDx * u;
    const closestY = startY + pathDy * u;
    const d = Math.hypot(cx - closestX, cy - closestY);
    const hitRadius = Math.max(26, (r.width + target.el.getBoundingClientRect().width) * .31);

    if (d <= hitRadius) candidates.push({ p, r, cx, cy, d, u });
  }

  candidates
    .sort((a, b) => (a.d + a.u * 24) - (b.d + b.u * 24))
    .slice(0, 3)
    .forEach(({ p, r, cx, cy, d }) => {
      const el = p.el;
      const radialLen = Math.max(.001, Math.hypot(cx - startX, cy - startY));
      const outwardX = (cx - startX) / radialLen;
      const outwardY = (cy - startY) / radialLen;
      const strength = clamp((1 - d / Math.max(30, r.width * .78)) * 15 + 6, 5, 17);

      let moveX = dirX * strength * .62 + outwardX * strength * .42;
      let moveY = dirY * strength * .48 + outwardY * strength * .32;
      let destX = cx + moveX;
      let destY = cy + moveY;

      const resolved = resolvePointNoOverlap(p, destX, destY, {
        carpet,
        keepInside: true,
        reserved
      });
      destX = resolved.x;
      destY = resolved.y;
      moveX = destX - cx;
      moveY = destY - cy;
      reserved.push({ x: destX, y: destY, radius: resolved.radius });

      const startRot = p.rotation;
      const cross = dirX * outwardY - dirY * outwardX;
      const turnSign = Math.sign(cross || (Math.random() - .5)) || 1;
      const turnMagnitude = 38 + strength * 2.15 + Math.random() * 18;
      const peakRot = normalizeDeg(startRot + turnSign * turnMagnitude * 1.12);
      const endRot = normalizeDeg(startRot + turnSign * turnMagnitude * .76);

      el.style.zIndex = '38';
      const anim = el.animate([
        {
          offset: 0,
          transform: `translate(-50%,-50%) rotate(${startRot}deg) scale(1)`,
          left: `${cx}px`,
          top: `${cy}px`
        },
        {
          offset: .44,
          transform: `translate(-50%,-50%) rotate(${peakRot}deg) scale(1.018)`,
          left: `${cx + moveX * .74}px`,
          top: `${cy + moveY * .74 - Math.max(3, strength * .22)}px`
        },
        {
          offset: 1,
          transform: `translate(-50%,-50%) rotate(${endRot}deg) scale(1)`,
          left: `${destX}px`,
          top: `${destY}px`
        }
      ], {
        duration: 285 + Math.random() * 90,
        easing: 'cubic-bezier(.18,.72,.22,1)',
        fill: 'forwards'
      });

      anim.finished.catch(() => {}).then(() => {
        const br2 = host.getBoundingClientRect();
        p.x = (destX / br2.width) * 100;
        p.y = (destY / br2.height) * 100;
        p.rotation = endRot;
        el.style.left = `${p.x}%`;
        el.style.top = `${p.y}%`;
        el.style.transform = `translate(-50%,-50%) rotate(${endRot}deg)`;
        el.style.zIndex = '';
        try { anim.cancel(); } catch {}
        settlePieceNoOverlap(p, { carpet, keepInside: true });
      });
    });
}

async function strikeKhan(source, khan) {
  state.phase = 'animating'; state.selectedSourceId = null; syncSelectorLock(); refreshPieceVisuals(); updateActionButton();
  const hit = await animateSourceToTarget(source, khan, true);
  if (!hit) return;
  kickKhan(khan.el, hit.ux, hit.uy);
  scenario.registerKhanHit();
  state.phase = 'settled';
  setObjective(scenario.resultText());
  celebrateKhan(khan.el);
  syncSelectorLock(); refreshPieceVisuals(); updateActionButton();
}

async function animateSourceToTarget(source, target, isKhan = false) {
  const sourceEl = source?.el;
  const targetEl = target?.el;
  if (!sourceEl || !targetEl) return null;

  // The real striker element moves. No clone, no hide/show swap:
  // visually it is always the same chuko and can never "turn into" the target.
  const frozenSrc = source.src;
  const frozenPose = source.pose;

  const hostRect = host.getBoundingClientRect();
  const sr = sourceEl.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const scx = sr.left + sr.width / 2;
  const scy = sr.top + sr.height / 2;
  const tcx = tr.left + tr.width / 2;
  const tcy = tr.top + tr.height / 2;

  const vx = tcx - scx;
  const vy = tcy - scy;
  const dist = Math.max(1, Math.hypot(vx, vy));
  const ux = vx / dist;
  const uy = vy / dist;

  // Clear visible contact: not short of the target and not in its centre.
  const contactGap = Math.max(22, (sr.width + tr.width) * (isKhan ? .32 : .29));
  const impactCx = tcx - ux * contactGap;
  const impactCy = tcy - uy * contactGap;

  const startLeft = scx - hostRect.left;
  const startTop = scy - hostRect.top;
  const endLeft = impactCx - hostRect.left;
  const endTop = impactCy - hostRect.top;

  const baseRot = source.rotation;
  const impactRot = normalizeDeg(baseRot + (ux >= 0 ? 34 : -34));

  sourceEl.classList.remove(
    'selected', 'source-ready', 'valid-target', 'invalid-target',
    'aim-candidate', 'pose-guide-match', 'pose-guide-dim'
  );
  sourceEl.style.zIndex = '90';
  sourceEl.style.pointerEvents = 'none';

  const anim = sourceEl.animate([
    {
      offset: 0,
      left: `${startLeft}px`,
      top: `${startTop}px`,
      transform: `translate(-50%,-50%) rotate(${baseRot}deg) scale(1)`
    },
    {
      offset: .14,
      left: `${startLeft - ux * 8}px`,
      top: `${startTop - uy * 8}px`,
      transform: `translate(-50%,-50%) rotate(${baseRot - (ux >= 0 ? 4 : -4)}deg) scale(1.015)`
    },
    {
      offset: .88,
      left: `${endLeft}px`,
      top: `${endTop}px`,
      transform: `translate(-50%,-50%) rotate(${impactRot}deg) scale(1.025)`
    },
    {
      offset: 1,
      left: `${endLeft}px`,
      top: `${endTop}px`,
      transform: `translate(-50%,-50%) rotate(${impactRot}deg) scale(1)`
    }
  ], {
    duration: 620,
    easing: 'cubic-bezier(.18,.72,.16,1)',
    fill: 'forwards'
  });

  await anim.finished.catch(() => {});

  const hitX = impactCx + ux * contactGap * .50;
  const hitY = impactCy + uy * contactGap * .50;
  createImpactBurst(hitX, hitY);

  source.x = (endLeft / hostRect.width) * 100;
  source.y = (endTop / hostRect.height) * 100;
  source.rotation = impactRot;

  // Explicitly preserve identity. The striker's image/color/pose never changes.
  source.src = frozenSrc;
  source.pose = frozenPose;
  sourceEl.src = frozenSrc;
  sourceEl.dataset.pose = frozenPose;
  sourceEl.style.left = `${source.x}%`;
  sourceEl.style.top = `${source.y}%`;
  sourceEl.style.transform = `translate(-50%,-50%) rotate(${source.rotation}deg)`;
  sourceEl.style.zIndex = '';
  sourceEl.style.pointerEvents = '';
  try { anim.cancel(); } catch {}

  return { ux, uy, impactCx, impactCy, hitX, hitY };
}

async function ejectTargetToCarpetEdge(target, ux, uy) {
  const el = target?.el;
  if (!el) return;

  const br = shell.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const localX = cx - br.left;
  const localY = cy - br.top;

  // Visible carpet boundary, deliberately inside the screen.
  const carpet = getCarpetGeometry(br);

  const px = localX - carpet.cx;
  const py = localY - carpet.cy;
  const A = (ux * ux) / (carpet.rx * carpet.rx) + (uy * uy) / (carpet.ry * carpet.ry);
  const B = 2 * ((px * ux) / (carpet.rx * carpet.rx) + (py * uy) / (carpet.ry * carpet.ry));
  const C = (px * px) / (carpet.rx * carpet.rx) + (py * py) / (carpet.ry * carpet.ry) - 1;
  const disc = Math.max(0, B * B - 4 * A * C);
  let t = (-B + Math.sqrt(disc)) / (2 * A);

  if (!Number.isFinite(t) || t < 28) t = Math.min(br.width * .18, 105);

  // Only a little beyond the carpet border — never to the viewport edge.
  t += Math.min(11, r.width * .10);

  let landX = localX + ux * t;
  let landY = localY + uy * t;
  const halfW = r.width * .52;
  const halfH = r.height * .52;

  landX = clamp(landX, halfW + 9, br.width - halfW - 9);
  landY = clamp(landY, halfH + 9, br.height - halfH - 9);

  const moveX = landX - localX;
  const moveY = landY - localY;
  const base = el.style.transform;
  const spin = (ux >= 0 ? 1 : -1) * (100 + Math.random() * 35);

  el.style.pointerEvents = 'none';
  el.style.zIndex = '75';

  const anim = el.animate([
    { offset: 0, transform: base },
    {
      offset: .18,
      transform: `${base} translate(${moveX * .12}px,${moveY * .12 - 7}px) rotate(${spin * .12}deg) scale(1.02)`
    },
    {
      offset: .64,
      transform: `${base} translate(${moveX * .70}px,${moveY * .70 - 12}px) rotate(${spin * .66}deg) scale(1.01)`
    },
    {
      offset: .90,
      transform: `${base} translate(${moveX}px,${moveY - 2}px) rotate(${spin}deg) scale(.985)`
    },
    {
      offset: 1,
      transform: `${base} translate(${moveX}px,${moveY}px) rotate(${spin * 1.03}deg) scale(.985)`
    }
  ], {
    duration: 790,
    easing: 'cubic-bezier(.18,.58,.22,1)',
    fill: 'forwards'
  });

  await anim.finished.catch(() => {});

  target.x = (landX / br.width) * 100;
  target.y = (landY / br.height) * 100;
  target.rotation = normalizeDeg(target.rotation + spin);
  el.style.left = `${target.x}%`;
  el.style.top = `${target.y}%`;
  el.style.transform = `translate(-50%,-50%) rotate(${target.rotation}deg)`;
  try { anim.cancel(); } catch {}
}

async function flyToSlot(piece, slotIndex) {
  const el = piece?.el, slot = document.querySelector(`.slot[data-slot-index="${slotIndex}"]`);
  if (!el || !slot) return;
  const a = el.getBoundingClientRect(), b = slot.getBoundingClientRect();
  const clone = el.cloneNode(true);
  Object.assign(clone.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, transform: 'none', zIndex: '10070', pointerEvents: 'none' });
  document.body.appendChild(clone);
  el.style.visibility = 'hidden';
  const endLeft = b.left + b.width * .12, endTop = b.top + b.height * .12;
  const midLeft = (a.left + endLeft) / 2;
  const midTop = Math.min(a.top, endTop) - Math.max(62, Math.abs(endLeft - a.left) * .12);
  const anim = clone.animate([
    { offset: 0, left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, opacity: 1, transform: 'rotate(0deg)' },
    { offset: .48, left: `${midLeft}px`, top: `${midTop}px`, width: `${a.width * .76}px`, height: `${a.height * .76}px`, opacity: .98, transform: 'rotate(145deg)' },
    { offset: 1, left: `${endLeft}px`, top: `${endTop}px`, width: `${b.width * .76}px`, height: `${b.height * .76}px`, opacity: .24, transform: 'rotate(285deg)' },
  ], { duration: 820, easing: 'cubic-bezier(.20,.66,.20,1)', fill: 'forwards' });
  await anim.finished.catch(() => {});
  clone.remove();
  el.remove();
  piece.el = null;
}


function animateMiss(source, target, missDx, missDy, onDone) {
  const el = source?.el;
  if (!el) { onDone?.(); return; }

  const hostRect = host.getBoundingClientRect();
  const sr = el.getBoundingClientRect();
  const sx = sr.left + sr.width / 2 - hostRect.left;
  const sy = sr.top + sr.height / 2 - hostRect.top;
  const sourceRot = source.rotation;

  let ux = -missDx;
  let uy = -missDy;
  let targetX = sx + ux;
  let targetY = sy + uy;

  if (target?.el) {
    const tr = target.el.getBoundingClientRect();
    const tx = tr.left + tr.width / 2 - hostRect.left;
    const ty = tr.top + tr.height / 2 - hostRect.top;
    const dx = tx - sx;
    const dy = ty - sy;
    const d = Math.max(1, Math.hypot(dx, dy));
    ux = dx / d;
    uy = dy / d;

    const sideX = -uy;
    const sideY = ux;
    const sideSign = Math.random() < .5 ? -1 : 1;
    const sideOffset = clamp((sr.width + tr.width) * .22, 24, 44) * sideSign;
    const shortOfTarget = clamp((sr.width + tr.width) * .18, 18, 34);

    // A deliberate near miss: it reaches the target area, passes just beside it,
    // then drops and stays there instead of disappearing.
    targetX = tx - ux * shortOfTarget + sideX * sideOffset;
    targetY = ty - uy * shortOfTarget + sideY * sideOffset;
  } else {
    const d = Math.max(1, Math.hypot(ux, uy));
    ux /= d; uy /= d;
    const travel = clamp(d * .90, 80, 135);
    targetX = sx + ux * travel;
    targetY = sy + uy * travel;
  }

  const halfW = sr.width * .52;
  const halfH = sr.height * .52;
  targetX = clamp(targetX, halfW + 8, hostRect.width - halfW - 8);
  targetY = clamp(targetY, halfH + 8, hostRect.height - halfH - 8);

  const landingRot = normalizeDeg(sourceRot + (ux >= 0 ? 55 : -55) + (Math.random() - .5) * 24);
  el.style.pointerEvents = 'none';
  el.style.zIndex = '90';

  const anim = el.animate([
    {
      offset: 0,
      left: `${sx}px`,
      top: `${sy}px`,
      opacity: 1,
      transform: `translate(-50%,-50%) rotate(${sourceRot}deg) scale(1)`
    },
    {
      offset: .58,
      left: `${sx + (targetX - sx) * .62}px`,
      top: `${sy + (targetY - sy) * .62 - 14}px`,
      opacity: 1,
      transform: `translate(-50%,-50%) rotate(${sourceRot + (landingRot - sourceRot) * .55}deg) scale(1.015)`
    },
    {
      offset: .92,
      left: `${targetX}px`,
      top: `${targetY - 3}px`,
      opacity: 1,
      transform: `translate(-50%,-50%) rotate(${landingRot}deg) scale(.99)`
    },
    {
      offset: 1,
      left: `${targetX}px`,
      top: `${targetY}px`,
      opacity: 1,
      transform: `translate(-50%,-50%) rotate(${landingRot}deg) scale(1)`
    }
  ], {
    duration: 620,
    easing: 'cubic-bezier(.18,.68,.20,1)',
    fill: 'forwards'
  });

  anim.finished.catch(() => {}).then(() => {
    source.x = (targetX / hostRect.width) * 100;
    source.y = (targetY / hostRect.height) * 100;
    source.rotation = landingRot;
    el.style.left = `${source.x}%`;
    el.style.top = `${source.y}%`;
    el.style.transform = `translate(-50%,-50%) rotate(${landingRot}deg)`;
    el.style.opacity = '1';
    el.style.visibility = '';
    el.style.zIndex = '';
    el.style.pointerEvents = '';
    try { anim.cancel(); } catch {}
    settlePieceNoOverlap(source, {
      carpet: getCarpetGeometry(host.getBoundingClientRect()),
      keepInside: true,
      ignoreIds: target?.id ? [target.id] : []
    });
    onDone?.();
  });
}

function kickKhan(el, ux, uy) {
  if (!el) return;
  const base = el.style.transform;
  el.animate([
    { transform: base },
    { transform: `${base} translate(${ux * 48}px,${uy * 34 - 14}px) rotate(${ux >= 0 ? 58 : -58}deg) scale(1.08)` },
    { transform: `${base} translate(${ux * 68}px,${uy * 48 - 20}px) rotate(${ux >= 0 ? 115 : -115}deg) scale(.98)` },
  ], { duration: 560, easing: 'cubic-bezier(.16,.72,.18,1)', fill: 'forwards' });
}

function createImpactBurst(x, y) {
  const burst = document.createElement('span');
  burst.className = 'impact-burst'; burst.style.left = `${x}px`; burst.style.top = `${y}px`;
  for (let i = 0; i < 8; i++) { const ray = document.createElement('i'); ray.style.transform = `rotate(${i * 45}deg) translateY(-5px)`; burst.appendChild(ray); }
  document.body.appendChild(burst);
  burst.animate([
    { opacity: 1, transform: 'translate(-50%,-50%) scale(.35)' },
    { opacity: .95, offset: .35, transform: 'translate(-50%,-50%) scale(1.1)' },
    { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' },
  ], { duration: 300, easing: 'ease-out' }).onfinish = () => burst.remove();
}

function isValidTarget(source, target) { return !!source && !!target && source.id !== target.id && source.type === 'normal' && target.type === 'normal' && !source.collected && !target.collected && source.pose === target.pose; }
function getValidTargets(source) { return state.pieces.filter(p => isValidTarget(source, p)); }
function getSelectedSource() { return state.pieces.find(p => p.id === state.selectedSourceId && !p.collected) || null; }
function getKhanPiece() { return state.pieces.find(p => p.type === 'khan' && !p.collected) || null; }

function refreshPieceVisuals() {
  const snap = scenario.snapshot(), source = getSelectedSource(), validIds = new Set(source && !snap.khanActive ? getValidTargets(source).map(p => p.id) : []);
  for (const p of state.pieces) {
    if (!p.el || p.collected) continue;
    p.el.classList.remove('selected', 'source-ready', 'valid-target', 'invalid-target', 'pose-guide-match', 'pose-guide-dim');
    if (p.type === 'normal') {
      if (p.id === state.selectedSourceId) p.el.classList.add('selected');
      else if (source) {
        if (snap.khanActive) p.el.classList.add('invalid-target');
        else p.el.classList.add(validIds.has(p.id) ? 'valid-target' : 'invalid-target');
      } else if (getValidTargets(p).length > 0) p.el.classList.add('source-ready');
      if (!source && state.guideFilter) p.el.classList.add(p.pose === state.guideFilter ? 'pose-guide-match' : 'pose-guide-dim');
    } else if (p.type === 'khan') p.el.classList.toggle('active', snap.khanActive);
  }
}

function updateGuideButtons() { if (!state.poseGuide) return; state.poseGuide.panel.querySelectorAll('.pose-guide-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.pose === state.guideFilter)); }
function resetSlotDom() { document.querySelectorAll('.slot').forEach(slot => { slot.innerHTML = ''; slot.classList.remove('filled'); }); document.getElementById('upayZone1').classList.remove('complete'); document.getElementById('upayZone2').classList.remove('complete'); }
function updateSlotDom(index, piece) { const slot = document.querySelector(`.slot[data-slot-index="${index}"]`); if (!slot) return; const img = document.createElement('img'); img.src = piece.src; slot.innerHTML = ''; slot.appendChild(img); slot.classList.add('filled'); }
function updateProgress() { const c1 = state.slots.slice(0, 3).filter(Boolean).length, c2 = state.slots.slice(3, 6).filter(Boolean).length; document.getElementById('zone1Progress').textContent = `${c1}/3`; document.getElementById('zone2Progress').textContent = `${c2}/3`; document.getElementById('upayZone1').classList.toggle('complete', c1 === 3); document.getElementById('upayZone2').classList.toggle('complete', c2 === 3); }

function scenarioLabel(code) { return code.replaceAll('_', ' + '); }
function setObjective(text) { state.lastObjective = text; document.getElementById('objective').textContent = text; }
function setObjectiveFromScenario() { const s = scenario.snapshot(); if (s.finished) return setObjective(scenario.resultText()); if (s.khanActive) return setObjective('ХАН! Выбери чуко-биту, оттяни назад и отпусти'); if (s.failedStrikeRequired) return setObjective('Последний бросок — оттяни чуко и отпусти'); if (s.collected === 0) return setObjective(`${document.getElementById('demoToggle').checked ? 'DEMO ' : ''}${scenarioLabel(s.scenario)} • Выбери чуко-биту`); setObjective(`${document.getElementById('demoToggle').checked ? 'DEMO ' : ''}${scenarioLabel(s.scenario)} • собрано ${s.collected}/${s.normalLimit}`); }
let flashTimer = null;
function flashObjective(text) { clearTimeout(flashTimer); const old = state.lastObjective; document.getElementById('objective').textContent = text; flashTimer = setTimeout(() => { document.getElementById('objective').textContent = old; }, 1250); }
function pulse(el, scale = 1.12) { if (!el) return; const base = el.style.transform; el.animate([{ transform: base }, { transform: `${base} scale(${scale})` }, { transform: base }], { duration: 340, easing: 'ease-out' }); }
function celebrateKhan(el) { if (!el) return; const base = el.style.transform; el.animate([{ filter: 'drop-shadow(0 0 8px #ffd36a)', transform: base }, { filter: 'drop-shadow(0 0 30px #ffd36a) drop-shadow(0 0 45px #fff1a0)', transform: `${base} scale(1.18)` }, { filter: 'drop-shadow(0 0 8px #ffd36a)', transform: base }], { duration: 850, easing: 'ease-in-out' }); }
function normalizeAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function normalizeDeg(a) { let n = a % 360; if (n > 180) n -= 360; if (n < -180) n += 360; return n; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

window.UPAY2D = {
  setDenominations(list, selected = null) { const valid = [...new Set((list || []).map(Number).filter(v => Number.isFinite(v) && v > 0))]; if (!valid.length) return; state.denominations = valid; const req = Number(selected); state.denomination = valid.includes(req) ? req : valid[0]; syncStakeUI(); },
  getDenomination() { return state.denomination; },
  setScenario(code) { if (!Object.values(SCENARIOS).includes(code)) return false; state.externalScenarioCode = code; startNewGame(); return true; },
  clearScenarioOverride() { state.externalScenarioCode = null; },
  getScenario() { return scenario.snapshot(); },
  getTuning() { return { ...tuning }; },
  setTuning(partial = {}) {
    Object.keys(DEFAULT_TUNING).forEach(key => {
      if (Number.isFinite(Number(partial[key]))) tuning[key] = Number(partial[key]);
    });
    applyTuning();
    rerollPreviewLayout();
    return { ...tuning };
  },
};
