const choices = document.querySelector('.choices');
const status = document.querySelector('[role="status"]');
function markSelected(id) {
  for (const card of choices.children) {
    const active = card.dataset.id === id;
    card.toggleAttribute('selected',active);
    const button = card.querySelector('button');
    button.setAttribute('aria-pressed', String(active));
    button.textContent = active ? 'Selected' : 'Use palette';
  }
}
for (const [id,palette] of Object.entries(window.OFFLINE_PALETTES)) {
  const article=document.createElement('article');
  article.dataset.id=id;
  article.innerHTML='<img class="preview" alt="" src="/palette-previews/'+id+'.webp"><div class="copy"><h2></h2><div class="swatches" aria-hidden="true"></div><div class="actions"><button type="button">Use palette</button><a>Try in film</a></div></div>';
  article.querySelector('img').alt='The film’s two hands and landscape in '+palette.name;
  article.querySelector('h2').textContent=palette.name;
  article.querySelector('a').href='/?palette='+id;
  for(const color of palette.colors){
    const swatch=document.createElement('span');
    swatch.style.backgroundColor=color;
    article.querySelector('.swatches').append(swatch);
  }
  article.querySelector('button').addEventListener('click',()=>{
    try { localStorage.setItem('offline-palette',id); } catch {}
    markSelected(id);
    status.textContent=palette.name+' selected.';
  });
  choices.append(article);
}
markSelected(document.documentElement.dataset.palette);
