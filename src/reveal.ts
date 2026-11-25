import * as THREE from 'three';

export const macroEnd = 7.25;
export const revealEnd = 10.6;

const shots = [
  { from: .42, to: 2.16, focus: 'EdgeFocus', fallback: [.76,.19,.13], drift: [0,.43,0], eye: [.68,.03,.73], lens: 33, key: 1.9 },
  { from: 2.16, to: 3.83, focus: 'VolumeCrown', fallback: [.45,1.32,0], drift: [-.06,.04,0], eye: [.46,.64,1.09], lens: 24, key: 3.45 },
  { from: 3.83, to: 5.43, focus: 'BrandFocus', fallback: [-.38,-.18,.15], drift: [.12,-.014,0], eye: [-.44,.16,1.07], lens: 33, key: 2.8 },
  { from: 5.43, to: 7.25, focus: 'DisplaySurface', fallback: [-.15,.54,.16], drift: [.05,.02,0], eye: [-.31,.17,1.99], lens: 35, key: 1.85 },
];

export function makeReflection(renderer: THREE.WebGLRenderer) {
  const rig = new THREE.Scene();
  rig.background = new THREE.Color('#070c13');
  const panels = [
    { color: 0xe4ecff, power: 5.4, position: [2.9,1.1,2.6], size:[.27,5] },
    { color: 0xffdec1, power: 4.6, position: [-2.8,2.6,2.1], size:[1.3,4.4] },
    { color: 0xc3dafe, power: 2.2, position: [1,4,-2.4], size:[4,2] },
  ];
  for (const {color,power,position,size} of panels) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0],size[1]),
      new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide}),
    );
    plate.position.set(position[0],position[1],position[2]);
    plate.lookAt(0,0,0);
    rig.add(plate);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const reflection = pmrem.fromScene(rig,.035,.08,20);
  pmrem.dispose();
  for (const object of rig.children) {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  }
  return reflection.texture;
}

export function prepareMacro(product: THREE.Object3D) {
  const targets = shots.map(({focus,fallback}) => {
    const object = product.getObjectByName(focus);
    if (object) {
      if (focus === 'DisplaySurface') {
        const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
        return product.worldToLocal(center);
      }
      return product.worldToLocal(object.getWorldPosition(new THREE.Vector3()));
    }
    return new THREE.Vector3(fallback[0],fallback[1],fallback[2]);
  });
  const target = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const roll = [-.24,-.18,-.045,.025];
  return (time: number, camera: THREE.PerspectiveCamera) => {
    const index = shots.findIndex(({to}) => time < to);
    const shot = shots[Math.max(0,index)];
    const portion = THREE.MathUtils.smoothstep(time,shot.from,shot.to);
    target.copy(targets[Math.max(0,index)]);
    target.x += shot.drift[0]*(portion-.5);
    target.y += shot.drift[1]*(portion-.5);
    target.z += shot.drift[2]*(portion-.5);
    product.localToWorld(target);
    offset.set(shot.eye[0] + (portion-.5)*.23,shot.eye[1] + (portion-.5)*.11,shot.eye[2] - .08*portion);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.rotateZ(roll[Math.max(0,index)] + .065*portion);
    camera.fov = shot.lens;
    const open = THREE.MathUtils.smoothstep(time,shot.from,shot.from + (index === 0 ? .74 : .18));
    const close = 1 - THREE.MathUtils.smoothstep(time,shot.to - .18,shot.to);
    return { name:shot.focus, shutter: 1 - open * close, key: shot.key * (.23 + .77 * portion), screen: time > 5.75 };
  };
}
