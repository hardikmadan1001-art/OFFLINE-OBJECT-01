import * as THREE from 'three';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

declare global {
  interface Window {
    OFFLINE_PALETTE: { glow: number; lamp: number };
  }
}

function webbingMaterial() {
  const drawing = document.createElement('canvas');
  drawing.width = 32;
  drawing.height = 128;
  const ctx = drawing.getContext('2d')!;
  ctx.fillStyle = '#23292c';
  ctx.fillRect(0, 0, 32, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 32; x += 2) {
      ctx.fillStyle = (y + x * 2) % 8 === 0 ? '#6e7370' : '#434849';
      ctx.fillRect(x, y, 1, 3);
    }
  }
  ctx.fillStyle = '#90928a';
  for (let y = 0; y < 128; y += 8) {
    ctx.fillRect(2, y, 1, 4);
    ctx.fillRect(29, y, 1, 4);
  }
  const map = new THREE.CanvasTexture(drawing);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.y = 4;
  return new THREE.MeshStandardMaterial({ map, roughness: .93, metalness: .02 });
}

function makeSuspension(product: THREE.Object3D) {
  const pin = new THREE.MeshStandardMaterial({ color: '#73685c', roughness: .44, metalness: .69 });
  const mount = product.getObjectByName('SuspensionEye')?.position;
  const x = mount?.x ?? -.53;
  const y = mount?.y ?? 1.18;
  const z = mount?.z ?? -.005;
  const eye = new THREE.Mesh(new THREE.TorusGeometry(.082, .016, 8, 24), pin);
  eye.position.set(x, y + .064, z);
  eye.scale.x = .8;
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(.043, .05, .077, 16), pin);
  stud.position.set(x, y, z);
  product.add(stud, eye);

  const strap = new THREE.Mesh(new THREE.BoxGeometry(.103, 1, .028), webbingMaterial());
  const upperClasp = new THREE.Mesh(new THREE.BoxGeometry(.122, .118, .047), pin);
  const tab = new THREE.Mesh(new THREE.BoxGeometry(.114, .112, .040), pin);
  strap.add(upperClasp, tab);
  return { strap, eye, upperClasp, tab };
}

export async function installCanopy(scene: THREE.Scene, loader: GLTFLoader, host: HTMLElement, product: THREE.Object3D) {
  const photo = host.querySelector<HTMLImageElement>('.canopy img')!;
  const forest = new THREE.Group();
  scene.add(forest);
  const hardware = makeSuspension(product);
  const support = loader.loadAsync('/assets/finale/canopy-branch.glb').then(({ scene: branch }) => {
    forest.add(branch);
    return branch.getObjectByName('StrapAnchor');
  }).catch(() => undefined);
  const [anchor] = await Promise.all([support, photo.decode().catch(() => {})]);
  if (anchor) forest.add(hardware.strap);

  const top = new THREE.Vector3();
  const bottom = new THREE.Vector3();
  const span = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    setVisible(visible: boolean) {
      forest.visible = visible;
      hardware.eye.visible = visible;
    },
    frame(progress: number) {
      host.style.setProperty('--canopy-scale', String(1.035 + progress * .055));
      host.style.setProperty('--canopy-drift', (1.2 - progress * 1.7) + '%');
      if (anchor) {
        anchor.getWorldPosition(top);
        hardware.eye.localToWorld(bottom.set(0, .071, 0));
        span.subVectors(top, bottom);
        const distance = span.length();
        const { strap, upperClasp, tab } = hardware;
        strap.position.copy(top).lerp(bottom, .5);
        strap.scale.y = distance;
        strap.quaternion.setFromUnitVectors(up, span.normalize());
        upperClasp.scale.y = 1 / distance;
        upperClasp.position.y = .5 - .053 / distance;
        tab.scale.y = 1 / distance;
        tab.position.y = -.5 + .048 / distance;
      }
    },
  };
}
