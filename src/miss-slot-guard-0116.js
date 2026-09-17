// Guards filled UPAY slots during the scripted first miss.
(function(){
  document.addEventListener('click', (event) => {
    const target=event.target.closest?.('.game-piece.normal');
    const source=document.querySelector('.game-piece.normal.selected');
    const objective=document.getElementById('objective');
    if(!target || !source || target===source || !objective) return;
    if(!/Последний удар/i.test(objective.textContent||'')) return;
    const snapshot=[...document.querySelectorAll('.slot')].map(slot=>slot.querySelector('img')?.src || null);
    window.setTimeout(()=>{
      document.querySelectorAll('.slot').forEach((slot,index)=>{
        const src=snapshot[index];
        if(!src) return;
        let img=slot.querySelector('img');
        if(!img){ img=document.createElement('img'); slot.appendChild(img); slot.classList.add('filled'); }
        img.src=src;
      });
    },1250);
  },true);
})();
