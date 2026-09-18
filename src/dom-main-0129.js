import { CONFIG } from './config.js';
import { ScenarioEngine, SCENARIOS } from './scenario-engine.js';

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

injectStyles();
setupUI();
startNewGame();

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #pixiHost{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}
    .game-piece{position:absolute;transform:translate(-50%,-50%);transform-origin:center;object-fit:contain;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-drag:none;touch-action:none;filter:drop-shadow(0 6px 5px rgba(0,0,0,.24));transition:filter .14s ease,opacity .14s ease}
    .game-piece.normal{width:14.7%}
    .game-piece.khan{width:16.2%;z-index:25}
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
      .game-piece.normal{width:15.2%}.game-piece.khan{width:16.7%}
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
  state.pieces.push({
    id: 'KHAN',
    type: 'khan',
    src: khanFiles[Math.floor(Math.random() * khanFiles.length)],
    x: 47 + Math.random() * 6,
    y: 43 + Math.random() * 4,
    rotation: -8 + Math.random() * 16,
    spawnDx: -70,
    spawnDy: 25,
    collected: false,
    el: null,
  });
}

function makeRandomScatter(count) {
  const out = [];
  const cx = 50, cy = 45.2, rx = 34, ry = 12.8;
  let minDist = 11.8;
  for (let i = 0; i < count; i++) {
    let best = null;
    for (let attempt = 0; attempt < 300; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(0.10 + Math.random() * 0.90);
      const p = {
        x: cx + Math.cos(a) * rx * r + (Math.random() - .5) * 2.4,
        y: cy + Math.sin(a) * ry * r + (Math.random() - .5) * 1.3,
      };
      if (p.x < 14 || p.x > 86 || p.y < 31.5 || p.y > 59.5) continue;
      const score = out.length ? Math.min(...out.map(q => Math.hypot((p.x - q.x), (p.y - q.y) * 2.6))) : 99;
      if (!best || score > best.score) best = { ...p, score };
      if (score >= minDist) { best = { ...p, score }; break; }
    }
    out.push({ x: best.x, y: best.y });
    if (i > 9) minDist = 10.7;
  }
  return shuffled(out);
}

