(() => {
  const end = document.querySelector('#end-shot');
  const film = document.querySelector('#film-editorial');
  const chrome = document.querySelector('.film-chrome');
  const openingLine = document.querySelector('#gallery-line');
  const noiseLine = document.querySelector('#noise-line');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let lastCue;
  let lastProgress;

  function easeBetween(progress, from, to) {
    const t = Math.max(0, Math.min(1, (progress - from) / (to - from)));
    return t * t * (3 - 2 * t);
  }

  // The original camera remains the owner of time and input. These are
  // darkroom cues applied to its already-computed local scroll progress.
  function cue(stage, progress) {
    const sample = Math.round(progress * 240) / 240;
    if (lastCue === stage && lastProgress === sample) return;
    lastCue = stage;
    lastProgress = sample;
    document.body.dataset.filmCue = stage;
    document.body.style.setProperty('--tunnel-mix', stage === 'gate3to4' ?
      easeBetween(progress, 0.06, 0.84).toFixed(3) : '0');
    const opening = stage === 'stage1';
    const galleryOpacity = opening ? 1 - easeBetween(progress, 0.035, 0.138) : 0;
    const openingTitle = opening ? 1 - easeBetween(progress, 0.035, 0.105) : 0;
    const noiseTitle = stage === 'stage2' ?
      easeBetween(progress, 0.14, 0.24) * (1 - easeBetween(progress, 0.66, 0.85)) : 0;
    film?.style.setProperty('--gallery-opacity', galleryOpacity.toFixed(3));
    film?.style.setProperty('--gallery-title', openingTitle.toFixed(3));
    film?.style.setProperty('--gallery-scale', (1.025 + 0.075 * easeBetween(progress, 0, 0.138)).toFixed(4));
    film?.style.setProperty('--film-title-rise', (14 * (1 - openingTitle)).toFixed(2) + 'px');
    film?.style.setProperty('--noise-title', noiseTitle.toFixed(3));
    film?.style.setProperty('--noise-rise', (14 * (1 - noiseTitle)).toFixed(2) + 'px');
    openingLine?.setAttribute('aria-hidden', String(openingTitle < 0.5));
    noiseLine?.setAttribute('aria-hidden', String(noiseTitle < 0.5));
    document.body.toggleAttribute('data-film-gallery', galleryOpacity > 0.5);
  }
  window.OFFLINE_FILM_CUE = cue;

  function syncEntry() {
    if (document.body.hasAttribute('data-film-ready')) return;
    const hint = document.querySelector('.loader-circle-hint.is-visible');
    if (!hint) return;
    document.body.setAttribute('data-film-ready', '');
    document.querySelector('.hud-status')?.setAttribute('aria-hidden', 'true');
  }

  const entryObserver = new MutationObserver(syncEntry);
  entryObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => {
    const stage = document.body.dataset.filmStage;
    if (stage && stage !== lastCue) cue(stage, 0);
    if (stage) entryObserver.disconnect();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-film-stage'] });
  syncEntry();

  let ambientFrame;
  let productFrame;
  let productReady = false;
  let endingRequested = false;
  let revealTimer;
  function warmFinale() {
    if (productFrame || !['stage3', 'gate3to4'].includes(document.body.dataset.filmStage)) return;
    prepareObject();
  }
  new MutationObserver(warmFinale).observe(document.body, { attributes: true, attributeFilter: ['data-film-stage'] });
  function prepareObject() {
    if (productFrame) return;
    productFrame = document.createElement('iframe');
    productFrame.title = 'OFFLINE OBJECT 01';
    productFrame.src = '/object.html?embedded&palette=' + document.documentElement.dataset.palette;
    end.append(productFrame);
  }
  function revealObject() {
    if (!endingRequested || !productReady || !end?.hidden) return;
    clearTimeout(revealTimer);
    end.hidden = false;
    const sound = document.querySelector('.hud-audio-btn[aria-pressed="true"]');
    if (sound instanceof HTMLButtonElement) sound.click();
    document.querySelector('#ui-container')?.setAttribute('inert', '');
    film?.setAttribute('inert', '');
    chrome?.setAttribute('inert', '');
    document.querySelector('#webgl')?.setAttribute('aria-hidden', 'true');
    productFrame.contentWindow?.postMessage('offline:reveal', location.origin);
    const transitionTime = reducedMotion.matches ? 0 : 1460;
    window.setTimeout(() => document.body.classList.add('offline-object-open'), transitionTime);
    productFrame.focus({ preventScroll: true });
  }

  window.addEventListener('offline:object', () => {
    if (!end?.hidden || endingRequested) return;
    endingRequested = true;
    document.body.classList.add('offline-ending');
    prepareObject();
    revealObject();
    if (!productReady) revealTimer = window.setTimeout(() => {
      productReady = true;
      revealObject();
    }, 8000);
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== productFrame?.contentWindow) return;
    if (event.data === 'offline:product-ready') {
      productReady = true;
      revealObject();
    }
    if (event.data === 'offline:restart') location.reload();
  });
  const surface = document.querySelector('#webgl');
  let tracing = false;
  let traceFrame;
  let traceUntil = 0;
  const entryReady = () => document.body.classList.contains('webgl-loader-overlay') &&
    document.body.hasAttribute('data-film-ready');
  function draw(action, x = 0, y = 0) {
    window.dispatchEvent(new CustomEvent('offline:trace', { detail: { action, x, y } }));
  }
  function releaseTrace() {
    if (!tracing) return;
    tracing = false;
    cancelAnimationFrame(traceFrame);
    draw('up');
  }
  surface?.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || !entryReady()) return;
    event.preventDefault();
    event.stopPropagation();
    if (tracing || event.repeat) return;
    tracing = true;
    traceUntil = performance.now();
    const r = Math.min(innerWidth, innerHeight) * 0.18;
    const x = innerWidth / 2;
    const y = innerHeight / 2;
    draw('down', x, y - r);
    function trace(time) {
      if (!tracing) return;
      const portion = Math.min(1, (time - traceUntil) / 1350);
      const angle = portion * Math.PI * 2 - Math.PI / 2;
      draw('move', x + Math.cos(angle) * r, y + Math.sin(angle) * r);
      if (portion < 1) traceFrame = requestAnimationFrame(trace);
      else releaseTrace();
    }
    traceFrame = requestAnimationFrame(trace);
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space' && tracing) releaseTrace();
  }, true);
  surface?.addEventListener('blur', releaseTrace);

  let heldGate;
  const holdKey = (event) => event.code === 'Space' || event.code === 'Enter';
  function releaseGate() {
    if (!heldGate) return;
    heldGate = undefined;
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  }
  document.addEventListener('keydown', (event) => {
    if (!holdKey(event) || !(event.target instanceof Element)) return;
    const hit = event.target.closest('.next-stage-btn')?.querySelector('.next-stage-hit');
    if (!hit) return;
    event.preventDefault();
    if (heldGate || event.repeat) return;
    heldGate = hit;
    hit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  });
  window.addEventListener('keyup', (event) => {
    if (holdKey(event)) releaseGate();
  });
  window.addEventListener('blur', releaseGate);
  document.addEventListener('focusout', (event) => {
    if (event.target instanceof Element && event.target.closest('.next-stage-btn')) releaseGate();
  });

  // The exhibit is browse-only. The reference's registration controls have no
  // outbound action in this edition, including when someone tabs to one.
  const externalControls = '.map-panel,.hud-waitlist-btn,.waitlist-bar,.eg-track,.eg-cluster,.beta-note,.jf-overlay,.hud-menu-dropdown,[href^="https:"]';
  function clearControls() {
    for (const element of document.querySelectorAll(externalControls)) {
      if (element instanceof HTMLElement) {
        element.classList.add('local-hidden');
        element.inert = true;
      }
    }
  }
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(ambientFrame);
    ambientFrame = requestAnimationFrame(clearControls);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || !link.href || new URL(link.href).origin === location.origin) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
