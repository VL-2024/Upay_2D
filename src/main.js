import { Application, Assets, Container, Graphics, Sprite } from 'https://cdn.jsdelivr.net/npm/pixi.js@8.2.6/+esm';
import { CONFIG } from './config.js';
import { ScenarioEngine, SCENARIOS } from './scenario-engine.js';

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

const scenario = new ScenarioEngine();
const state = {
  denomination: CONFIG.defaultDenomination,
  denominations: [...CONFIG.denominations],
  currency: CONFIG.currency,
  phase: 'idle', // idle -> aiming -> animating -> settled
  pieces: [],
  slots: Array(CONFIG.zones.totalSlots).fill(null),
  selectedSourceId: null,
  lastObjective: '',
  demoHasStarted: false,
  externalScenarioCode: null,
};

const host = document.getElementById('pixiHost');
const app = new Application();
await app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true });
host.appendChild(app.canvas);
app.stage.sortableChildren = true;

const textures = await loadTextures();
const pieceLayer = new Container();
pieceLayer.sortableChildren = true;
app.stage.addChild(pieceLayer);

const fxLayer = new Container();
fxLayer.sortableChildren = true;
app.stage.addChild(fxLayer);

const selectionRing = new Graphics();
selectionRing.visible = false;
selectionRing.zIndex = 50;
fxLayer.addChild(selectionRing);

setupUI();
startNewGame();
window.addEventListener('resize', () => rebuildPieceSprites(false));

async function loadTextures() {
  const loaded = {};
  for (const path of [...chukoFiles, ...khanFiles]) loaded[path] = await Assets.load(path);
  return loaded;
}

function setupUI() {
  ensureSlots('zone1', 0);
  ensureSlots('zone2', 3);
  renderStakeMenu();
  syncStakeUI();

  document.getElementById('stakeSelect').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!selectorInteractive()) return;
    const menu = document.getElementById('stakeMenu');
    menu.hidden = !menu.hidden;
    document.getElementById('stakeSelect').setAttribute('aria-expanded', String(!menu.hidden));
  });

  document.getElementById('stakeMenu').addEventListener('click', (e) => {
    const option = e.target.closest('.stake-option');
    if (!option || !selectorInteractive()) return;
    selectDenomination(Number(option.dataset.value));
  });

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.status-panel')) closeStakeMenu();
  });

  document.getElementById('newGameBtn').addEventListener('click', startNewGame);
}

function selectorInteractive() {
  return state.phase === 'idle' || state.phase === 'settled';
}

function selectDenomination(value) {
  const n = Number(value);
  if (!selectorInteractive() || !state.denominations.includes(n)) return;
  state.denomination = n;
  syncStakeUI();
  closeStakeMenu();

  if (window.X2LMS?.emit) {
    window.X2LMS.emit('X2_GAME_DENOMINATION_CHANGED', {
      gameId: 'UPAY',
      denomination: n,
      currency: 'KGS',
      language: 'RU',
    });
  }
}

function renderStakeMenu() {
  const menu = document.getElementById('stakeMenu');
  menu.innerHTML = state.denominations.map(v =>
    `<button type="button" class="stake-option${v === state.denomination ? ' selected' : ''}" data-value="${v}">${v} ${state.currency}</button>`
  ).join('');
}

function syncStakeUI() {
  document.getElementById('stakeValue').textContent = state.denomination;
  document.getElementById('currencyValue').textContent = state.currency;
  document.getElementById('betLabel').textContent = `${state.denomination} ${state.currency}`;
  renderStakeMenu();
  syncSelectorLock();
}

function syncSelectorLock() {
  const locked = !selectorInteractive();
  document.getElementById('stakeSelect').classList.toggle('locked', locked);
  if (locked) closeStakeMenu();
}

function closeStakeMenu() {
  const menu = document.getElementById('stakeMenu');
  menu.hidden = true;
  document.getElementById('stakeSelect').setAttribute('aria-expanded', 'false');
}

