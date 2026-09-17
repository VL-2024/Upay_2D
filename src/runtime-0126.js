// UPAY 2D v0.1.26-alpha
(function(){
  const map={
    'chuko_01.webp':'./assets/chuko/chuko_chik.webp',
    'chuko_02.webp':'./assets/chuko/chuko_aykur.webp',
    'chuko_03.webp':'./assets/chuko/chuko_taa.webp',
    'chuko_04.webp':'./assets/chuko/chuko_aykur.webp',
    'chuko_05.webp':'./assets/chuko/chuko_bok.webp',
  };
  const rewrite=v=>{const s=String(v??''),f=s.split('/').pop()?.split('?')[0];return map[f]||s};
  const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  if(d?.get&&d?.set) Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:d.configurable,enumerable:d.enumerable,get:d.get,set(v){return d.set.call(this,rewrite(v))}});

  const nativeSetTimeout=window.setTimeout.bind(window);
  window.setTimeout=function(fn,delay,...args){
    if(typeof fn==='function'&&Number(delay)===210){
      const s=Function.prototype.toString.call(fn);
      if(s.includes('piece.pose=nextPose')&&s.includes('el.src=nextSrc')) return nativeSetTimeout(()=>{},0);
    }
    return nativeSetTimeout(fn,delay,...args);
  };

  // Make a struck chuko really leave the carpet first, pause at the edge,
  // and only then arc into the UPAY slot.
  const nativeAnimate=Element.prototype.animate;
  Element.prototype.animate=function(keyframes,options){
    const frames=Array.isArray(keyframes)?keyframes:[];
    const opts=typeof options==='number'?{duration:options}:{...(options||{})};
    const duration=Number(opts.duration||0);

    const looksLikeTargetKick=
      duration===360 && this instanceof HTMLImageElement &&
      this.classList?.contains('game-piece') && this.classList?.contains('normal') &&
      frames.length===3 && String(frames[1]?.transform||'').includes('rotate(24deg)');

    if(looksLikeTargetKick){
      const target=this;
      const shell=document.getElementById('appShell');
      const source=[...document.querySelectorAll('.game-piece.normal')].find(el=>el!==target&&el.style.visibility==='hidden');
      if(shell&&source){
        const tr=target.getBoundingClientRect(),sr=source.getBoundingClientRect(),br=shell.getBoundingClientRect();
        const tx=tr.left+tr.width/2,ty=tr.top+tr.height/2,sx=sr.left+sr.width/2,sy=sr.top+sr.height/2;
        let vx=tx-sx,vy=ty-sy;const len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;
        const margin=Math.max(34,tr.width*.38);
        const candidates=[];
        if(vx>0.001)candidates.push((br.right-tx+margin)/vx);
        if(vx<-0.001)candidates.push((br.left-tx-margin)/vx);
        if(vy>0.001)candidates.push((br.bottom-ty+margin)/vy);
        if(vy<-0.001)candidates.push((br.top-ty-margin)/vy);
        let dist=Math.min(...candidates.filter(v=>Number.isFinite(v)&&v>0));
        if(!Number.isFinite(dist))dist=Math.max(br.width,br.height)*.55;
        dist=Math.max(dist,Math.max(150,tr.width*1.7));
        const ex=vx*dist,ey=vy*dist;
        const midDist=Math.min(dist*.48,105),mx=vx*midDist,my=vy*midDist-Math.min(26,tr.height*.18);
        const base=frames[0]?.transform||target.style.transform||'';
        const spin=(vx>=0?1:-1)*(165+Math.random()*70);
        return nativeAnimate.call(target,[
          {offset:0,transform:base},
          {offset:.32,transform:`${base} translate(${mx.toFixed(1)}px,${my.toFixed(1)}px) rotate(${(spin*.34).toFixed(1)}deg) scale(1.08)`},
          {offset:1,transform:`${base} translate(${ex.toFixed(1)}px,${ey.toFixed(1)}px) rotate(${spin.toFixed(1)}deg) scale(.96)`}
        ],{duration:330,easing:'cubic-bezier(.16,.72,.18,1)',fill:'forwards'});
      }
    }

    const looksLikeSlotFlight=
      duration===560 && this instanceof HTMLImageElement &&
      this.style?.position==='fixed' && frames.length===3 &&
      frames[0]?.left!=null && frames[2]?.left!=null && frames[2]?.width!=null;

    if(looksLikeSlotFlight){
      const adjusted=frames.map(f=>({...f}));
      const n=v=>Number.parseFloat(String(v||'0'))||0;
      const sx=n(adjusted[0].left),sy=n(adjusted[0].top),ex=n(adjusted[2].left),ey=n(adjusted[2].top);
      adjusted[1].left=`${((sx+ex)/2).toFixed(1)}px`;
      adjusted[1].top=`${(Math.min(sy,ey)-Math.max(72,Math.abs(ex-sx)*.12)).toFixed(1)}px`;
      adjusted[1].transform='rotate(170deg) scale(.78)';
      adjusted[2].transform='rotate(315deg) scale(.72)';
      return nativeAnimate.call(this,adjusted,{...opts,duration:700,delay:190,easing:'cubic-bezier(.18,.72,.2,1)',fill:'forwards'});
    }

    return nativeAnimate.call(this,keyframes,options);
  };

  const style=document.createElement('style');
  style.textContent=`
    .pose-guide-btn[data-pose="aykur"]{border-color:#4c7cff!important}
    .pose-guide-btn[data-pose="taa"]{border-color:#52c96b!important}
    .pose-guide-btn[data-pose="bok"]{border-color:#ff70bf!important}
    .pose-guide-btn[data-pose="chik"]{border-color:#ffad3b!important}
    .pose-guide-btn[data-pose="aykur"].active{background:#245bd8!important}
    .pose-guide-btn[data-pose="taa"].active{background:#258f3d!important}
    .pose-guide-btn[data-pose="bok"].active{background:#bd3b86!important}
    .pose-guide-btn[data-pose="chik"].active{background:#c87816!important}
    .main-btn{font-size:34px!important;letter-spacing:-.025em}
    @media(max-width:700px){.main-btn{font-size:22px!important}}
  `;
  document.head.appendChild(style);

  function normalizeButton(){
    const btn=document.getElementById('newGameBtn');if(!btn)return;
    const n=[...btn.childNodes].find(x=>x.nodeType===Node.TEXT_NODE);if(!n)return;
    const t=(n.nodeValue||'').trim();
    if(t.startsWith('БРОСОК')&&t!=='БРОСОК / УДАР')n.nodeValue='БРОСОК / УДАР ';
    else if(t.startsWith('НОВАЯ ИГРА')&&t!=='НОВАЯ ИГРА')n.nodeValue='НОВАЯ ИГРА ';
  }
  function watch(){
    normalizeButton();const btn=document.getElementById('newGameBtn');
    if(!btn){nativeSetTimeout(watch,100);return}
    new MutationObserver(normalizeButton).observe(btn,{subtree:true,childList:true,characterData:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();
