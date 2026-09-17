// UPAY 2D v0.1.21-alpha
// Keeps decorative chuko colours visible in every UI state and normalizes the main action label.
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .game-piece.normal[data-color="turquoise"]{--piece-tint:sepia(.75) saturate(4.6) hue-rotate(118deg) brightness(1.05) contrast(1.04)}
    .game-piece.normal[data-color="azure"]{--piece-tint:sepia(.72) saturate(4.2) hue-rotate(155deg) brightness(1.04) contrast(1.06)}
    .game-piece.normal[data-color="violet"]{--piece-tint:sepia(.72) saturate(4.3) hue-rotate(215deg) brightness(1.03) contrast(1.05)}
    .game-piece.normal[data-color="coral"]{--piece-tint:sepia(.72) saturate(4.4) hue-rotate(320deg) brightness(1.06) contrast(1.04)}
    .game-piece.normal[data-color="lime"]{--piece-tint:sepia(.70) saturate(4.0) hue-rotate(62deg) brightness(1.08) contrast(1.02)}

    .game-piece.normal{filter:var(--piece-tint,none) drop-shadow(0 8px 6px rgba(0,0,0,.28))!important}
    .game-piece.normal.source-ready{filter:var(--piece-tint,none) drop-shadow(0 0 3px #fff) drop-shadow(0 0 12px rgba(77,214,255,.95)) drop-shadow(0 8px 6px rgba(0,0,0,.26))!important}
    .game-piece.normal.selected{filter:var(--piece-tint,none) drop-shadow(0 0 5px #fff) drop-shadow(0 0 18px #63dfff) drop-shadow(0 9px 7px rgba(0,0,0,.30))!important}
    .game-piece.normal.valid-target{filter:var(--piece-tint,none) drop-shadow(0 0 5px #fff) drop-shadow(0 0 18px #ffd96c) drop-shadow(0 8px 6px rgba(0,0,0,.26))!important}
    .game-piece.normal.aim-candidate{filter:var(--piece-tint,none) drop-shadow(0 0 6px #fff) drop-shadow(0 0 24px #ffe078) drop-shadow(0 0 36px rgba(255,188,40,.8))!important}
    .game-piece.normal.pose-guide-match{filter:var(--piece-tint,none) drop-shadow(0 0 5px #fff) drop-shadow(0 0 17px #65ddff) drop-shadow(0 8px 6px rgba(0,0,0,.26))!important}
    .game-piece.normal.invalid-target,.game-piece.normal.pose-guide-dim{filter:var(--piece-tint,none) grayscale(.38) drop-shadow(0 4px 3px rgba(0,0,0,.14))!important}

    .main-btn{font-size:34px!important;letter-spacing:-.025em}
    @media(max-width:700px){.main-btn{font-size:22px!important}}
  `;
  document.head.appendChild(style);

  function normalizeActionButton(){
    const btn=document.getElementById('newGameBtn');
    if(!btn)return;
    const node=[...btn.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
    if(!node)return;
    const text=(node.nodeValue||'').trim();
    if(text.startsWith('БРОСОК') && text!=='БРОСОК / УДАР') node.nodeValue='БРОСОК / УДАР ';
    else if(text.startsWith('НОВАЯ ИГРА') && text!=='НОВАЯ ИГРА') node.nodeValue='НОВАЯ ИГРА ';
  }

  function watch(){
    normalizeActionButton();
    const btn=document.getElementById('newGameBtn');
    if(!btn){setTimeout(watch,100);return;}
    new MutationObserver(()=>normalizeActionButton()).observe(btn,{subtree:true,childList:true,characterData:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',watch,{once:true});
  else watch();
})();