function ensureSlots(zoneId, startIndex) {
  const zone = document.getElementById(zoneId);
  zone.innerHTML = '';
  for (let i = 0; i < CONFIG.zones.slotsPerUpay; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slotIndex = String(startIndex + i);
    zone.appendChild(slot);
  }
}

function startNewGame() {
  closeStakeMenu();
  state.phase = 'idle';
  state.selectedSourceId = null;
  state.slots = Array(CONFIG.zones.totalSlots).fill(null);

  const demoMode = document.getElementById('demoToggle').checked;
  if (state.externalScenarioCode) {
    scenario.setScenario(state.externalScenarioCode);
  } else if (demoMode) {
    scenario.reset({ advanceDemo: state.demoHasStarted });
    state.demoHasStarted = true;
  } else {
    state.demoHasStarted = false;
    scenario.setScenario(SCENARIOS.TWO);
  }

  buildPieces();
  resetSlotDom();
  updateProgress();
  setObjectiveFromScenario();
  rebuildPieceSprites(true);
  syncSelectorLock();
}

function buildPieces() {
  state.pieces = [];
  for (let i = 0; i < CONFIG.pieces.normalCount; i++) {
    state.pieces.push({
      id: `C${i + 1}`,
      type: 'normal',
      textureKey: chukoFiles[i % chukoFiles.length],
      xNorm: 0,
      yNorm: 0,
      rotation: 0,
      scaleBase: 0.16,
      collected: false,
      sprite: null,
    });
  }
  state.pieces.push({
    id: 'KHAN',
    type: 'khan',
    textureKey: khanFiles[Math.floor(Math.random() * khanFiles.length)],
    xNorm: 0.5,
    yNorm: 0.455,
    rotation: (Math.random() - 0.5) * 0.18,
    scaleBase: CONFIG.pieces.khanScale,
    collected: false,
    sprite: null,
  });
  randomizeLayout();
}

function randomizeLayout() {
  const normal = state.pieces.filter(p => p.type === 'normal');
  const anchors = [
    [0.20,0.345],[0.34,0.325],[0.48,0.345],[0.62,0.325],[0.77,0.348],
    [0.16,0.425],[0.30,0.455],[0.42,0.420],[0.61,0.445],[0.77,0.432],
    [0.20,0.535],[0.36,0.515],[0.54,0.535],[0.70,0.505],[0.82,0.545],
  ];
  normal.forEach((p, i) => {
    const [ax, ay] = anchors[i % anchors.length];
    p.xNorm = ax + (Math.random() - 0.5) * 0.025;
    p.yNorm = ay + (Math.random() - 0.5) * 0.020;
    p.rotation = (Math.random() - 0.5) * 0.70;
    p.scaleBase = CONFIG.pieces.scaleMin + Math.random() * (CONFIG.pieces.scaleMax - CONFIG.pieces.scaleMin);
  });
}

function rebuildPieceSprites(animate) {
  pieceLayer.removeChildren();
  selectionRing.visible = false;
  for (const p of state.pieces) {
    if (p.collected) continue;
    const sprite = new Sprite(textures[p.textureKey]);
    sprite.anchor.set(0.5);
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.on('pointertap', () => onPieceTap(p));
    p.sprite = sprite;
    pieceLayer.addChild(sprite);
    positionSprite(p);
    if (animate) animateScatterIn(p);
  }
  refreshPieceVisuals();
}

function positionSprite(p) {
  if (!p.sprite) return;
  const w = app.renderer.width;
  const h = app.renderer.height;
  p.sprite.x = p.xNorm * w;
  p.sprite.y = p.yNorm * h;
  p.sprite.rotation = p.rotation;
  const responsive = w / 941;
  p.sprite.scale.set(p.scaleBase * responsive);
  p.sprite.zIndex = p.type === 'khan' ? 20 : 5;
}

