import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './object.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { installCanopy } from './finale';
import { macroEnd, makeReflection, prepareMacro, revealEnd } from './reveal';

const params = new URLSearchParams(location.search);
const embedded = params.has('embedded');
const palette = window.OFFLINE_PALETTE;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const skipIntro = reduced || (!embedded && Boolean(location.hash));
let revealStarted = embedded ? undefined : performance.now();
if (embedded) {
  window.addEventListener('message', (event) => {
    if (event.origin === location.origin && event.source === parent && event.data === 'offline:reveal') {
      revealStarted ??= performance.now();
    }
  });
}
const studioCanvas = document.querySelector<HTMLCanvasElement>('#studio-film')!;
const playerCanvas = document.querySelector<HTMLCanvasElement>('#product-player')!;
const studio = document.querySelector<HTMLElement>('.studio')!;
const still = document.querySelector<HTMLImageElement>('.still img')!;
const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
const productView = document.querySelector<HTMLElement>('.product-view')!;
const notify = (state: string) => { if (window.parent !== window) parent.postMessage(state, location.origin); };
still.src = '/assets/finale/player-still.webp';

const finishList = [
  { name: 'Satin silver', shade: '#a5adb0', roughness: .31 },
  { name: 'Carbon', shade: '#3a4049', roughness: .39 },
  { name: 'Limestone', shade: '#c7b697', roughness: .43 },
  { name: 'Oxblood', shade: '#803d38', roughness: .38 },
];
const internalComponents = new Set(['InternalFrame', 'CircuitBoard', 'Battery']);
const materials = new Set<THREE.MeshStandardMaterial>();
const finishRoot = document.querySelector('.finishes')!;
const explodeButton = document.querySelector<HTMLButtonElement>('[data-explode]')!;
const radio = document.querySelector<HTMLButtonElement>('[data-radio]')!;
const finishName = document.querySelector('.finish-name')!;
const reserveFinish = dialog.querySelector('.reserve-finish')!;
let selected = 0;
let exploded = false;
let playing = false;
let note = 0;
let track = 0;
let volume = 0.55;
let soundContext: AudioContext | undefined;
let soundTimer = 0;
let screenTexture: THREE.CanvasTexture | undefined;
let screenOn = skipIntro;

function choose(index: number) {
  selected = index;
  for (const [index, button] of [...finishRoot.children].entries()) button.setAttribute('aria-pressed', String(index === selected));
  const finish = finishList[selected];
  finishName.textContent = finish.name;
  reserveFinish.textContent = finish.name;
  for (const material of materials) {
    material.color.set(finish.shade);
    material.roughness = finish.roughness;
  }
}
for (const [index, finish] of finishList.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', finish.name);
  button.style.setProperty('--finish', finish.shade);
  button.addEventListener('click', () => choose(index));
  finishRoot.append(button);
}
choose(0);

function display() {
  const image = screenTexture?.image as HTMLCanvasElement | undefined;
  const context = image?.getContext('2d');
  if (!context || !image || !screenTexture) return;
  const w = image.width;
  const h = image.height;
  context.fillStyle = '#131d21';
  context.fillRect(0, 0, w, h);
  if (screenOn) {
    context.font = '24px "IBM Plex Mono", monospace';
    context.fillStyle = '#a1bbb5';
    context.fillText('OFFLINE RADIO', 32, 56);
    context.fillText('0' + (track + 1) + ' / 03', 424, 56);
    context.fillStyle = '#dce2cf';
    context.font = '42px "IBM Plex Mono", monospace';
    context.fillText(setlist[track].title.toUpperCase(), 33, 122);
    context.fillStyle = '#849f95';
    for (let i = 0; i < 44; i++) {
      const base = 3 + 13 * Math.pow(Math.sin(i * .39), 2);
      const bar = playing ? base + Math.pow(Math.sin(i * .43 + note * .52), 2) * 36 : base;
      context.fillRect(35 + i * 11.1, 201 - bar / 2, 3, bar);
    }
    context.beginPath();
    context.moveTo(34, 239);
    context.lineTo(524, 239);
    context.strokeStyle = '#49605d';
    context.stroke();
    context.font = '21px "IBM Plex Mono", monospace';
    context.fillText(playing ? 'PLAYING' : 'PAUSED', 34, 282);
    context.fillText('VOL ' + Math.round(volume * 100), 426, 282);
  }
  screenTexture.needsUpdate = true;
}