function renderPieces() {
  host.innerHTML = '';
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
    animateMiss(source, missDx, missDy, () => {
      scenario.registerFailedStrike(); state.phase = 'settled'; state.selectedSourceId = null; setObjective(scenario.resultText()); syncSelectorLock(); refreshPieceVisuals(); updateActionButton();
    });
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
  state.phase = 'animating'; state.selectedSourceId = null; syncSelectorLock(); refreshPieceVisuals(); updateActionButton();
  if (!scenario.canCollectNormal()) { state.phase = 'idle'; setObjectiveFromScenario(); syncSelectorLock(); refreshPieceVisuals(); updateActionButton(); return; }
  const nextSlot = state.slots.findIndex(v => v === null);
  if (nextSlot < 0) { state.phase = 'idle'; syncSelectorLock(); updateActionButton(); return; }
  target.collected = true;
  state.slots[nextSlot] = { id: target.id, type: target.type, src: target.src, pose: target.pose };
  scenario.registerCollection();

  const hit = await animateSourceToTarget(source, target);
  if (!hit) return;
  await ejectTargetToCarpetEdge(target, hit.ux, hit.uy);
  await sleep(240);
  await flyToSlot(target, nextSlot);

  updateSlotDom(nextSlot, target);
  updateProgress();
  const after = scenario.snapshot();
  if (after.finished) { state.phase = 'settled'; setObjective(scenario.resultText()); }
  else if (after.khanActive) { state.phase = 'idle'; setObjective('ХАН активирован! Выбери чуко-биту, оттяни и отпусти'); getKhanPiece()?.el?.classList.add('active'); pulse(getKhanPiece()?.el, 1.13); }
  else if (after.failedStrikeRequired) { state.phase = 'idle'; setObjective('Последний удар: оттяни чуко и отпусти — следующий бросок будет промахом'); }
  else { state.phase = 'idle'; setObjectiveFromScenario(); }
  syncSelectorLock(); refreshPieceVisuals(); updateActionButton();
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
  const sourceEl = source?.el, targetEl = target?.el;
  if (!sourceEl || !targetEl) return null;

  // Freeze the identity of the striker: no pose/color/src changes are allowed.
  const frozenSrc = source.src;
  const frozenPose = source.pose;

  const sr = sourceEl.getBoundingClientRect();
  const tr = targetEl.getBoundingClientRect();
  const scx = sr.left + sr.width / 2;
  const scy = sr.top + sr.height / 2;
  const tcx = tr.left + tr.width / 2;
  const tcy = tr.top + tr.height / 2;
  const dx = tcx - scx;
  const dy = tcy - scy;
  const d = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / d;
  const uy = dy / d;

  // Stop the striker before the target centre so both pieces are visibly
  // separate at impact. This avoids the old "replacement" effect.
  const contactGap = Math.max(
    24,
    (sr.width + tr.width) * (isKhan ? 0.36 : 0.34)
  );
  const impactCx = tcx - ux * contactGap;
  const impactCy = tcy - uy * contactGap;
  const endLeft = impactCx - sr.width / 2;
  const endTop = impactCy - sr.height / 2;

  const clone = sourceEl.cloneNode(true);
  clone.classList.remove(
    'selected', 'source-ready', 'valid-target', 'invalid-target',
    'aim-candidate', 'pose-guide-match', 'pose-guide-dim'
  );
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${sr.left}px`,
    top: `${sr.top}px`,
    width: `${sr.width}px`,
    height: `${sr.height}px`,
    margin: '0',
    transform: 'none',
    zIndex: '10080',
    pointerEvents: 'none',
    opacity: '1'
  });
  document.body.appendChild(clone);
  sourceEl.style.visibility = 'hidden';

  const back = 9;
  const backLeft = sr.left - ux * back;
  const backTop = sr.top - uy * back;
  const spin = ux >= 0 ? 82 : -82;

  const anim = clone.animate([
    {
      offset: 0,
      left: `${sr.left}px`,
      top: `${sr.top}px`,
      transform: 'rotate(0deg) scale(1)'
    },
    {
      offset: .16,
      left: `${backLeft}px`,
      top: `${backTop}px`,
      transform: `rotate(${-spin * .08}deg) scale(1.015)`
    },
    {
      offset: .84,
      left: `${endLeft}px`,
      top: `${endTop}px`,
      transform: `rotate(${spin * .82}deg) scale(1.025)`
    },
    {
      offset: 1,
      left: `${endLeft}px`,
      top: `${endTop}px`,
      transform: `rotate(${spin}deg) scale(1)`
    }
  ], {
    duration: 650,
    easing: 'cubic-bezier(.20,.70,.16,1)',
    fill: 'forwards'
  });

  await anim.finished.catch(() => {});

  // Flash exactly at the visible contact area, between both pieces.
  const hitX = impactCx + ux * contactGap * .48;
  const hitY = impactCy + uy * contactGap * .48;
  createImpactBurst(hitX, hitY);

  clone.remove();

  const br = shell.getBoundingClientRect();
  source.x = ((impactCx - br.left) / br.width) * 100;
  source.y = ((impactCy - br.top) / br.height) * 100;
  source.rotation = normalizeDeg(source.rotation + (ux >= 0 ? 7 : -7));

  // Reassert the same asset/pose explicitly after the strike.
  source.src = frozenSrc;
  source.pose = frozenPose;
  sourceEl.src = frozenSrc;
  sourceEl.dataset.pose = frozenPose;
  sourceEl.style.left = `${source.x}%`;
  sourceEl.style.top = `${source.y}%`;
  sourceEl.style.transform = `translate(-50%,-50%) rotate(${source.rotation}deg)`;
  sourceEl.style.visibility = '';

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
  const carpet = {
    cx: br.width * .50,
    cy: br.height * .455,
    rx: br.width * .405,
    ry: br.height * .155
  };

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

  landX = clamp(landX, halfW + br.width * .055, br.width - halfW - br.width * .055);
  landY = clamp(landY, br.height * .315 + halfH, br.height * .595 - halfH);

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

function animateMiss(source, missDx, missDy, onDone) {\n  const frozenSrc = source?.src;\n  const frozenPose = source?.pose;
  const el = source?.el;
  if (!el) { onDone?.(); return; }
  const a = el.getBoundingClientRect(), sx = a.left, sy = a.top, sw = a.width, sh = a.height;
  const dx = -missDx || 70, dy = -missDy || -20, d = Math.max(1, Math.hypot(dx, dy)), ux = dx / d, uy = dy / d;
  const clone = el.cloneNode(true);
  Object.assign(clone.style, { position: 'fixed', left: `${sx}px`, top: `${sy}px`, width: `${sw}px`, height: `${sh}px`, margin: '0', transform: 'none', zIndex: '10080', pointerEvents: 'none' });
  document.body.appendChild(clone); el.style.visibility = 'hidden';
  clone.animate([
    { left: `${sx}px`, top: `${sy}px`, opacity: 1, transform: 'rotate(0deg)' },
    { left: `${sx + ux * 120}px`, top: `${sy + uy * 120 - 10}px`, opacity: .96, transform: 'rotate(150deg)' },
    { left: `${sx + ux * 165}px`, top: `${sy + uy * 165}px`, opacity: 0, transform: 'rotate(260deg)' },
  ], { duration: 760, easing: 'cubic-bezier(.18,.7,.2,1)', fill: 'forwards' }).onfinish = () => { clone.remove(); if (frozenSrc && el) el.src = frozenSrc; if (frozenPose && el) el.dataset.pose = frozenPose; el.style.visibility = ''; onDone?.(); };
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
};