function onPieceTap(piece) {
  if (piece.collected || state.phase === 'animating' || state.phase === 'settled') return;

  const snap = scenario.snapshot();
  if (piece.type === 'khan') return onKhanTap(piece, snap);

  if (snap.khanActive) {
    flashObjective('ХАН активирован — нажми на Хана');
    pulseSprite(getKhanPiece()?.sprite);
    return;
  }

  const source = getSelectedSource();
  if (!source) {
    state.selectedSourceId = piece.id;
    state.phase = 'aiming';
    setObjective(snap.failedStrikeRequired ? 'Последний удар — попробуй выбить ещё один чуко' : 'Теперь выбери чуко-цель');
    refreshPieceVisuals();
    return;
  }

  if (source.id === piece.id) {
    state.selectedSourceId = null;
    state.phase = 'idle';
    setObjectiveFromScenario();
    refreshPieceVisuals();
    return;
  }

  strikeTarget(source, piece, snap);
}

function onKhanTap(khanPiece, snap) {
  if (!snap.khanActive) {
    flashObjective(snap.khanRequired ? 'Сначала собери нужные чуко' : 'В этом сценарии Хан не используется');
    pulseSprite(khanPiece.sprite);
    return;
  }
  state.phase = 'settled';
  state.selectedSourceId = null;
  scenario.registerKhanHit();
  setObjective(scenario.resultText());
  syncSelectorLock();
  celebrateKhan(khanPiece);
  refreshPieceVisuals();
}

function strikeTarget(source, target, snap) {
  state.phase = 'animating';
  syncSelectorLock();
  state.selectedSourceId = null;
  refreshPieceVisuals();
  animateStrike(source, target);

  if (snap.failedStrikeRequired) {
    pulseSprite(target.sprite);
    window.setTimeout(() => {
      scenario.registerFailedStrike();
      state.phase = 'settled';
      setObjective(scenario.resultText());
      syncSelectorLock();
    }, 280);
    return;
  }

  if (!scenario.canCollectNormal()) {
    state.phase = 'idle';
    setObjectiveFromScenario();
    syncSelectorLock();
    return;
  }

  const nextSlot = state.slots.findIndex(v => v === null);
  if (nextSlot < 0) {
    state.phase = 'settled';
    syncSelectorLock();
    return;
  }

  target.collected = true;
  state.slots[nextSlot] = { id: target.id, type: target.type, textureKey: target.textureKey };
  updateSlotDom(nextSlot, target.textureKey);
  scenario.registerCollection();
  updateProgress();

  animateToSlot(target, nextSlot, () => {
    const after = scenario.snapshot();
    if (after.finished) {
      state.phase = 'settled';
      setObjective(scenario.resultText());
    } else if (after.khanActive) {
      state.phase = 'idle';
      setObjective('ХАН активирован! Нажми на Хана');
      pulseSprite(getKhanPiece()?.sprite);
    } else if (after.failedStrikeRequired) {
      state.phase = 'idle';
      setObjective('Последний удар — попробуй выбить ещё один чуко');
    } else {
      state.phase = 'idle';
      setObjectiveFromScenario();
    }
    syncSelectorLock();
  });
}

function getSelectedSource() {
  return state.pieces.find(p => p.id === state.selectedSourceId && !p.collected) || null;
}

function getKhanPiece() {
  return state.pieces.find(p => p.type === 'khan' && !p.collected) || null;
}

function refreshPieceVisuals() {
  const snap = scenario.snapshot();
  for (const p of state.pieces) {
    if (!p.sprite || p.collected) continue;
    const selected = p.id === state.selectedSourceId;
    p.sprite.tint = selected ? CONFIG.ui.selectedTint : 0xffffff;
    p.sprite.alpha = 1;
    p.sprite.zIndex = selected ? 40 : (p.type === 'khan' ? 20 : 5);
    if (p.type === 'khan' && !snap.khanActive) p.sprite.alpha = 0.95;
  }
  updateSelectionRing();
}