const setlist = [
  { title: 'Soft Signal', notes: [130.81, 196, 261.63, 293.66, 329.63, 261.63, 196, 174.61] },
  { title: 'After the Feed', notes: [110, 164.81, 220, 246.94, 293.66, 246.94, 220, 164.81] },
  { title: 'Field Study', notes: [146.83, 220, 293.66, 349.23, 440, 349.23, 293.66, 220] },
];
function key() {
  if (!soundContext || !playing) return;
  const now = soundContext.currentTime;
  const oscillator = soundContext.createOscillator();
  const envelope = soundContext.createGain();
  oscillator.type = 'sine';
  const frequencies = setlist[track].notes;
  oscillator.frequency.value = frequencies[note++ % frequencies.length];
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.36 * volume), now + 0.18);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
  oscillator.connect(envelope).connect(soundContext.destination);
  oscillator.start();
  oscillator.stop(now + 1.58);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  display();
}
async function toggleRadio() {
  playing = !playing;
  clearInterval(soundTimer);
  if (playing) {
    try {
      soundContext ??= new AudioContext();
      await soundContext.resume();
      key();
      soundTimer = window.setInterval(key, 730);
    } catch {
      playing = false;
    }
  }
  radio.querySelector('span')!.textContent = playing ? 'Pause' : 'Listen';
  radio.querySelector('path')?.setAttribute('d', playing ? 'M5 3v8m4-8v8' : 'm4 2.5 7 4.5-7 4.5z');
  radio.setAttribute('aria-pressed', String(playing));
  display();
}

radio.addEventListener('click', () => void toggleRadio());
explodeButton.addEventListener('click', () => {
  exploded = !exploded;
  explodeButton.setAttribute('aria-pressed', String(exploded));
  explodeButton.querySelector('span')!.textContent = exploded ? 'Reassemble' : 'See inside';
});
document.querySelector('[data-order]')?.addEventListener('click', () => dialog.showModal());
document.querySelector('.close')?.addEventListener('click', () => dialog.close());
document.querySelector('[data-confirm]')?.addEventListener('click', () => {
  const count = Math.min(9, Math.max(1, Math.round(Number(dialog.querySelector('input')?.value) || 1)));
  dialog.querySelector('.confirmation')!.textContent = count + ' × Object 01 in ' + finishList[selected].name + '. Demo reservation confirmed.';
});
document.querySelector('.restart')?.addEventListener('click', () => {
  if (window.parent !== window) notify('offline:restart');
  else location.assign('/');
});

function keyLight(color: number, intensity: number, position: [number, number, number]) {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(...position);
  return light;
}

function rendererFor(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  return renderer;
}

function enableShadows(renderer: THREE.WebGLRenderer, key: THREE.DirectionalLight) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = .035;
  key.shadow.camera.left = key.shadow.camera.bottom = -5;
  key.shadow.camera.right = key.shadow.camera.top = 5;
}

