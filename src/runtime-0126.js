// UPAY 2D v0.1.27-alpha — stable field, random opening scatter and softer strike physics.
(function(){
  const map={
    'chuko_01.webp':'./assets/chuko/chuko_chik.webp',
    'chuko_02.webp':'./assets/chuko/chuko_aykur.webp',
    'chuko_03.webp':'./assets/chuko/chuko_taa.webp',
    'chuko_04.webp':'./assets/chuko/chuko_aykur.webp',
    'chuko_05.webp':'./assets/chuko/chuko_bok.webp',
  };
  const rewrite=v=>{const s=String(v??''),f=s.split('/').pop()?.split('?')[0];return map[f]||s};
  const srcDesc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  if(srcDesc?.get&&srcDesc?.set){
    Object.defineProperty(HTMLImageElement.prototype,'src',{
      configurable:srcDesc.configurable,enumerable:srcDesc.enumerable,get:srcDesc.get,
      set(v){return srcDesc.set.call(this,rewrite(v))}
    });
  }

  const nativeSetTimeout=window.setTimeout.bind(window);
  window.setTimeout=function(fn,delay,...args){
    if(typeof fn==='function'){
      const s=Function.prototype.toString.call(fn);
      if(Number(delay)===210&&s.includes('piece.pose=nextPose')&&s.includes('el.src=nextSrc')){
        return nativeSetTimeout(()=>{},0);
      }
      if(Number(delay)===500&&s.includes('createImpactBurst')&&s.includes('kickTarget')){
        return nativeSetTimeout(fn,620,...args);
      }
    }
    return nativeSetTimeout(fn,delay,...args);
  };

  const nativeAnimate=Element.prototype.animate;
  const num=v=>Number.parseFloat(String(v??'0'))||0;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

  Element.prototype.animate=function(keyframes,options){
    const frames=Array.isArray(keyframes)?keyframes:[];
    const opts=typeof options==='number'?{duration:options}:{...(options||{})};
    const duration=Number(opts.duration||0);

    const looksLikeStrike=
      duration===860 && this instanceof HTMLImageElement && this.style?.position==='fixed' &&
      this.style?.zIndex==='10080' && frames.length===5 && frames[0]?.left!=null && frames[4]?.left!=null;
    if(looksLikeStrike){
      const adjusted=frames.map(f=>({...f}));
      const impact={...adjusted[3],offset:1,transform:'rotate(250deg) scale(1)'};
      adjusted[4]=impact;

      const hidden=[...document.querySelectorAll('#pixiHost .game-piece.normal')].find(el=>el.style.visibility==='hidden');
      const shell=document.getElementById('appShell');
      if(hidden&&shell){
        const sr=hidden.getBoundingClientRect(),br=shell.getBoundingClientRect();
        const cx=num(impact.left)+sr.width/2,cy=num(impact.top)+sr.height/2;
        const leftPct=clamp((cx-br.left)/br.width*100,12,88);
        const topPct=clamp((cy-br.top)/br.height*100,28,63);
        nativeSetTimeout(()=>{
          if(!hidden.isConnected)return;
          hidden.style.left=`${leftPct.toFixed(2)}%`;
          hidden.style.top=`${topPct.toFixed(2)}%`;
        },980);
      }
      return nativeAnimate.call(this,adjusted,{...opts,duration:1050,easing:'cubic-bezier(.20,.64,.18,1)',fill:'forwards'});
    }

    const looksLikeTargetKick=
      duration===360 && this instanceof HTMLImageElement &&
      this.classList?.contains('game-piece') && this.classList?.contains('normal') &&
      frames.length===3 && String(frames[1]?.transform||'').includes('rotate(24deg)');
    if(looksLikeTargetKick){
      const target=this,shell=document.getElementById('appShell');
      const source=[...document.querySelectorAll('#pixiHost .game-piece.normal')].find(el=>el!==target&&el.style.visibility==='hidden');
      if(shell&&source){
        const tr=target.getBoundingClientRect(),sr=source.getBoundingClientRect(),br=shell.getBoundingClientRect();
        const tx=tr.left+tr.width/2,ty=tr.top+tr.height/2,sx=sr.left+sr.width/2,sy=sr.top+sr.height/2;
        let vx=tx-sx,vy=ty-sy;const len=Math.hypot(vx,vy)||1;vx/=len;vy/=len;

        const cx=br.left+br.width*.50,cy=br.top+br.height*.465,rx=br.width*.35,ry=br.height*.145;
        const px=tx-cx,py=ty-cy;
        const A=(vx*vx)/(rx*rx)+(vy*vy)/(ry*ry);
        const B=2*((px*vx)/(rx*rx)+(py*vy)/(ry*ry));
        const C=(px*px)/(rx*rx)+(py*py)/(ry*ry)-1;
        let ray=0;
        const disc=B*B-4*A*C;
        if(disc>=0&&A>0){
          const root=Math.sqrt(disc),r1=(-B-root)/(2*A),r2=(-B+root)/(2*A);
          ray=[r1,r2].filter(v=>v>0).sort((a,b)=>a-b)[0]||0;
        }
        const extra=clamp(br.width*.045,18,38);
        let endX=tx+vx*(ray+extra),endY=ty+vy*(ray+extra);
        endX=clamp(endX,br.left+br.width*.09,br.right-br.width*.09);
        endY=clamp(endY,br.top+br.height*.30,br.top+br.height*.66);
        const ex=endX-tx,ey=endY-ty;
        const mx=ex*.58,my=ey*.58-Math.min(22,tr.height*.15);
        const base=frames[0]?.transform||target.style.transform||'';
        const spin=(vx>=0?1:-1)*(125+Math.random()*55);
        return nativeAnimate.call(target,[
          {offset:0,transform:base},
          {offset:.56,transform:`${base} translate(${mx.toFixed(1)}px,${my.toFixed(1)}px) rotate(${(spin*.48).toFixed(1)}deg) scale(1.035)`},
          {offset:1,transform:`${base} translate(${ex.toFixed(1)}px,${ey.toFixed(1)}px) rotate(${spin.toFixed(1)}deg) scale(.99)`}
        ],{duration:420,easing:'cubic-bezier(.18,.62,.22,1)',fill:'forwards'});
      }
    }

    const looksLikeSlotFlight=
      duration===560 && this instanceof HTMLImageElement && this.style?.position==='fixed' &&
      frames.length===3 && frames[0]?.left!=null && frames[2]?.left!=null && frames[2]?.width!=null;
    if(looksLikeSlotFlight){
      const adjusted=frames.map(f=>({...f}));
      const sx=num(adjusted[0].left),sy=num(adjusted[0].top),ex=num(adjusted[2].left),ey=num(adjusted[2].top);
      adjusted[1].left=`${(sx+(ex-sx)*.48).toFixed(1)}px`;
      adjusted[1].top=`${(Math.min(sy,ey)-Math.max(64,Math.abs(ex-sx)*.10)).toFixed(1)}px`;
      adjusted[1].transform='rotate(145deg) scale(.82)';
      adjusted[2].transform='rotate(285deg) scale(.74)';
      return nativeAnimate.call(this,adjusted,{...opts,duration:820,delay:260,easing:'cubic-bezier(.20,.67,.20,1)',fill:'forwards'});
    }

    return nativeAnimate.call(this,keyframes,options);
  };

  const host=document.getElementById('pixiHost');
  let lastBatchFirst=null,scatterTimer=null;
  if(host){
    new MutationObserver(()=>scheduleScatter()).observe(host,{childList:true,subtree:false});
    scheduleScatter();
  }
  function scheduleScatter(){
    clearTimeout(scatterTimer);
    scatterTimer=nativeSetTimeout(()=>{
      const pieces=[...host.querySelectorAll('.game-piece.normal')];
      if(pieces.length!==15||pieces[0]===lastBatchFirst)return;
      lastBatchFirst=pieces[0];
      scatterOnce(pieces);
    },35);
  }
  function scatterOnce(pieces){
    const points=[];
    for(let i=0;i<pieces.length;i++){
      let best=null;
      for(let attempt=0;attempt<120;attempt++){
        const a=Math.random()*Math.PI*2;
        const r=Math.sqrt(.12+Math.random()*.88);
        const x=50+Math.cos(a)*31*r+(Math.random()-.5)*2.2;
        const y=45.4+Math.sin(a)*12.4*r+(Math.random()-.5)*1.6;
        const ok=points.every(p=>Math.hypot((x-p.x)*1.15,(y-p.y)*2.45)>10.2);
        if(ok){best={x,y};break}
        if(!best)best={x,y};
      }
      points.push(best);
    }
    for(let i=points.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[points[i],points[j]]=[points[j],points[i]]}
    pieces.forEach((el,i)=>{
      const p=points[i];
      el.style.left=`${clamp(p.x,18,82).toFixed(2)}%`;
      el.style.top=`${clamp(p.y,31,59).toFixed(2)}%`;
    });
    const khan=host.querySelector('.game-piece.khan');
    if(khan){khan.style.left=`${(49+(Math.random()-.5)*5).toFixed(2)}%`;khan.style.top=`${(45+(Math.random()-.5)*3).toFixed(2)}%`;}
  }

  const style=document.createElement('style');
  style.textContent=`
    .game-piece.normal{width:15.0%!important}
    .pose-guide-btn[data-pose="aykur"]{border-color:#4c7cff!important}
    .pose-guide-btn[data-pose="taa"]{border-color:#52c96b!important}
    .pose-guide-btn[data-pose="bok"]{border-color:#ff70bf!important}
    .pose-guide-btn[data-pose="chik"]{border-color:#ffad3b!important}
    .pose-guide-btn[data-pose="aykur"].active{background:#245bd8!important}
    .pose-guide-btn[data-pose="taa"].active{background:#258f3d!important}
    .pose-guide-btn[data-pose="bok"].active{background:#bd3b86!important}
    .pose-guide-btn[data-pose="chik"].active{background:#c87816!important}
    .main-btn{font-size:34px!important;letter-spacing:-.025em}
    @media(max-width:700px){.game-piece.normal{width:15.4%!important}.main-btn{font-size:22px!important}}
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