function updateSelectionRing() {
  const source = getSelectedSource();
  selectionRing.clear();
  if (!source?.sprite) {
    selectionRing.visible = false;
    return;
  }
  const sprite = source.sprite;
  const w = sprite.width;
  const h = sprite.height;
  selectionRing.visible = true;
  selectionRing.position.set(sprite.x, sprite.y);
  selectionRing.rotation = sprite.rotation;
  selectionRing.ellipse(0, 0, w * 0.44, h * 0.40);
  selectionRing.stroke({ color: CONFIG.ui.selectedGlow, width: 4, alpha: 0.95 });
  selectionRing.ellipse(0, 0, w * 0.52, h * 0.48);
  selectionRing.stroke({ color: 0xffffff, width: 1.5, alpha: 0.85 });
}

function resetSlotDom() {
  document.querySelectorAll('.slot').forEach(slot => {
    slot.innerHTML = '';
    slot.classList.remove('filled');
  });
  document.getElementById('upayZone1').classList.remove('complete');
  document.getElementById('upayZone2').classList.remove('complete');
}

function updateSlotDom(slotIndex, textureKey) {
  const slot = document.querySelector(`.slot[data-slot-index="${slotIndex}"]`);
  if (!slot) return;
  const img = document.createElement('img');
  img.src = textureKey.replace('./', '');
  slot.innerHTML = '';
  slot.appendChild(img);
  slot.classList.add('filled');
}

function updateProgress() {
  const c1 = state.slots.slice(0, 3).filter(Boolean).length;
  const c2 = state.slots.slice(3, 6).filter(Boolean).length;
  document.getElementById('zone1Progress').textContent = `${c1}/3`;
  document.getElementById('zone2Progress').textContent = `${c2}/3`;
  document.getElementById('upayZone1').classList.toggle('complete', c1 === 3);
  document.getElementById('upayZone2').classList.toggle('complete', c2 === 3);
}

function scenarioLabel(code) {
  return code.replace('_', ' + ');
}

function setObjective(text) {
  state.lastObjective = text;
  document.getElementById('objective').textContent = text;
}

function setObjectiveFromScenario() {
  const snap = scenario.snapshot();
  let text = '';
  if (snap.finished) text = scenario.resultText();
  else if (snap.khanActive) text = 'ХАН активирован! Нажми на Хана';
  else if (snap.failedStrikeRequired) text = 'Последний удар — попробуй выбить ещё один чуко';
  else if (snap.collected === 0) text = `DEMO ${scenarioLabel(snap.scenario)} • Выбери чуко-биту`;
  else text = `DEMO ${scenarioLabel(snap.scenario)} • собрано ${snap.collected}/${snap.normalLimit}`;
  setObjective(text);
}

let flashTimer = null;
function flashObjective(text) {
  if (flashTimer) clearTimeout(flashTimer);
  const current = state.lastObjective;
  document.getElementById('objective').textContent = text;
  flashTimer = setTimeout(() => {
    document.getElementById('objective').textContent = current;
    flashTimer = null;
  }, 1200);
}

function animateToSlot(piece, slotIndex, onDone) {
  const sprite = piece.sprite;
  if (!sprite) return onDone?.();
  const slotEl = document.querySelector(`.slot[data-slot-index="${slotIndex}"]`);
  if (!slotEl) return onDone?.();
  const slotRect = slotEl.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const tx = slotRect.left - hostRect.left + slotRect.width / 2;
  const ty = slotRect.top - hostRect.top + slotRect.height / 2;
  const sx = sprite.x, sy = sprite.y, ss = sprite.scale.x;
  const targetScale = ss * 0.42;
  let f = 0;
  const duration = 24;
  app.ticker.add(tick);
  function tick() {
    f++;
    const t = Math.min(1, f / duration);
    const e = 1 - Math.pow(1 - t, 3);
    sprite.x = sx + (tx - sx) * e;
    sprite.y = sy + (ty - sy) * e - Math.sin(Math.PI * e) * 28;
    sprite.rotation += 0.06;
    sprite.scale.set(ss + (targetScale - ss) * e);
    sprite.alpha = 1 - e * 0.88;
    if (t >= 1) {
      app.ticker.remove(tick);
      sprite.destroy();
      piece.sprite = null;
      onDone?.();
    }
  }
}