function createPlayerView(model: THREE.Object3D) {
  const renderer = rendererFor(playerCanvas);
  const camera = new THREE.PerspectiveCamera(36, 1, .035, 80);
  const scene = new THREE.Scene();
  const rim = keyLight(palette.lamp, 2.05, [4, 3, -2]);
  const keyBeam = keyLight(0xf8eed9, 3.4, [2.6, 1.57, 3.4]);
  renderer.toneMappingExposure = 1.22;
  scene.environment = makeReflection(renderer);
  scene.environmentIntensity = 1.15;
  scene.add(model, new THREE.HemisphereLight(0xdde9ef, 0x363a35, .86),
    keyBeam, rim, keyLight(0xc2dafa, 1.05, [-1, 3, 6]));
  enableShadows(renderer, keyBeam);

  const parts: Array<{ node: THREE.Object3D; rest: THREE.Vector3; displace: THREE.Vector3 }> = [];
  model.rotation.y = -.1;
  model.traverse((node) => {
    if (Array.isArray(node.userData.explode)) {
      parts.push({ node, rest: node.position.clone(), displace: new THREE.Vector3(...node.userData.explode as [number, number, number]) });
    }
    if (node instanceof THREE.Mesh) node.castShadow = node.receiveShadow = true;
  });
  const crown = model.getObjectByName('VolumeCrown');
  camera.position.set(1.25, .73, 6.88);
  const controls = new OrbitControls(camera, playerCanvas);
  playerCanvas.style.touchAction = 'pan-y';
  controls.enableDamping = !reduced;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.update();

  const ray = new THREE.Raycaster();
  const coordinates = new THREE.Vector2();
  let startDrag: { x: number; y: number } | undefined;
  playerCanvas.addEventListener('pointerdown', (event) => {
    startDrag = { x: event.clientX, y: event.clientY };
  });
  playerCanvas.addEventListener('pointercancel', () => { startDrag = undefined; });
  playerCanvas.addEventListener('pointerup', (event) => {
    const start = startDrag;
    startDrag = undefined;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return;
    const rect = playerCanvas.getBoundingClientRect();
    coordinates.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(coordinates, camera);
    let node: THREE.Object3D | null | undefined = ray.intersectObject(model, true)[0]?.object;
    while (node) {
      if (node.name === 'ControlPlay') { void toggleRadio(); return; }
      if (node.name === 'ControlMode') { explodeButton.click(); return; }
      if (node.name === 'VolumeCrown') {
        volume = volume >= 0.93 ? 0.15 : Math.min(1, volume + 0.15);
        if (crown) crown.rotation.y = volume * 4.8;
        display();
        return;
      }
      if (node.name === 'ControlNext' || node.name === 'ControlPrevious') {
        track = (track + (node.name === 'ControlNext' ? 1 : -1) + setlist.length) % setlist.length;
        note = 0;
        if (playing) key();
        else display();
        return;
      }
      node = node.parent;
    }
  });
  playerCanvas.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      model.rotation.y += event.key === 'ArrowLeft' ? -.15 : .15;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      model.rotation.x += event.key === 'ArrowUp' ? -.11 : .11;
    } else {
      return;
    }
    event.preventDefault();
  });

  let spread = 0;
  function render() {
    controls.update();
    spread = THREE.MathUtils.lerp(spread, exploded ? 1 : 0, reduced ? 1 : .115);
    for (const { node, rest, displace } of parts) {
      node.position.copy(rest).addScaledVector(displace, spread);
      if (internalComponents.has(node.name)) node.visible = spread > .05;
    }
    renderer.render(scene, camera);
  }
  function resize() {
    const width = Math.max(1, productView.clientWidth);
    const height = Math.max(1, productView.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }
  resize();
  productView.classList.add('live');
  playerCanvas.tabIndex = 0;
  new ResizeObserver(resize).observe(productView);
  new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry.isIntersecting ? render : null);
  }, { rootMargin: '160px 0px' }).observe(productView);
}

function showFallback() {
  studio.classList.add('canopy-ready', 'finale-landed', 'fallback');
  explodeButton.disabled = true;
  notify('offline:product-ready');
}

