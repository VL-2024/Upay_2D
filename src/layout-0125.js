// UPAY 2D v0.1.25-alpha — balanced positions without runtime recolouring.
(function(){
  const host=document.getElementById('pixiHost');if(!host)return;
  const style=document.createElement('style');
  style.textContent=`
    .game-piece.normal{--piece-tint:none!important;image-rendering:auto;filter:drop-shadow(0 5px 4px rgba(0,0,0,.22))!important}
    .game-piece.normal.source-ready{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 7px rgba(76,211,255,.70)) drop-shadow(0 5px 4px rgba(0,0,0,.20))!important}
    .game-piece.normal.selected{filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 10px rgba(82,207,255,.82)) drop-shadow(0 6px 4px rgba(0,0,0,.22))!important}
    .game-piece.normal.valid-target{filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 11px rgba(247,201,92,.86)) drop-shadow(0 5px 4px rgba(0,0,0,.20))!important}
    .game-piece.normal.aim-candidate{filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 14px rgba(255,211,95,.92)) drop-shadow(0 5px 4px rgba(0,0,0,.20))!important}
    .game-piece.normal.pose-guide-match{opacity:1!important;filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 10px rgba(92,211,255,.78)) drop-shadow(0 5px 4px rgba(0,0,0,.20))!important}
    .game-piece.normal.invalid-target{opacity:.58!important;filter:brightness(.94) drop-shadow(0 4px 3px rgba(0,0,0,.16))!important}
    .game-piece.normal.pose-guide-dim{opacity:.52!important;filter:brightness(.92) drop-shadow(0 4px 3px rgba(0,0,0,.16))!important}
    .slot img{filter:drop-shadow(0 3px 2px rgba(0,0,0,.18))!important}
  `;
  document.head.appendChild(style);
  let timer=null;
  new MutationObserver(schedule).observe(host,{childList:true,subtree:true});
  window.addEventListener('resize',schedule);schedule();
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,30)}
  function slots(){const cx=50,cy=45.2,defs=[{rx:11.5,ry:5.2,o:-82},{rx:20.5,ry:9.2,o:-46},{rx:29,ry:12.7,o:-10}],out=[];let k=0;defs.forEach((r,ring)=>{for(let i=0;i<5;i++){const a=(r.o+i*72)*Math.PI/180;out.push({index:k++,ring,sector:i,x:cx+Math.cos(a)*r.rx,y:cy+Math.sin(a)*r.ry})}});return out}
  function apply(){
    const pieces=[...host.querySelectorAll('.game-piece.normal')];if(pieces.length<10)return;
    const s=slots(),groups=new Map();pieces.forEach(el=>{const pose=el.dataset.pose||'chik';if(!groups.has(pose))groups.set(pose,[]);groups.get(pose).push(el)});
    const free=s.map((_,i)=>i),assigned=new Map();
    [...groups.values()].sort((a,b)=>b.length-a.length).forEach((group,gi)=>{const used=[];group.forEach((el,pi)=>{let best=free[0],score=-Infinity;free.forEach(idx=>{const q=s[idx];let sc=0;if(used.length){let md=1e9;used.forEach(prev=>{const p=s[prev],dx=(q.x-p.x)*1.35,dy=(q.y-p.y)*2.8;md=Math.min(md,Math.hypot(dx,dy));if(q.ring===p.ring)sc-=7;if(q.sector===p.sector)sc-=12});sc+=md*3.2}else sc+=((q.sector*2+q.ring+gi)%5)*2;sc+=((q.index+gi*3+pi*2)%7)*.12;if(sc>score){score=sc;best=idx}});assigned.set(el,best);used.push(best);free.splice(free.indexOf(best),1)})});
    pieces.forEach(el=>{const q=s[assigned.get(el)];if(q){el.style.left=`${q.x}%`;el.style.top=`${q.y}%`}});
  }
})();
