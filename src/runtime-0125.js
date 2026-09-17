// UPAY 2D v0.1.25-alpha
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