async function createView() {
  const renderer = rendererFor(studioCanvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .035, 80);
  const reflection = makeReflection(renderer);
  const cameraEye = new THREE.Vector3();
  scene.environmentIntensity = .91;
  scene.environmentRotation.y = .4;
  const ambient = new THREE.HemisphereLight(0xdde9ef, 0x363a35, .71);
  const keyBeam = keyLight(0xf8eed9, 1.63, [-3, 6, 4]);
  const rim = keyLight(palette.lamp, 1.06, [4, 3, -2]);
  const fill = keyLight(0xc2dafa, .57, [-1, 3, 6]);
  scene.add(ambient, keyBeam, rim, fill);
  enableShadows(renderer, keyBeam);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const light = new HDRLoader().loadAsync('/assets/finale/canopy-light.hdr').then((texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }).catch(() => null);
  const [gltf, outdoor] = await Promise.all([
    loader.loadAsync('/assets/object-01-slim.glb'),
    light,
  ]);
  const model = gltf.scene;
  scene.add(model);
  const macro = prepareMacro(model);
  const forestFog = new THREE.FogExp2(0x778c9b, .025);
  model.traverse((node) => {
    if (internalComponents.has(node.name)) node.visible = false;
    if (!(node instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material instanceof THREE.MeshStandardMaterial && ['BodyFinish','FrameAlloy'].includes(material.name)) materials.add(material);
    }
  });
  choose(selected);
  const surface = model.getObjectByName('DisplaySurface');
  if (surface instanceof THREE.Mesh) {
    const drawing = document.createElement('canvas');
    drawing.width = 560;
    drawing.height = 320;
    screenTexture = new THREE.CanvasTexture(drawing);
    screenTexture.flipY = false;
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    surface.material = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
    display();
  }
  const playerModel = model.clone();
  const canopy = await installCanopy(scene, loader, studio, model);
  scene.traverse((node) => {
    if (node instanceof THREE.Mesh) node.castShadow = node.receiveShadow = true;
  });
  let phone = false;
  let width = 1;
  let height = 1;
  new ResizeObserver(() => {
    width = Math.max(1, studio.clientWidth);
    height = Math.max(1, studio.clientHeight);
    phone = width < 760;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }).observe(studio);
  let studioVisible = true;
  new IntersectionObserver(([entry]) => {
    studioVisible = entry.isIntersecting;
  }).observe(studio);
  if (!embedded) revealStarted = performance.now();
  const startCamera = new THREE.Vector3();
  const endCamera = new THREE.Vector3();
  const aim = new THREE.Vector3();
  let settled = false;

  function lighting(mode: 'detail' | 'forest', strength: number) {
    const inForest = mode === 'forest';
    scene.environment = inForest ? outdoor || reflection : reflection;
    scene.environmentRotation.y = inForest ? .40 : 0;
    scene.environmentIntensity = inForest ? .91 : .36 + strength * .19;
    scene.fog = inForest ? forestFog : null;
    keyBeam.position.set(inForest ? -3 : 2.6, inForest ? 6 : 1.1 + strength * .47, inForest ? 4 : 3.4);
    keyBeam.intensity = inForest ? 1.26 : strength;
    rim.intensity = inForest ? .88 : strength * .21;
    fill.intensity = inForest ? .45 : .08;
    ambient.intensity = inForest ? .74 : .075;
    renderer.toneMappingExposure = inForest ? 1 : 1.03;
    canopy.setVisible(inForest);
  }

  function forestView(glide: number) {
    camera.fov = phone ? 40 : 36;
    startCamera.set(phone ? -1.3 : -3.1, phone ? 2.12 : 2.68, phone ? 11.8 : 13.9);
    endCamera.set(phone ? 1.35 : 1.91, phone ? 1.05 : 1.24, phone ? 8.74 : 8.3);
    cameraEye.copy(startCamera).lerp(endCamera, glide);
    camera.position.copy(cameraEye);
    aim.set(0, .36 - .31 * glide, 0);
    camera.lookAt(aim);
    camera.rotateZ(-.041 * (1 - glide));
    camera.setViewOffset(width,height,-width * (phone ? .105 : .19),height * (phone ? -.065 : -.11),width,height);
    model.position.set(0,.14 + (1 - glide)*.21,0);
    model.rotation.set(0,-.22 * (1 - glide),-.16 + .038 * glide);
    canopy.frame(glide);
  }

  renderer.setAnimationLoop((time) => {
    if (document.hidden || revealStarted === undefined || (settled && !studioVisible)) return;
    const seconds = skipIntro ? revealEnd + 1 : Math.max(0, (time - revealStarted) / 1000);
    const inMacro = seconds < macroEnd;
    const view = inMacro ? 'detail' : 'forest';
    let shutter = 0;
    let shotName: string = view;
    let glow = 1;
    let displayVisible = true;
    if (inMacro) {
      camera.clearViewOffset();
      const shot = macro(seconds, camera);
      shutter = shot.shutter;
      shotName = shot.name;
      glow = shot.key;
      displayVisible = shot.screen;
    } else {
      if (studio.dataset.shot !== 'forest') studio.classList.add('canopy-ready');
      const glide = THREE.MathUtils.smoothstep(seconds,macroEnd,revealEnd);
      forestView(glide);
      shutter = 1 - THREE.MathUtils.smoothstep(seconds,macroEnd,macroEnd + .68);
    }
    if (displayVisible !== screenOn) {
      screenOn = displayVisible;
      display();
    }
    lighting(view, glow);
    if (studio.dataset.shot !== shotName) studio.dataset.shot = shotName;
    studio.style.setProperty('--shutter', String(shutter));
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    if (!settled && seconds >= revealEnd) {
      settled = true;
      try {
        createPlayerView(playerModel);
      } catch {
        explodeButton.disabled = true;
      }
      studio.classList.add('finale-landed');
      if (location.hash && !embedded) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'}));
    }
  });
  studio.classList.add('has-render');
  studio.style.setProperty('--shutter', skipIntro ? '0' : '1');
  notify('offline:product-ready');
}
void createView().catch(showFallback);
