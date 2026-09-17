// UPAY 2D v0.1.18-alpha
// Pull-back aiming overlay for the stable DOM renderer.
(function(){
  const POS={
    'chuko_02.webp':'aykur','chuko_04.webp':'aykur',
    'chuko_03.webp':'taa','chuko_05.webp':'bok','chuko_01.webp':'chik'
  };
  const host=document.getElementById('pixiHost');
  if(!host)return;

  let pulling=false,source=null,pointerId=null,baseTransform='';
  let sx=0,sy=0,dx=0,dy=0,strength=0,candidate=null;
  let internalTarget=false,internalKhan=false,manualKhanSource=null;
  let suppressUntil=0,strikingKhan=false,objTimer=null;

  injectStyles();
  const ui=buildGuide();
  const observer=new MutationObserver(()=>syncInstruction());
  observer.observe(host,{subtree:true,childList:true,attributes:true,attributeFilter:['class','src']});

  document.addEventListener('click',captureClick,true);
  document.addEventListener('pointerdown',pointerDown,true);
  document.addEventListener('pointermove',pointerMove,true);
  document.addEventListener('pointerup',pointerUp,true);
  document.addEventListener('pointercancel',cancelPull,true);

  function injectStyles(){
    const s=document.createElement('style');
    s.textContent=`
      .game-piece.normal{width:15.8%!important}
      .game-piece.khan{width:16.8%!important}
      .aim-sector,.aim-touch-layer,.aim-cancel{display:none!important;pointer-events:none!important}
      .game-piece.normal.pull-striker{z-index:70!important;filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 18px #63dfff) drop-shadow(0 10px 8px rgba(0,0,0,.30))!important}
      .game-piece.normal.pull-candidate{opacity:1!important;filter:drop-shadow(0 0 6px #fff) drop-shadow(0 0 22px #ffe078) drop-shadow(0 0 35px rgba(255,190,43,.82))!important}
      .game-piece.khan.active{filter:drop-shadow(0 0 7px #fff) drop-shadow(0 0 22px #ffd45f) drop-shadow(0 0 38px rgba(255,170,38,.88))!important;animation:khanPulse0118 1.2s ease-in-out infinite}
      @keyframes khanPulse0118{0%,100%{scale:1}50%{scale:1.07}}
      .pull-sector{position:fixed;left:0;top:0;width:270px;height:154px;z-index:10020;display:none;pointer-events:none;transform-origin:0 77px;filter:drop-shadow(0 0 5px rgba(54,198,255,.25))}
      .pull-sector svg{width:270px;height:154px;overflow:visible}
      .pull-elastic{position:fixed;height:3px;z-index:10021;display:none;pointer-events:none;transform-origin:0 50%;background:linear-gradient(90deg,rgba(255,255,255,.88),rgba(76,207,255,.18));border-radius:3px;box-shadow:0 0 8px rgba(83,213,255,.45)}
      .pull-handle{position:fixed;width:24px;height:24px;border:2px solid rgba(255,255,255,.88);border-radius:50%;z-index:10022;display:none;pointer-events:none;transform:translate(-50%,-50%);background:rgba(46,160,215,.25);box-shadow:0 0 12px rgba(77,206,255,.55)}
      .pull-label{position:fixed;z-index:10023;display:none;pointer-events:none;padding:5px 9px;border-radius:12px;background:rgba(5,27,47,.88);color:#fff;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:0 5px 12px rgba(0,0,0,.24)}
      @media(max-width:700px){.game-piece.normal{width:16.2%!important}.game-piece.khan{width:17.2%!important}.pull-sector{width:235px;height:136px;transform-origin:0 68px}.pull-sector svg{width:235px;height:136px}}
    `;
    document.head.appendChild(s);
  }

  function buildGuide(){
    const sector=document.createElement('div');sector.className='pull-sector';sector.innerHTML=`<svg viewBox="0 0 270 154" preserveAspectRatio="none"><defs><linearGradient id="pullGrad0118" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#6ee7ff" stop-opacity=".60"/><stop offset="58%" stop-color="#53cfff" stop-opacity=".23"/><stop offset="100%" stop-color="#3abcf5" stop-opacity="0"/></linearGradient></defs><path d="M0,77 L250,18 Q270,77 250,136 Z" fill="url(#pullGrad0118)" stroke="rgba(151,229,255,.58)" stroke-width="1.2"/><line x1="8" y1="77" x2="247" y2="77" stroke="rgba(255,255,255,.86)" stroke-width="1.8" stroke-dasharray="5 7"/></svg>`;document.body.appendChild(sector);
    const elastic=document.createElement('div');elastic.className='pull-elastic';document.body.appendChild(elastic);
    const handle=document.createElement('div');handle.className='pull-handle';document.body.appendChild(handle);
    const label=document.createElement('div');label.className='pull-label';label.textContent='ОТТЯНИ НАЗАД';document.body.appendChild(label);
    return{sector,elastic,handle,label};
  }

  function activeKhan(){return document.querySelector('.game-piece.khan.active')}
  function selected(){return manualKhanSource||document.querySelector('.game-piece.normal.selected')}
  function pose(el){if(!el)return null;const name=(el.getAttribute('src')||el.src||'').split('/').pop().split('?')[0];return el.dataset.position||POS[name]||null}
  function usable(el){return el?.isConnected&&el.style.visibility!=='hidden'&&el.getClientRects().length>0}
  function samePoseTargets(src){const p=pose(src);return [...document.querySelectorAll('.game-piece.normal')].filter(el=>el!==src&&usable(el)&&pose(el)===p)}

  function captureClick(e){
    const normal=e.target.closest?.('.game-piece.normal');
    const khan=e.target.closest?.('.game-piece.khan');
    const k=activeKhan();

    if(khan&&k){
      if(internalKhan)return;
      e.preventDefault();e.stopImmediatePropagation();
      flash(manualKhanSource?'Оттяни выбранный чуко назад и отпусти':'Сначала выбери чуко-биту');
      pulse(khan);return;
    }
    if(!normal)return;
    if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return}

    if(k){
      e.preventDefault();e.stopImmediatePropagation();
      if(manualKhanSource===normal){manualKhanSource.classList.remove('selected','pull-striker');manualKhanSource=null;flash('ХАН! Выбери чуко-биту');return}
      manualKhanSource?.classList.remove('selected','pull-striker');manualKhanSource=normal;normal.classList.add('selected','pull-striker');flash('Оттяни чуко назад и отпусти по Хану');return;
    }

    const src=document.querySelector('.game-piece.normal.selected');
    if(!src)return;
    if(src===normal)return;
    if(internalTarget)return;
    e.preventDefault();e.stopImmediatePropagation();
    flash(pose(src)===pose(normal)?'Удар делается оттягиванием бьющего чуко':'Бить можно только по чуко в том же положении');
  }

  function pointerDown(e){
    const src=selected();
    if(!src||strikingKhan||e.target.closest?.('.game-piece.normal')!==src)return;
    pulling=true;source=src;pointerId=e.pointerId;baseTransform=src.style.transform;
    const r=src.getBoundingClientRect();sx=r.left+r.width/2;sy=r.top+r.height/2;dx=dy=strength=0;candidate=null;
    src.classList.add('pull-striker');showGuide(sx,sy,0);
    try{src.setPointerCapture?.(e.pointerId)}catch{}
    e.preventDefault();e.stopPropagation();
  }

  function pointerMove(e){
    if(!pulling||e.pointerId!==pointerId||!source)return;
    let x=e.clientX-sx,y=e.clientY-sy;const len=Math.hypot(x,y),max=105,scale=len>max?max/len:1;x*=scale;y*=scale;dx=x;dy=y;strength=Math.hypot(x,y);
    source.style.transform=`${baseTransform} translate(${x*.58}px,${y*.58}px) scale(${1+Math.min(.07,strength/1500)})`;
    const shot=Math.atan2(-y,-x);updateGuide(e.clientX,e.clientY,shot,strength);
    document.querySelectorAll('.pull-candidate').forEach(el=>el.classList.remove('pull-candidate'));
    candidate=findCandidate(source,shot);candidate?.classList.add('pull-candidate');
    e.preventDefault();
  }

  function pointerUp(e){
    if(!pulling||e.pointerId!==pointerId)return;
    e.preventDefault();e.stopPropagation();suppressUntil=Date.now()+300;
    const src=source,chosen=candidate,power=strength;
    resetPull(src);pulling=false;source=null;pointerId=null;candidate=null;
    document.querySelectorAll('.pull-candidate').forEach(el=>el.classList.remove('pull-candidate'));
    if(power<24){flash('Оттяни чуко назад сильнее и отпусти');return}
    if(!chosen){flash('Оттяни назад по линии к подсвеченной цели');return}
    if(chosen.classList.contains('khan')){strikeKhan(src,chosen);return}
    internalTarget=true;setTimeout(()=>{chosen.click();internalTarget=false},25);
  }

  function cancelPull(e){if(!pulling)return;if(e?.pointerId!=null&&e.pointerId!==pointerId)return;resetPull(source);pulling=false;source=null;pointerId=null;candidate=null}
  function resetPull(src){hideGuide();if(src){src.style.transform=baseTransform;src.classList.remove('pull-striker')}}

  function findCandidate(src,angle){
    const r=src.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,k=activeKhan(),targets=k?[k]:samePoseTargets(src);let best=null,score=Infinity,max=(k?28:22)*Math.PI/180;
    targets.forEach(el=>{const q=el.getBoundingClientRect(),tx=q.left+q.width/2,ty=q.top+q.height/2,a=Math.atan2(ty-y,tx-x),diff=Math.abs(norm(a-angle));if(diff>max)return;const d=Math.hypot(tx-x,ty-y),s=diff*800+d*.1;if(s<score){score=s;best=el}});return best;
  }

  function showGuide(x,y,a){ui.sector.style.left=`${x}px`;ui.sector.style.top=`${y-77}px`;ui.sector.style.transform=`rotate(${a}rad)`;ui.sector.style.display='block';ui.label.style.left=`${x+15}px`;ui.label.style.top=`${y+20}px`;ui.label.style.display='block'}
  function updateGuide(px,py,shot,power){ui.sector.style.left=`${sx}px`;ui.sector.style.top=`${sy-77}px`;ui.sector.style.transform=`rotate(${shot}rad) scaleX(${.72+Math.min(.28,power/120)})`;ui.sector.style.display='block';const ex=px-sx,ey=py-sy,len=Math.min(110,Math.hypot(ex,ey));ui.elastic.style.left=`${sx}px`;ui.elastic.style.top=`${sy}px`;ui.elastic.style.width=`${len}px`;ui.elastic.style.transform=`rotate(${Math.atan2(ey,ex)}rad)`;ui.elastic.style.display='block';ui.handle.style.left=`${sx+dx}px`;ui.handle.style.top=`${sy+dy}px`;ui.handle.style.display='block';ui.label.textContent=power<24?'ОТТЯНИ НАЗАД':'ОТПУСТИ';ui.label.style.left=`${sx+dx+14}px`;ui.label.style.top=`${sy+dy+14}px`;ui.label.style.display='block'}
  function hideGuide(){ui.sector.style.display='none';ui.elastic.style.display='none';ui.handle.style.display='none';ui.label.style.display='none'}

  function strikeKhan(src,khan){
    if(!src?.isConnected||!khan?.isConnected)return;strikingKhan=true;
    const a=src.getBoundingClientRect(),b=khan.getBoundingClientRect(),sx0=a.left,sy0=a.top,sw=a.width,sh=a.height,scx=a.left+a.width/2,scy=a.top+a.height/2,tcx=b.left+b.width/2,tcy=b.top+b.height/2,ddx=tcx-scx,ddy=tcy-scy,dist=Math.max(1,Math.hypot(ddx,ddy)),ux=ddx/dist,uy=ddy/dist,contact=Math.max(18,dist-Math.max(b.width,b.height)*.34);
    const clone=src.cloneNode(true);clone.classList.remove('selected','pull-striker');Object.assign(clone.style,{position:'fixed',left:`${sx0}px`,top:`${sy0}px`,width:`${sw}px`,height:`${sh}px`,margin:'0',transform:'none',zIndex:'10080',pointerEvents:'none',opacity:'1',filter:'drop-shadow(0 10px 8px rgba(0,0,0,.34)) drop-shadow(0 0 8px rgba(255,255,255,.42))'});document.body.appendChild(clone);src.style.visibility='hidden';
    const f=clone.animate([{left:`${sx0}px`,top:`${sy0}px`,transform:'rotate(0deg)'},{offset:.18,left:`${sx0-ux*13}px`,top:`${sy0-uy*13-3}px`,transform:'rotate(-12deg)'},{offset:.66,left:`${sx0+ux*contact}px`,top:`${sy0+uy*contact-18}px`,transform:'rotate(160deg) scale(1.1)'},{left:`${sx0+ux*(contact+12)}px`,top:`${sy0+uy*(contact+12)-10}px`,transform:'rotate(220deg)'}],{duration:780,easing:'cubic-bezier(.18,.70,.18,1)',fill:'forwards'});
    setTimeout(()=>{impact(tcx,tcy);const base=khan.style.transform;khan.animate([{transform:base},{transform:`${base} translate(${ux*58}px,${uy*44-18}px) rotate(70deg) scale(1.1)`},{transform:`${base} translate(${ux*88}px,${uy*68-30}px) rotate(180deg) scale(.94)`}],{duration:470,easing:'cubic-bezier(.16,.72,.18,1)',fill:'forwards'})},500);
    f.finished.catch(()=>{}).finally(()=>{clone.remove();src.style.visibility='';manualKhanSource?.classList.remove('selected','pull-striker');manualKhanSource=null;strikingKhan=false;internalKhan=true;khan.click();internalKhan=false});
  }

  function impact(x,y){const el=document.createElement('div');Object.assign(el.style,{position:'fixed',left:`${x}px`,top:`${y}px`,width:'24px',height:'24px',borderRadius:'50%',border:'3px solid #fff4bd',boxShadow:'0 0 0 7px rgba(255,197,72,.35),0 0 28px #ffd45f',transform:'translate(-50%,-50%) scale(.25)',zIndex:'10079',pointerEvents:'none'});document.body.appendChild(el);el.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.25)'},{opacity:0,transform:'translate(-50%,-50%) scale(2.4)'}],{duration:360,easing:'ease-out'}).onfinish=()=>el.remove()}
  function syncInstruction(){const src=selected(),k=activeKhan();if(k&&!manualKhanSource&&!strikingKhan)soft('ХАН! Выбери чуко-биту, оттяни и отпусти');else if(src&&!pulling&&!k)soft('Оттяни выбранный чуко назад и отпусти')}
  function flash(text){const o=document.getElementById('objective');if(!o)return;clearTimeout(objTimer);const old=o.textContent;o.textContent=text;objTimer=setTimeout(()=>{if(o.textContent===text)o.textContent=old},1200)}
  function soft(text){const o=document.getElementById('objective');if(o&&!pulling)o.textContent=text}
  function pulse(el){if(!el)return;const base=el.style.transform;el.animate([{transform:base},{transform:`${base} scale(1.12)`},{transform:base}],{duration:360,easing:'ease-out'})}
  function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
})();