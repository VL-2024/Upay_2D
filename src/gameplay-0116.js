// UPAY 2D v0.1.16-alpha
// Gameplay overlay: canonical chuko positions, target filtering, aim sector and position helper panel.
(function(){
  const POSITION_META = {
    aykur: { label: 'Айкүр', assets: ['chuko_02.webp','chuko_04.webp'] },
    taa:   { label: 'Таа',   assets: ['chuko_03.webp'] },
    bok:   { label: 'Бөк',   assets: ['chuko_05.webp'] },
    chik:  { label: 'Чик',   assets: ['chuko_01.webp'] },
  };
  const ASSET_TO_POSITION = {};
  Object.entries(POSITION_META).forEach(([id,meta]) => meta.assets.forEach(a => ASSET_TO_POSITION[a] = id));

  let guideFilter = null;
  let selectedSource = null;
  let aimAngle = 0;
  let currentCandidate = null;
  let dragStart = null;
  let dragging = false;
  let objectiveRestoreTimer = null;

  const host = document.getElementById('pixiHost');
  if (!host) return;

  injectStyles();
  const ui = buildUI();

  const observer = new MutationObserver((records) => {
    assignPositions();
    const sourceNow=document.querySelector('.game-piece.normal.selected');
    const structural=records.some(r=>r.type==='childList' || r.attributeName==='src');
    if(structural || sourceNow!==selectedSource) syncSelectionAndHighlights();
  });
  observer.observe(host, { childList:true, subtree:true, attributes:true, attributeFilter:['class','src'] });

  document.addEventListener('click', interceptPieceClick, true);
  document.getElementById('newGameBtn')?.addEventListener('click', () => {
    guideFilter = null;
    setTimeout(() => {
      assignPositions();
      syncSelectionAndHighlights();
      updateGuideButtons();
    }, 60);
  });

  assignPositions();
  syncSelectionAndHighlights();

  function injectStyles(){
    const style=document.createElement('style');
    style.textContent=`
      .game-piece.normal.position-source-ready{filter:drop-shadow(0 0 3px rgba(255,255,255,.95)) drop-shadow(0 0 11px rgba(92,219,255,.95)) drop-shadow(0 7px 5px rgba(0,0,0,.23))!important}
      .game-piece.normal.position-valid-target{filter:drop-shadow(0 0 4px rgba(255,255,255,1)) drop-shadow(0 0 15px rgba(246,202,99,1)) drop-shadow(0 7px 5px rgba(0,0,0,.23))!important;opacity:1!important}
      .game-piece.normal.position-invalid-target{opacity:.38!important;filter:grayscale(.28) drop-shadow(0 5px 4px rgba(0,0,0,.18))!important}
      .game-piece.normal.pose-guide-match{filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 16px #65ddff) drop-shadow(0 7px 5px rgba(0,0,0,.23))!important;opacity:1!important}
      .game-piece.normal.pose-guide-dim{opacity:.34!important;filter:grayscale(.38) drop-shadow(0 4px 3px rgba(0,0,0,.15))!important}
      .game-piece.normal.aim-candidate{filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 19px #ffe07b) drop-shadow(0 0 30px rgba(255,198,66,.75))!important;transform-origin:center!important}
      .pose-guide{position:absolute;left:58px;top:118px;z-index:8;width:132px;padding:8px 8px 9px;border:1px solid rgba(255,255,255,.24);border-radius:14px;background:rgba(6,28,49,.90);box-shadow:0 8px 18px rgba(0,0,0,.24);backdrop-filter:blur(5px);color:#fff;pointer-events:auto}
      .pose-guide-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;font-size:11px;font-weight:900;letter-spacing:.04em}
      .pose-guide-hide{width:22px;height:22px;padding:0;border:1px solid rgba(255,255,255,.25);border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:13px;line-height:18px;cursor:pointer}
      .pose-guide-sub{font-size:9px;line-height:1.15;opacity:.72;margin:-1px 0 6px}
      .pose-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
      .pose-guide-btn{height:28px;border:1px solid rgba(150,205,236,.38);border-radius:9px;background:rgba(15,55,84,.88);color:#f7fbff;font-size:10px;font-weight:850;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
      .pose-guide-btn.active{background:rgba(49,110,148,.98);border-color:#f1cb74;color:#ffeaa8;box-shadow:0 0 9px rgba(116,216,255,.45)}
      .pose-guide-open{position:absolute;left:58px;top:118px;z-index:8;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(6,28,49,.92);color:#fff;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer;box-shadow:0 7px 16px rgba(0,0,0,.22)}
      .aim-sector{position:fixed;left:0;top:0;width:245px;height:150px;z-index:3;pointer-events:none;transform-origin:0 75px;display:none;filter:drop-shadow(0 0 5px rgba(54,198,255,.24))}
      .aim-sector svg{display:block;width:245px;height:150px;overflow:visible}
      .aim-touch-layer{position:fixed;z-index:3;display:none;touch-action:none;cursor:crosshair;background:transparent}
      .aim-cancel{position:fixed;z-index:5;display:none;width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.75);background:rgba(6,28,49,.92);color:#fff;font-size:18px;line-height:24px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.28)}
      @media(max-width:700px){
        .pose-guide{left:52px;top:112px;width:118px;padding:7px}.pose-guide-open{left:52px;top:112px}.pose-guide-head{font-size:10px}.pose-guide-sub{font-size:8px}.pose-guide-btn{height:25px;font-size:9px}.aim-sector{width:215px;height:132px;transform-origin:0 66px}.aim-sector svg{width:215px;height:132px}
      }
    `;
    document.head.appendChild(style);
  }

  function buildUI(){
    const shell=document.getElementById('appShell') || document.body;
    const guide=document.createElement('div');
    guide.className='pose-guide';
    guide.innerHTML=`
      <div class="pose-guide-head"><span>ПОЛОЖЕНИЯ ЧУКО</span><button class="pose-guide-hide" type="button" aria-label="Скрыть">×</button></div>
      <div class="pose-guide-sub">Нажми название — подсветим на поле</div>
      <div class="pose-guide-grid">
        <button class="pose-guide-btn" data-pose="aykur">Айкүр</button>
        <button class="pose-guide-btn" data-pose="taa">Таа</button>
        <button class="pose-guide-btn" data-pose="bok">Бөк</button>
        <button class="pose-guide-btn" data-pose="chik">Чик</button>
      </div>`;
    shell.appendChild(guide);

    const open=document.createElement('button');
    open.className='pose-guide-open';
    open.type='button';
    open.textContent='Положения';
    open.hidden=true;
    shell.appendChild(open);

    guide.querySelector('.pose-guide-hide').addEventListener('click',()=>{
      guide.hidden=true;open.hidden=false;
    });
    open.addEventListener('click',()=>{guide.hidden=false;open.hidden=true;});
    guide.querySelectorAll('.pose-guide-btn').forEach(btn=>btn.addEventListener('click',()=>{
      const pose=btn.dataset.pose;
      guideFilter = guideFilter===pose ? null : pose;
      updateGuideButtons();
      syncSelectionAndHighlights();
    }));

    const sector=document.createElement('div');
    sector.className='aim-sector';
    sector.innerHTML=`<svg viewBox="0 0 245 150" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="aimGrad0116" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="#6ee7ff" stop-opacity=".62"/>
          <stop offset="52%" stop-color="#53cfff" stop-opacity=".28"/>
          <stop offset="100%" stop-color="#3abcf5" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="M0,75 L225,14 Q244,75 225,136 Z" fill="url(#aimGrad0116)" stroke="rgba(145,226,255,.58)" stroke-width="1.2"/>
      <line x1="8" y1="75" x2="220" y2="75" stroke="rgba(255,255,255,.82)" stroke-width="1.7" stroke-dasharray="5 7"/>
    </svg>`;
    document.body.appendChild(sector);

    const touch=document.createElement('div');
    touch.className='aim-touch-layer';
    document.body.appendChild(touch);

    const cancel=document.createElement('button');
    cancel.className='aim-cancel';
    cancel.type='button';
    cancel.textContent='×';
    cancel.title='Отменить прицеливание';
    document.body.appendChild(cancel);
    cancel.addEventListener('click',(e)=>{
      e.preventDefault();e.stopPropagation();
      const source=document.querySelector('.game-piece.normal.selected');
      source?.click();
      hideAim();
    });

    touch.addEventListener('pointerdown',e=>{
      if(!selectedSource) return;
      dragging=true;
      dragStart={x:e.clientX,y:e.clientY};
      touch.setPointerCapture?.(e.pointerId);
      updateAimFromPoint(e.clientX,e.clientY);
      e.preventDefault();
    });
    touch.addEventListener('pointermove',e=>{
      if(!selectedSource) return;
      if(dragging || e.pointerType==='mouse') updateAimFromPoint(e.clientX,e.clientY);
    });
    touch.addEventListener('pointerup',e=>{
      if(!selectedSource) return;
      updateAimFromPoint(e.clientX,e.clientY);
      dragging=false;
      if(currentCandidate){
        const target=currentCandidate;
        currentCandidate=null;
        hideAim();
        window.setTimeout(()=>target.click(),20);
      }else{
        flashObjectiveText('Наведи сектор на подсвеченный чуко');
      }
      e.preventDefault();
    });

    return {guide,open,sector,touch,cancel};
  }

  function assignPositions(){
    document.querySelectorAll('.game-piece.normal').forEach(el=>{
      const name=(el.getAttribute('src')||el.src||'').split('/').pop().split('?')[0];
      const pose=ASSET_TO_POSITION[name] || el.dataset.position || 'aykur';
      el.dataset.position=pose;
      el.dataset.positionLabel=POSITION_META[pose]?.label || pose;
    });
  }

  function interceptPieceClick(event){
    const target=event.target.closest?.('.game-piece.normal');
    if(!target) return;
    assignPositions();
    const source=document.querySelector('.game-piece.normal.selected');

    if(!source){
      const matches=getMatchingPieces(target);
      if(matches.length===0){
        event.preventDefault();event.stopImmediatePropagation();
        flashInvalid(target,'Нет пары в таком же положении');
      }
      return;
    }

    if(source===target) return;

    if(source.dataset.position!==target.dataset.position){
      event.preventDefault();event.stopImmediatePropagation();
      flashInvalid(target,'Бить можно только по чуко в том же положении');
      return;
    }

    const targetVisualSrc=target.getAttribute('src') || target.src;
    schedulePostStrikeUpdate(source,target,targetVisualSrc);
  }

  function schedulePostStrikeUpdate(source,target,targetVisualSrc){
    window.setTimeout(()=>{
      if(source?.isConnected) flipSource(source);
    },980);

    window.setTimeout(()=>{
      const slots=[...document.querySelectorAll('.slot.filled')];
      const last=slots[slots.length-1];
      const img=last?.querySelector('img');
      if(img && targetVisualSrc) img.src=targetVisualSrc;
      assignPositions();
      syncSelectionAndHighlights();
    },1100);
  }

  function flipSource(source){
    const oldPose=source.dataset.position;
    const ids=Object.keys(POSITION_META).filter(id=>id!==oldPose);
    const nextPose=ids[Math.floor(Math.random()*ids.length)];
    const assets=POSITION_META[nextPose].assets;
    const nextAsset=assets[Math.floor(Math.random()*assets.length)];
    const nextSrc=`./assets/chuko/${nextAsset}`;
    const base=source.style.transform;

    const anim=source.animate([
      {offset:0,transform:base,filter:'brightness(1)'},
      {offset:.45,transform:`${base} scaleX(.08) rotate(70deg)`,filter:'brightness(1.18)'},
      {offset:.55,transform:`${base} scaleX(.08) rotate(105deg)`,filter:'brightness(1.18)'},
      {offset:1,transform:base,filter:'brightness(1)'}
    ],{duration:420,easing:'cubic-bezier(.25,.7,.22,1)'});

    window.setTimeout(()=>{
      source.src=nextSrc;
      source.dataset.position=nextPose;
      source.dataset.positionLabel=POSITION_META[nextPose].label;
    },205);

    anim.finished.catch(()=>{}).finally(()=>{
      syncSelectionAndHighlights();
    });
  }

  function getMatchingPieces(source){
    if(!source?.dataset.position) return [];
    return [...document.querySelectorAll('.game-piece.normal')].filter(el=>el!==source && el.dataset.position===source.dataset.position && isUsable(el));
  }

  function isUsable(el){
    return el?.isConnected && el.style.visibility!=='hidden' && el.getClientRects().length>0;
  }

  function syncSelectionAndHighlights(){
    assignPositions();
    const source=document.querySelector('.game-piece.normal.selected');
    selectedSource=source || null;
    const normals=[...document.querySelectorAll('.game-piece.normal')];

    normals.forEach(el=>el.classList.remove('position-source-ready','position-valid-target','position-invalid-target','pose-guide-match','pose-guide-dim','aim-candidate'));

    if(source){
      normals.forEach(el=>{
        if(el===source) return;
        if(el.dataset.position===source.dataset.position) el.classList.add('position-valid-target');
        else el.classList.add('position-invalid-target');
      });
      showAimForSource(source);
    }else{
      hideAim();
      normals.forEach(el=>{
        if(getMatchingPieces(el).length>0) el.classList.add('position-source-ready');
      });
      if(guideFilter){
        normals.forEach(el=>el.classList.add(el.dataset.position===guideFilter?'pose-guide-match':'pose-guide-dim'));
      }
    }
    updateGuideButtons();
  }

  function updateGuideButtons(){
    ui.guide.querySelectorAll('.pose-guide-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.pose===guideFilter));
  }

  function showAimForSource(source){
    const sourceRect=source.getBoundingClientRect();
    const shellRect=(document.getElementById('appShell')||host).getBoundingClientRect();
    ui.touch.style.left=`${shellRect.left}px`;
    ui.touch.style.top=`${shellRect.top+shellRect.height*.22}px`;
    ui.touch.style.width=`${shellRect.width}px`;
    ui.touch.style.height=`${shellRect.height*.44}px`;
    ui.touch.style.display='block';

    const cx=sourceRect.left+sourceRect.width/2;
    const cy=sourceRect.top+sourceRect.height/2;
    ui.sector.style.left=`${cx}px`;
    ui.sector.style.top=`${cy-75}px`;
    ui.sector.style.display='block';
    ui.cancel.style.left=`${cx+14}px`;
    ui.cancel.style.top=`${cy+16}px`;
    ui.cancel.style.display='block';

    const matches=getMatchingPieces(source);
    if(matches.length){
      const r=matches[0].getBoundingClientRect();
      updateAimFromPoint(r.left+r.width/2,r.top+r.height/2,false);
    }
  }

  function hideAim(){
    ui.sector.style.display='none';
    ui.touch.style.display='none';
    ui.cancel.style.display='none';
    currentCandidate=null;
    document.querySelectorAll('.aim-candidate').forEach(el=>el.classList.remove('aim-candidate'));
  }

  function updateAimFromPoint(clientX,clientY,updateCandidate=true){
    const source=selectedSource;
    if(!source) return;
    const sr=source.getBoundingClientRect();
    const sx=sr.left+sr.width/2;
    const sy=sr.top+sr.height/2;
    aimAngle=Math.atan2(clientY-sy,clientX-sx);
    const deg=aimAngle*180/Math.PI;
    ui.sector.style.transform=`rotate(${deg}deg)`;

    if(updateCandidate!==false){
      document.querySelectorAll('.aim-candidate').forEach(el=>el.classList.remove('aim-candidate'));
      currentCandidate=findCandidate(source,aimAngle);
      currentCandidate?.classList.add('aim-candidate');
    }else{
      currentCandidate=findCandidate(source,aimAngle);
      currentCandidate?.classList.add('aim-candidate');
    }
  }

  function findCandidate(source,angle){
    const sr=source.getBoundingClientRect();
    const sx=sr.left+sr.width/2;
    const sy=sr.top+sr.height/2;
    const matches=getMatchingPieces(source);
    let best=null;
    let bestScore=Infinity;
    const maxDiff=22*Math.PI/180;
    matches.forEach(el=>{
      const r=el.getBoundingClientRect();
      const tx=r.left+r.width/2;
      const ty=r.top+r.height/2;
      const a=Math.atan2(ty-sy,tx-sx);
      const diff=Math.abs(normalizeAngle(a-angle));
      if(diff>maxDiff) return;
      const dist=Math.hypot(tx-sx,ty-sy);
      const score=diff*700+dist*.12;
      if(score<bestScore){bestScore=score;best=el;}
    });
    return best;
  }

  function normalizeAngle(a){
    while(a>Math.PI) a-=Math.PI*2;
    while(a<-Math.PI) a+=Math.PI*2;
    return a;
  }

  function flashInvalid(el,text){
    const base=el.style.transform;
    el.animate([
      {transform:base},
      {transform:`${base} translateX(-6px)`},
      {transform:`${base} translateX(6px)`},
      {transform:base}
    ],{duration:260,easing:'ease-out'});
    flashObjectiveText(text);
  }

  function flashObjectiveText(text){
    const objective=document.getElementById('objective');
    if(!objective) return;
    clearTimeout(objectiveRestoreTimer);
    const old=objective.textContent;
    objective.textContent=text;
    objectiveRestoreTimer=setTimeout(()=>{
      if(objective.textContent===text) objective.textContent=old;
    },1050);
  }
})();