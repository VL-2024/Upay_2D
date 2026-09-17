// UPAY 2D v0.1.4b-alpha
// Slower visual strike: selected chuko clearly travels to the target and returns.

(function(){
  let running = false;

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('.game-piece.normal');
    if (!target || running) return;

    const source = document.querySelector('.game-piece.normal.selected');
    if (!source || source === target) return;

    flyStriker(source, target);
  }, true);

  function flyStriker(source, target){
    const a = source.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (!a.width || !b.width) return;

    running = true;

    const sx = a.left;
    const sy = a.top;
    const sw = a.width;
    const sh = a.height;
    const scx = a.left + a.width / 2;
    const scy = a.top + a.height / 2;
    const tcx = b.left + b.width / 2;
    const tcy = b.top + b.height / 2;
    const dx = tcx - scx;
    const dy = tcy - scy;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / dist;
    const uy = dy / dist;

    const contactDistance = Math.max(24, dist - Math.max(b.width, b.height) * 0.36);
    const contactLeft = sx + ux * contactDistance;
    const contactTop = sy + uy * contactDistance;
    const recoilLeft = sx - ux * 13;
    const recoilTop = sy - uy * 13;

    const clone = source.cloneNode(true);
    clone.classList.remove('selected');
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${sx}px`,
      top: `${sy}px`,
      width: `${sw}px`,
      height: `${sh}px`,
      margin: '0',
      transform: 'none',
      transformOrigin: '50% 50%',
      zIndex: '10050',
      pointerEvents: 'none',
      opacity: '1',
      filter: 'drop-shadow(0 9px 7px rgba(0,0,0,.32)) drop-shadow(0 0 7px rgba(255,255,255,.35))',
    });

    document.body.appendChild(clone);
    source.style.visibility = 'hidden';

    const duration = 900;
    const flight = clone.animate([
      { offset: 0, left: `${sx}px`, top: `${sy}px`, transform: 'rotate(0deg) scale(1)' },
      { offset: .16, left: `${recoilLeft}px`, top: `${recoilTop - 3}px`, transform: 'rotate(-10deg) scale(1.03)' },
      { offset: .58, left: `${contactLeft}px`, top: `${contactTop - 18}px`, transform: 'rotate(145deg) scale(1.09)' },
      { offset: .68, left: `${contactLeft + ux * 8}px`, top: `${contactTop + uy * 8 - 12}px`, transform: 'rotate(190deg) scale(1.06)' },
      { offset: 1, left: `${sx}px`, top: `${sy}px`, transform: 'rotate(330deg) scale(1)' },
    ], {
      duration,
      easing: 'cubic-bezier(.18,.70,.18,1)',
      fill: 'forwards'
    });

    window.setTimeout(() => knockTarget(target, ux, uy), 520);

    flight.finished.catch(() => {}).finally(() => {
      clone.remove();
      source.style.visibility = '';
      running = false;
    });
  }

  function knockTarget(target, ux, uy){
    if (!target?.isConnected) return;
    const base = target.style.transform;
    target.animate([
      { offset: 0, transform: base },
      { offset: .35, transform: `${base} translate(${ux * 42}px, ${uy * 34 - 16}px) rotate(24deg) scale(1.08)` },
      { offset: .68, transform: `${base} translate(${ux * 28}px, ${uy * 22 - 9}px) rotate(42deg) scale(1.04)` },
      { offset: 1, transform: base },
    ], {
      duration: 430,
      easing: 'cubic-bezier(.18,.72,.2,1)'
    });
  }
})();
