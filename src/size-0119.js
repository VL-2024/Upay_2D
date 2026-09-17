// UPAY 2D v0.1.19-alpha
// Size-only visual patch. Keeps the stable v0.1.17 gameplay untouched.
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .game-piece.normal{width:15.4%!important}
    .game-piece.khan{width:16.4%!important}
    @media(max-width:700px){
      .game-piece.normal{width:15.8%!important}
      .game-piece.khan{width:16.8%!important}
    }
  `;
  document.head.appendChild(style);
})();
