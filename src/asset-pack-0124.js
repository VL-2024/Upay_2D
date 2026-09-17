// UPAY 2D v0.1.24-alpha
// Native colored assets by position + even pose distribution on the field.
(function(){
  const POSE_ASSET = {
    aykur: './assets/chuko/chuko_aykur.svg',
    taa: './assets/chuko/chuko_taa.svg',
    bok: './assets/chuko/chuko_bok.svg',
    chik: './assets/chuko/chuko_chik.svg',
  };
  const OLD_FILE_TO_POSE = {
    'chuko_01.webp': 'chik',
    'chuko_02.webp': 'aykur',
    'chuko_03.webp': 'taa',
    'chuko_04.webp': 'aykur',
    'chuko_05.webp': 'bok',
  };
  const KHAN_ASSET = {
    'khan_01.webp': './assets/khan/khan_user_01.svg',
    'khan_02.webp': './assets/khan/khan_user_02.svg',
    'khan_03.webp': './assets/khan/khan_user_03.svg',
  };
  const POSE_COLOR = {
    aykur: '#2f63ff',
    taa: '#2fbd59',
    bok: '#ff4fae',
    chik: '#ff9d20',
  };

  const style = document.createElement('style');
  style.textContent = `
    .game-piece.normal[data-native-color="1"]{filter:drop-shadow(0 7px 5px rgba(0,0,0,.24))!important;opacity:1}
    .game-piece.normal[data-native-color="1"].source-ready{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 9px rgba(87,215,255,.65)) drop-shadow(0 7px 5px rgba(0,0,0,.24))!important}
    .game-piece.normal[data-native-color="1"].selected{filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 13px rgba(88,211,255,.78)) drop-shadow(0 8px 6px rgba(0,0,0,.27))!important}
    .game-piece.normal[data-native-color="1"].valid-target,.game-piece.normal[data-native-color="1"].aim-candidate{filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 14px rgba(255,212,91,.88)) drop-shadow(0 7px 5px rgba(0,0,0,.24))!important;opacity:1!important}
    .game-piece.normal[data-native-color="1"].invalid-target{filter:brightness(.80) saturate(.82) drop-shadow(0 4px 3px rgba(0,0,0,.16))!important;opacity:.56!important}
    .game-piece.normal[data-native-color="1"].pose-guide-match{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 12px rgba(104,222,255,.72)) drop-shadow(0 7px 5px rgba(0,0,0,.22))!important;opacity:1!important}
    .game-piece.normal[data-native-color="1"].pose-guide-dim{filter:brightness(.82) saturate(.88) drop-shadow(0 4px 3px rgba(0,0,0,.15))!important;opacity:.50!important}
    .slot img[data-native-color="1"]{filter:drop-shadow(0 3px 2px rgba(0,0,0,.18))!important}
    .pose-guide-btn[data-pose]{position:relative;overflow:hidden}
    .pose-guide-btn[data-pose]::before{content:"";position:absolute;left:6px;top:50%;width:8px;height:8px;border-radius:50%;transform:translateY(-50%);background:var(--pose-color,#fff);box-shadow:0 0 7px var(--pose-color,#fff)}
    .pose-guide-btn[data-pose]{padding-left:17px!important}
    .pose-guide-btn[data-pose].active{border-color:var(--pose-color,#f1cb74)!important;box-shadow:0 0 10px color-mix(in srgb,var(--pose-color,#fff) 52%,transparent)!important}
  `;
  document.head.appendChild(style);

  function fileName(src){
    const clean=(src||'').split('?')[0].split('#')[0];
    return clean.split('/').pop();
  }

  function markPoseButtons(){
    document.querySelectorAll('.pose-guide-btn[data-pose]').forEach(btn=>{
      const color=POSE_COLOR[btn.dataset.pose];
      if(color) btn.style.setProperty('--pose-color',color);
    });
  }

  function resolvePose(img){
    if(img.dataset.pose && POSE_ASSET[img.dataset.pose]) return img.dataset.pose;
    return OLD_FILE_TO_POSE[fileName(img.getAttribute('src')||img.src)] || null;
  }

  function swapImage(img){
    if(!(img instanceof HTMLImageElement)) return;
    if(img.classList.contains('normal') || img.closest('.slot')){
      const pose=resolvePose(img);
      if(pose){
        const target=POSE_ASSET[pose];
        if(!img.getAttribute('src')?.includes(target.replace('./',''))){
          img.src=target;
        }
        img.dataset.nativeColor='1';
        img.dataset.poseAsset=pose;
        img.style.removeProperty('--piece-tint');
        img.style.filter='';
        return;
      }
    }
    if(img.classList.contains('khan')){
      const f=fileName(img.getAttribute('src')||img.src);
      const target=KHAN_ASSET[f];
      if(target && !img.getAttribute('src')?.includes(target.replace('./',''))) img.src=target;
    }
  }

  const ringDefs=[
    {rx:11.7,ry:5.3,offset:-82,order:['aykur','taa','aykur','bok','chik']},
    {rx:20.8,ry:9.4,offset:-48,order:['bok','aykur','chik','aykur','taa']},
    {rx:29.7,ry:13.0,offset:-14,order:['aykur','chik','taa','aykur','bok']},
  ];
  const sectorAngles=[0,72,144,216,288];

  function distributePieces(){
    const pieces=[...document.querySelectorAll('#pixiHost .game-piece.normal')];
    if(pieces.length<12) return;
    const byPose={aykur:[],taa:[],bok:[],chik:[]};
    pieces.forEach(el=>{const p=el.dataset.pose;if(byPose[p])byPose[p].push(el)});
    if(!byPose.aykur.length) return;

    const queues={};
    Object.entries(byPose).forEach(([pose,list])=>queues[pose]=shuffle(list));
    ringDefs.forEach((ring)=>{
      const ringRotate=(Math.random()-.5)*14;
      ring.order.forEach((pose,i)=>{
        const el=queues[pose]?.shift(); if(!el) return;
        const deg=ring.offset+sectorAngles[i]+ringRotate+(Math.random()-.5)*8;
        const a=deg*Math.PI/180;
        el.style.left=`${50+Math.cos(a)*ring.rx+(Math.random()-.5)*.9}%`;
        el.style.top=`${45.2+Math.sin(a)*ring.ry+(Math.random()-.5)*.7}%`;
        el.dataset.distributed='1';
      });
    });
  }

  function shuffle(arr){
    const a=[...arr];
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
    return a;
  }

  let distributeTimer=0;
  function scheduleDistribute(){
    clearTimeout(distributeTimer);
    distributeTimer=setTimeout(distributePieces,40);
  }

  function scan(root=document){
    if(root.matches?.('img')) swapImage(root);
    root.querySelectorAll?.('img').forEach(swapImage);
    markPoseButtons();
    scheduleDistribute();
  }

  const observer=new MutationObserver(mutations=>{
    let needsScan=false;
    mutations.forEach(m=>{
      if(m.type==='childList' && m.addedNodes.length) needsScan=true;
      if(m.type==='attributes' && (m.attributeName==='src'||m.attributeName==='data-pose'||m.attributeName==='class')){
        if(m.target instanceof HTMLImageElement) swapImage(m.target);
        needsScan=true;
      }
    });
    if(needsScan) scan(document);
  });

  function init(){
    scan(document);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','data-pose','class']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
