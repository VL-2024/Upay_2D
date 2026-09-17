// UPAY 2D v0.1.22-alpha
// Crisp canvas tinting + balanced field layout for the DOM renderer.
(function(){
  const host = document.getElementById('pixiHost');
  if(!host) return;

  const COLORS = [
    { id:'turquoise', hex:'#35c9c3' },
    { id:'azure',     hex:'#52b6e9' },
    { id:'violet',    hex:'#b77fd2' },
    { id:'coral',     hex:'#e99672' },
    { id:'lime',      hex:'#86c96b' },
  ];

  const tintCache = new Map();
  let layoutTimer = null;
  let processing = false;

  injectStyles();

  const observer = new MutationObserver((records)=>{
    let needsLayout = false;
    let needsTint = false;
    for(const record of records){
      if(record.type === 'childList'){
        needsLayout = true;
        needsTint = true;
      }
      if(record.type === 'attributes' && record.attributeName === 'src') needsTint = true;
    }
    if(needsLayout) scheduleLayout();
    if(needsTint) queueMicrotask(processAllImages);
  });
  observer.observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});

  const slotObserver = new MutationObserver(()=>queueMicrotask(processSlotImages));
  document.querySelectorAll('.zone-slots').forEach(el=>slotObserver.observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['src','style']}));

  scheduleLayout();
  processAllImages();
  processSlotImages();

  function injectStyles(){
    const style = document.createElement('style');
    style.textContent = `
      .game-piece.normal{
        --piece-tint:none!important;
        image-rendering:auto;
        filter:drop-shadow(0 5px 4px rgba(0,0,0,.22))!important;
      }
      .game-piece.normal.source-ready{
        filter:drop-shadow(0 0 2px rgba(255,255,255,.95)) drop-shadow(0 0 7px rgba(76,211,255,.70)) drop-shadow(0 5px 4px rgba(0,0,0,.20))!important;
      }
      .game-piece.normal.selected{
        filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 10px rgba(82,207,255,.82)) drop-shadow(0 6px 4px rgba(0,0,0,.22))!important;
      }
      .game-piece.normal.valid-target{
        filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 11px rgba(247,201,92,.86)) drop-shadow(0 5px 4px rgba(0,0,0,.20))!important;
      }
      .game-piece.normal.aim-candidate{
        filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 14px rgba(255,211,95,.92)) drop-shadow(0 5px 4px rgba(0,0,0,.20))!important;
      }
      .game-piece.normal.pose-guide-match{
        opacity:1!important;
        filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 10px rgba(92,211,255,.78)) drop-shadow(0 5px 4px rgba(0,0,0,.20))!important;
      }
      .game-piece.normal.invalid-target{opacity:.58!important;filter:drop-shadow(0 4px 3px rgba(0,0,0,.16))!important}
      .game-piece.normal.pose-guide-dim{opacity:.52!important;filter:drop-shadow(0 4px 3px rgba(0,0,0,.16))!important}
      .slot img{filter:drop-shadow(0 3px 2px rgba(0,0,0,.18))!important}
    `;
    document.head.appendChild(style);
  }

  function scheduleLayout(){
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(applyBalancedLayout, 20);
  }

  function applyBalancedLayout(){
    const pieces = [...host.querySelectorAll('.game-piece.normal')];
    if(pieces.length < 10) return;

    pieces.forEach((el,idx)=>{
      if(!el.dataset.pose) el.dataset.pose = inferPose(el);
      el.dataset.layoutOrder = String(idx);
    });

    const slots = makeSlots();
    const groups = new Map();
    pieces.forEach(el=>{
      const pose = el.dataset.pose || inferPose(el);
      if(!groups.has(pose)) groups.set(pose,[]);
      groups.get(pose).push(el);
    });

    const assignments = new Map();
    const freeSlots = slots.map((_,i)=>i);
    const orderedGroups = [...groups.entries()].sort((a,b)=>b[1].length-a[1].length);

    orderedGroups.forEach(([pose,group],groupIndex)=>{
      const usedForPose = [];
      group.forEach((el,pieceIndex)=>{
        const slotIndex = chooseFarthestSlot(slots,freeSlots,usedForPose,groupIndex,pieceIndex);
        assignments.set(el,slotIndex);
        usedForPose.push(slotIndex);
        freeSlots.splice(freeSlots.indexOf(slotIndex),1);
      });
    });

    pieces.forEach(el=>{
      const slot = slots[assignments.get(el)];
      if(!slot) return;
      el.style.left = `${slot.x}%`;
      el.style.top = `${slot.y}%`;
      el.dataset.fieldSlot = String(slot.index);
    });

    distributeColors(pieces,assignments,slots);
    processAllImages();
  }

  function makeSlots(){
    const cx=50, cy=45.2;
    const defs=[
      {rx:11.5,ry:5.2,offset:-82},
      {rx:20.5,ry:9.2,offset:-46},
      {rx:29.0,ry:12.7,offset:-10},
    ];
    const out=[];
    let index=0;
    defs.forEach((ring,ringIndex)=>{
      for(let i=0;i<5;i++){
        const deg = ring.offset + i*72;
        const a = deg*Math.PI/180;
        out.push({
          index:index++, ring:ringIndex, sector:i,
          x:cx+Math.cos(a)*ring.rx,
          y:cy+Math.sin(a)*ring.ry,
        });
      }
    });
    return out;
  }

  function chooseFarthestSlot(slots,freeSlots,usedForPose,groupIndex,pieceIndex){
    let best = freeSlots[0];
    let bestScore = -Infinity;
    freeSlots.forEach(slotIndex=>{
      const slot=slots[slotIndex];
      let score = 0;
      if(usedForPose.length){
        let minDist=Infinity;
        usedForPose.forEach(prev=>{
          const p=slots[prev];
          const dx=(slot.x-p.x)*1.35;
          const dy=(slot.y-p.y)*2.8;
          minDist=Math.min(minDist,Math.hypot(dx,dy));
          if(slot.ring===p.ring) score-=7;
          if(slot.sector===p.sector) score-=12;
        });
        score += minDist*3.2;
      }else{
        score += ((slot.sector*2 + slot.ring + groupIndex) % 5)*2;
      }
      score += ((slot.index + groupIndex*3 + pieceIndex*2) % 7)*0.12;
      if(score>bestScore){bestScore=score;best=slotIndex;}
    });
    return best;
  }

  function distributeColors(pieces,assignments,slots){
    const bySlot=[...pieces].sort((a,b)=>(assignments.get(a)??0)-(assignments.get(b)??0));
    const colorCounts = new Array(COLORS.length).fill(0);
    const assigned=[];

    bySlot.forEach((el,idx)=>{
      const slotIndex=assignments.get(el);
      const slot=slots[slotIndex];
      let bestColor=0, bestScore=Infinity;
      COLORS.forEach((color,colorIndex)=>{
        let score=colorCounts[colorIndex]*7;
        assigned.forEach(prev=>{
          if(prev.colorIndex!==colorIndex) return;
          const p=slots[prev.slotIndex];
          const dx=(slot.x-p.x)*1.35;
          const dy=(slot.y-p.y)*2.8;
          const d=Math.hypot(dx,dy);
          score += Math.max(0,30-d)*2.4;
          if(slot.ring===p.ring) score+=4;
          if(slot.sector===p.sector) score+=8;
        });
        score += ((idx+colorIndex*2)%5)*0.05;
        if(score<bestScore){bestScore=score;bestColor=colorIndex;}
      });
      colorCounts[bestColor]++;
      assigned.push({slotIndex,colorIndex:bestColor});
      el.dataset.color=COLORS[bestColor].id;
      const original=el.dataset.originalSrc || currentAssetSrc(el);
      if(original) el.dataset.originalSrc=original;
    });
  }

  function inferPose(el){
    const src = el.dataset.originalSrc || currentAssetSrc(el);
    const file=(src||'').split('/').pop().split('?')[0];
    if(file==='chuko_02.webp'||file==='chuko_04.webp') return 'aykur';
    if(file==='chuko_03.webp') return 'taa';
    if(file==='chuko_05.webp') return 'bok';
    return 'chik';
  }

  function currentAssetSrc(el){
    const raw=el.getAttribute('src')||'';
    if(raw.startsWith('data:image/')) return el.dataset.originalSrc||'';
    return raw;
  }

  async function processAllImages(){
    if(processing) return;
    processing=true;
    try{
      const normals=[...host.querySelectorAll('.game-piece.normal')];
      for(const el of normals) await tintElement(el);
    }finally{
      processing=false;
    }
  }

  async function processSlotImages(){
    const imgs=[...document.querySelectorAll('.slot img')];
    for(const img of imgs){
      const colorId = colorIdFromLegacyFilter(img.style.filter) || img.dataset.color || 'turquoise';
      const original = img.dataset.originalSrc || currentAssetSrc(img);
      if(!original) continue;
      img.dataset.originalSrc=original;
      img.dataset.color=colorId;
      const color=COLORS.find(c=>c.id===colorId)||COLORS[0];
      const tinted=await getTintedDataUrl(original,color.hex);
      if(tinted && img.src!==tinted) img.src=tinted;
      img.style.filter='drop-shadow(0 3px 2px rgba(0,0,0,.18))';
    }
  }

  async function tintElement(el){
    if(!el?.isConnected) return;
    const raw=el.getAttribute('src')||'';
    if(!raw.startsWith('data:image/')) el.dataset.originalSrc=raw;
    const original=el.dataset.originalSrc||raw;
    if(!original) return;
    const colorId=el.dataset.color||'turquoise';
    const color=COLORS.find(c=>c.id===colorId)||COLORS[0];
    const key=`${original}|${color.id}`;
    if(el.dataset.tintKey===key && raw.startsWith('data:image/')) return;
    const tinted=await getTintedDataUrl(original,color.hex);
    if(!tinted||!el.isConnected) return;
    el.dataset.tintKey=key;
    el.src=tinted;
  }

  function getTintedDataUrl(src,colorHex){
    const key=`${src}|${colorHex}`;
    if(tintCache.has(key)) return tintCache.get(key);
    const promise=new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{
        try{
          const canvas=document.createElement('canvas');
          canvas.width=img.naturalWidth||img.width;
          canvas.height=img.naturalHeight||img.height;
          const ctx=canvas.getContext('2d',{willReadFrequently:false});
          ctx.clearRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img,0,0);

          ctx.globalCompositeOperation='source-atop';
          ctx.globalAlpha=.58;
          ctx.fillStyle=colorHex;
          ctx.fillRect(0,0,canvas.width,canvas.height);

          ctx.globalCompositeOperation='multiply';
          ctx.globalAlpha=.18;
          ctx.drawImage(img,0,0);

          ctx.globalCompositeOperation='source-over';
          ctx.globalAlpha=.16;
          ctx.drawImage(img,0,0);
          ctx.globalAlpha=1;

          resolve(canvas.toDataURL('image/webp',.94));
        }catch(err){ resolve(null); }
      };
      img.onerror=()=>resolve(null);
      img.src=src;
    });
    tintCache.set(key,promise);
    return promise;
  }

  function colorIdFromLegacyFilter(filter){
    if(!filter) return null;
    if(filter.includes('118deg')) return 'turquoise';
    if(filter.includes('155deg')) return 'azure';
    if(filter.includes('215deg')) return 'violet';
    if(filter.includes('320deg')) return 'coral';
    if(filter.includes('62deg')) return 'lime';
    return null;
  }
})();