function animateScatterIn(piece) {
  const sprite = piece.sprite;
  if (!sprite) return;
  const tx = sprite.x, ty = sprite.y, ts = sprite.scale.x;
  sprite.x = app.renderer.width * 0.5;
  sprite.y = app.renderer.height * 0.44;
  sprite.scale.set(ts * 0.35);
  sprite.alpha = 0;
  let f = 0;
  const duration = 22 + Math.floor(Math.random() * 10);
  app.ticker.add(tick);
  function tick() {
    f++;
    const t = Math.min(1, f / duration);
    const e = 1 - Math.pow(1 - t, 3);
    sprite.x = app.renderer.width * 0.5 + (tx - app.renderer.width * 0.5) * e;
    sprite.y = app.renderer.height * 0.44 + (ty - app.renderer.height * 0.44) * e;
    sprite.scale.set(ts * (0.35 + 0.65 * e));
    sprite.alpha = e;
    if (t >= 1) app.ticker.remove(tick);
  }
}

function animateStrike(source, target) {
  const sprite = source.sprite;
  if (!sprite || !target.sprite) return;
  const startX = sprite.x;
  const startY = sprite.y;
  const dx = (target.sprite.x - sprite.x) * 0.18;
  const dy = (target.sprite.y - sprite.y) * 0.18;
  let f = 0;
  const duration = 12;
  app.ticker.add(tick);
  function tick() {
    f++;
    const t = Math.min(1, f / duration);
    const forward = t < 0.5 ? t * 2 : (1 - t) * 2;
    sprite.x = startX + dx * forward;
    sprite.y = startY + dy * forward;
    if (t >= 1) {
      sprite.x = startX;
      sprite.y = startY;
      app.ticker.remove(tick);
    }
  }
}

function pulseSprite(sprite) {
  if (!sprite) return;
  const base = sprite.scale.x;
  let f = 0;
  const duration = 16;
  app.ticker.add(tick);
  function tick() {
    f++;
    const t = Math.min(1, f / duration);
    const amp = Math.sin(t * Math.PI) * 0.12;
    sprite.scale.set(base * (1 + amp));
    if (t >= 1) {
      sprite.scale.set(base);
      app.ticker.remove(tick);
    }
  }
}

function celebrateKhan(piece) {
  if (!piece?.sprite) return;
  pulseSprite(piece.sprite);
  const burst = new Graphics();
  burst.zIndex = 100;
  burst.position.set(piece.sprite.x, piece.sprite.y);
  fxLayer.addChild(burst);
  let f = 0;
  const duration = 28;
  app.ticker.add(tick);
  function tick() {
    f++;
    const t = Math.min(1, f / duration);
    const r = 30 + 70 * t;
    burst.clear();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 / 10) * i;
      burst.moveTo(0, 0);
      burst.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      burst.stroke({ color: i % 2 ? 0xffffff : 0xf0c66c, width: 3, alpha: 1 - t });
    }
    burst.alpha = 1 - t;
    if (t >= 1) {
      app.ticker.remove(tick);
      burst.destroy();
    }
  }
}

window.UPAY2D = {
  setDenominations(list, selected = null) {
    const valid = [...new Set((list || []).map(Number).filter(v => Number.isFinite(v) && v > 0))];
    if (!valid.length) return;
    state.denominations = valid;
    const requested = Number(selected);
    state.denomination = valid.includes(requested) ? requested : valid[0];
    syncStakeUI();
  },
  getDenomination() { return state.denomination; },
  setScenario(code) {
    if (!Object.values(SCENARIOS).includes(code)) return false;
    state.externalScenarioCode = code;
    startNewGame();
    return true;
  },
  clearScenarioOverride() {
    state.externalScenarioCode = null;
  },
  getScenario() {
    return scenario.snapshot();
  },
};
