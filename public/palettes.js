(() => {
  const palettes = {
    copper: {
      name:'Copper and Slate', colors:['#15262d','#45606d','#bc784c','#f1e3c9'],
      dark:[.13,.059,.032], light:[.83,.54,.32], tunnel:'#f5a261', glow:0xffc081,
      matrix:'.78 .61 -.28 0 .004  .065 .72 .14 0 -.012  .035 -.165 1.075 0 .028  0 0 0 1 0',
      red:'.008 .20 .48 .79 1', green:'.016 .18 .43 .72 .94', blue:'.039 .235 .49 .75 .91',
      mark:'#f0cca0', veil:'#0c1921', lamp:0xffd1a2,
    },
    cobalt: {
      name:'Cobalt and Silver', colors:['#0b1728','#294866','#8bacc9','#e0edf3'],
      dark:[.067,.12,.19], light:[.62,.78,.94], tunnel:'#8abae8', glow:0xa8d0f6,
      matrix:'1.03 .05 -.12 0 -.022  .14 .64 .17 0 0  .03 .31 .74 0 .025  0 0 0 1 0',
      red:'.003 .16 .38 .68 .94', green:'.02 .235 .52 .78 .96', blue:'.05 .30 .61 .85 1',
      mark:'#cfdfeb', veil:'#101b30', lamp:0xb4d8ff,
    },
    oxide: {
      name:'Oxide and Bone', colors:['#221417','#683a33','#b65e46','#f5e9cf'],
      dark:[.18,.044,.041], light:[.91,.53,.40], tunnel:'#f78c70', glow:0xffb39b,
      matrix:'.87 .56 -.24 0 .017  .095 .67 .13 0 -.022  .095 -.175 1.05 0 -.001  0 0 0 1 0',
      red:'.012 .23 .57 .88 1', green:'.011 .145 .37 .68 .91', blue:'.026 .18 .41 .69 .86',
      mark:'#f5caad', veil:'#221315', lamp:0xffb895,
    },
  };
  const requested = new URLSearchParams(location.search).get('palette');
  let saved;
  try { saved=localStorage.getItem('offline-palette'); } catch {}
  const id = Object.hasOwn(palettes, requested||'') ? requested : Object.hasOwn(palettes,saved||'') ? saved : 'cobalt';
  window.OFFLINE_PALETTES = palettes;
  window.OFFLINE_PALETTE = palettes[id];
  document.documentElement.dataset.palette = id;
  document.documentElement.style.setProperty('--palette-mark',palettes[id].mark);
  document.documentElement.style.setProperty('--palette-veil',palettes[id].veil);
  function applyFilter() {
    const filter = document.getElementById('offline-color');
    if(!filter) return;
    filter.querySelector('feColorMatrix')?.setAttribute('values',palettes[id].matrix);
    for(const [selector,channel] of [['feFuncR','red'],['feFuncG','green'],['feFuncB','blue']]){
      filter.querySelector(selector)?.setAttribute('tableValues',palettes[id][channel]);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyFilter,{once:true});
  else applyFilter();
})();
