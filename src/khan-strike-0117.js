// UPAY 2D v0.1.17-alpha
// Khan must be knocked out with a chuko strike; direct tapping is blocked.
(function(){
  let khanSource = null;
  let allowKhanClick = false;
  let striking = false;
  let objectiveTimer = null;

  const host = document.getElementById('pixiHost');
  const shell = document.getElementById('appShell');
  if (!host || !shell) return;

  injectStyles();

  const observer = new MutationObserver(() => syncKhanMode());
  observer.observe(host, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  window.setInterval(syncKhanMode, 350);

  document.addEventListener('click', onCaptureClick, true);
  document.addEventListener('pointerup', onAimRelease, true);

  function injectStyles(){
    const style=document.createElement('style');
    style.textContent=`
      #appShell.khan-strike-mode .game-piece.normal.position-valid-target,
      #appShell.khan-strike-mode .game-piece.normal.aim-candidate{opacity:.42!important;filter:grayscale(.18) drop-shadow(0 5px 4px rgba(0,0,0,.18))!important}
      #appShell.khan-strike-mode .game-piece.khan.active{
        opacity:1!important;
        filter:drop-shadow(0 0 6px #fff) drop-shadow(0 0 20px #ffd45f) drop-shadow(0 0 36px rgba(255,170,38,.86))!important;
        animation:khanTargetPulse0117 1.25s ease-in-out infinite;
      }
      #appShell.khan-strike-mode .game-piece.normal.khan-striker{
        opacity:1!important;
        filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 16px #65ddff) drop-shadow(0 7px 5px rgba(0,0,0,.23))!important;
      }
      @keyframes khanTargetPulse0117{0%,100%{scale:1}50%{scale:1.07}}
    `;
    document.head.appendChild(style);
  }

  function getActiveKhan(){
    return document.querySelector('.game-piece.khan.active');
  }

  function syncKhanMode(){
    const khan=getActiveKhan();
    if(!khan){
      shell.classList.remove('khan-strike-mode');
      if(khanSource){
        khanSource.classList.remove('selected','khan-striker');
        khanSource=null;
      }
      return;
    }

    shell.classList.add('khan-strike-mode');
    if(!striking && !khanSource){
      setObjectiveSoft('ХАН! Выбери чуко-биту и выбей Хана');
    }
  }

  function onCaptureClick(event){
    const khan=getActiveKhan();
    if(!khan) return;

    const clickedKhan=event.target.closest?.('.game-piece.khan');
    if(clickedKhan){
      if(allowKhanClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(!khanSource) setObjectiveSoft('Сначала выбери чуко-биту');
      else setObjectiveSoft('Наведи сектор на Хана и отпусти');
      pulse(clickedKhan);
      return;
    }

    const normal=event.target.closest?.('.game-piece.normal');
    if(!normal || striking) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if(khanSource===normal){
      clearKhanSource();
      setObjectiveSoft('ХАН! Выбери чуко-биту и выбей Хана');
      return;
    }

    clearKhanSource();
    khanSource=normal;
    normal.classList.add('selected','khan-striker');
    setObjectiveSoft('Прицелься в Хана и отпусти');
    normal.dispatchEvent(new Event('change',{bubbles:true}));
    window.setTimeout(()=>normal.classList.add('selected','khan-striker'),0);
  }

  function onAimRelease(event){
    const khan=getActiveKhan();
    const touch=event.target.closest?.('.aim-touch-layer');
    if(!khan || !khanSource || !touch || striking) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const a=khanSource.getBoundingClientRect();
    const b=khan.getBoundingClientRect();
    const sx=a.left+a.width/2, sy=a.top+a.height/2;
    const tx=b.left+b.width/2, ty=b.top+b.height/2;
    const aim=Math.atan2(event.clientY-sy,event.clientX-sx);
    const targetAngle=Math.atan2(ty-sy,tx-sx);
    const diff=Math.abs(normalizeAngle(aim-targetAngle));

    if(diff>24*Math.PI/180){
      setObjectiveSoft('Наведи сектор точно на Хана');
      pulse(khan);
      return;
    }

    hideAimUI();
    strikeKhan(khanSource,khan);
  }

  function strikeKhan(source,khan){
    if(!source?.isConnected || !khan?.isConnected) return;
    striking=true;

    const a=source.getBoundingClientRect();
    const b=khan.getBoundingClientRect();
    const sx=a.left, sy=a.top, sw=a.width, sh=a.height;
    const scx=a.left+a.width/2, scy=a.top+a.height/2;
    const tcx=b.left+b.width/2, tcy=b.top+b.height/2;
    const dx=tcx-scx, dy=tcy-scy;
    const dist=Math.max(1,Math.hypot(dx,dy));
    const ux=dx/dist, uy=dy/dist;
    const contact=Math.max(18,dist-Math.max(b.width,b.height)*.34);

    const clone=source.cloneNode(true);
    clone.classList.remove('selected','khan-striker');
    Object.assign(clone.style,{
      position:'fixed',left:`${sx}px`,top:`${sy}px`,width:`${sw}px`,height:`${sh}px`,
      margin:'0',transform:'none',zIndex:'10080',pointerEvents:'none',opacity:'1',
      filter:'drop-shadow(0 10px 8px rgba(0,0,0,.34)) drop-shadow(0 0 8px rgba(255,255,255,.42))'
    });
    document.body.appendChild(clone);
    source.style.visibility='hidden';

    const duration=900;
    const flight=clone.animate([
      {offset:0,left:`${sx}px`,top:`${sy}px`,transform:'rotate(0deg) scale(1)'},
      {offset:.16,left:`${sx-ux*13}px`,top:`${sy-uy*13-3}px`,transform:'rotate(-10deg) scale(1.03)'},
      {offset:.62,left:`${sx+ux*contact}px`,top:`${sy+uy*contact-18}px`,transform:'rotate(155deg) scale(1.10)'},
      {offset:.72,left:`${sx+ux*(contact+10)}px`,top:`${sy+uy*(contact+10)-10}px`,transform:'rotate(210deg) scale(1.06)'},
      {offset:1,left:`${sx}px`,top:`${sy}px`,transform:'rotate(350deg) scale(1)'}
    ],{duration,easing:'cubic-bezier(.18,.70,.18,1)',fill:'forwards'});

    window.setTimeout(()=>{
      knockKhan(khan,ux,uy);
      impactFlash(tcx,tcy);
    },550);

    flight.finished.catch(()=>{}).finally(()=>{
      clone.remove();
      source.style.visibility='';
      clearKhanSource();
      striking=false;
      if(khan?.isConnected){
        allowKhanClick=true;
        khan.click();
        allowKhanClick=false;
      }
    });
  }

  function knockKhan(khan,ux,uy){
    const base=khan.style.transform;
    khan.animate([
      {offset:0,transform:base},
      {offset:.34,transform:`${base} translate(${ux*56}px,${uy*42-18}px) rotate(65deg) scale(1.10)`},
      {offset:.70,transform:`${base} translate(${ux*76}px,${uy*58-25}px) rotate(135deg) scale(1.02)`},
      {offset:1,transform:`${base} translate(${ux*88}px,${uy*66-30}px) rotate(185deg) scale(.94)`}
    ],{duration:470,easing:'cubic-bezier(.16,.72,.18,1)',fill:'forwards'});
  }

  function impactFlash(x,y){
    const el=document.createElement('div');
    Object.assign(el.style,{
      position:'fixed',left:`${x}px`,top:`${y}px`,width:'24px',height:'24px',borderRadius:'50%',
      border:'3px solid #fff4bd',boxShadow:'0 0 0 7px rgba(255,197,72,.35),0 0 28px #ffd45f',
      transform:'translate(-50%,-50%) scale(.25)',zIndex:'10079',pointerEvents:'none'
    });
    document.body.appendChild(el);
    el.animate([
      {opacity:1,transform:'translate(-50%,-50%) scale(.25)'},
      {opacity:.95,offset:.35,transform:'translate(-50%,-50%) scale(1.35)'},
      {opacity:0,transform:'translate(-50%,-50%) scale(2.4)'}
    ],{duration:360,easing:'ease-out'}).onfinish=()=>el.remove();
  }

  function hideAimUI(){
    const sector=document.querySelector('.aim-sector');
    const touch=document.querySelector('.aim-touch-layer');
    const cancel=document.querySelector('.aim-cancel');
    if(sector) sector.style.display='none';
    if(touch) touch.style.display='none';
    if(cancel) cancel.style.display='none';
  }

  function clearKhanSource(){
    if(khanSource){
      khanSource.classList.remove('selected','khan-striker');
      khanSource=null;
    }
  }

  function pulse(el){
    if(!el) return;
    const base=el.style.transform;
    el.animate([{transform:base},{transform:`${base} scale(1.12)`},{transform:base}],{duration:360,easing:'ease-out'});
  }

  function setObjectiveSoft(text){
    const objective=document.getElementById('objective');
    if(!objective) return;
    clearTimeout(objectiveTimer);
    objective.textContent=text;
    objectiveTimer=setTimeout(()=>{
      if(getActiveKhan() && !khanSource && !striking) objective.textContent='ХАН! Выбери чуко-биту и выбей Хана';
    },1400);
  }

  function normalizeAngle(a){
    while(a>Math.PI) a-=Math.PI*2;
    while(a<-Math.PI) a+=Math.PI*2;
    return a;
  }
})();