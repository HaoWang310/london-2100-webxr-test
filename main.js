import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// London 2100 WebXR proof of concept. All dimensions are in metres.
const $ = id => document.getElementById(id);
const el = {
  canvas: $('scene'), demo: $('demoBtn'), sample: $('sampleBtn'),
  input: $('modelInput'), walk: $('walkBtn'), file: $('fileName'),
  size: $('sizeReadout'), status: $('notification'), hint: $('dropHint')
};
let toastTimer;
function notify(message, error = false) {
  el.status.textContent = message;
  el.status.className = 'notification ' + (error ? 'error' : 'ok');
  el.status.style.opacity = '1';
  clearTimeout(toastTimer);
  if (!error) toastTimer = setTimeout(() => { el.status.style.opacity = '.65'; }, 4500);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a121d);
scene.fog = new THREE.FogExp2(0x0a121d, 0.010);
const camera = new THREE.PerspectiveCamera(73, innerWidth / innerHeight, .06, 600);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.65, 0);
const player = new THREE.Group();
scene.add(player);
player.add(camera);
player.position.set(0, 0, 11);
const renderer = new THREE.WebGLRenderer({
  canvas: el.canvas, antialias: true, powerPreference: 'high-performance'
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(VRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'bounded-floor']
}));
scene.add(new THREE.HemisphereLight(0xd7f4ff, 0x263443, 2));
const sun = new THREE.DirectionalLight(0xeef4ff, 2.5);
sun.position.set(-8, 16, 12);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(180, 180),
  new THREE.MeshStandardMaterial({ color: 0x101e2a, roughness: .93 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.06;
scene.add(ground);
const grid = new THREE.GridHelper(130, 130, 0x3d6981, 0x1d3343);
grid.position.y = -.04;
grid.material.transparent = true;
grid.material.opacity = .21;
scene.add(grid);

const root = new THREE.Group();
scene.add(root);
let shown = null;
let walkables = [ground];
const loader = new GLTFLoader();
function mat(color, metalness = .05, roughness = .8) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
const materials = {
  slab: mat(0xc9cdd0), white: mat(0xe5eaf0),
  steel: mat(0x677987, .65, .38), timber: mat(0xa17f59),
  plant: mat(0x5f9d7b),
  accent: new THREE.MeshStandardMaterial({
    color: 0x65d7e6, emissive: 0x123b45, roughness: .45
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xaed7e6, metalness: .1, roughness: .1,
    transparent: true, opacity: .27, depthWrite: false,
    side: THREE.DoubleSide
  })
};
function block(group, sx, sy, sz, x, y, z, material, floor = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  if (floor) walkables.push(mesh);
  return mesh;
}
function demoBuilding() {
  const g = new THREE.Group();
  block(g, 12.5, .22, 9.5, 0, .05, 0, materials.slab, true);
  block(g, 12.8, .28, 9.8, 0, 3.64, 0, materials.white);
  for (const x of [-6.08, 0, 6.08])
    for (const z of [-4.43, 4.43])
      block(g, .2, 3.55, .2, x, 1.8, z, materials.steel);
  block(g, 12.3, 2.48, .18, 0, 1.31, -4.47, materials.white);
  block(g, 12.3, .78, .18, 0, 2.99, -4.47, materials.glass);
  for (const x of [-6.14, 6.14]) {
    block(g, .12, 2.3, 8.2, x, 1.55, 0, materials.glass);
    block(g, .17, .16, 9.1, x, 2.74, 0, materials.steel);
    for (const z of [-2.2, 0, 2.2])
      block(g, .17, 2.7, .17, x, 1.4, z, materials.steel);
  }
  for (const direction of [-1, 1]) {
    block(g, 4.8, 2.78, .12, direction * 3.7, 1.45, 4.46, materials.glass);
    block(g, 4.85, .12, .2, direction * 3.7, 2.86, 4.46, materials.steel);
  }
  block(g, 3, .17, .3, 0, 3.02, 4.45, materials.accent);
  block(g, 2.2, 2.8, 2.5, -4.65, 1.52, -2.65, materials.timber);
  block(g, 3.6, .72, 1.4, 3.25, .47, -1.7, materials.timber);
  block(g, 3.2, .11, 1.35, 3.25, .91, -1.7, materials.white);
  for (const x of [-3.9, -2.6, -1.3]) {
    block(g, .42, .8, .42, x, .51, 1.25, materials.plant);
    block(g, .25, 1.25, .25, x, 1.46, 1.25, materials.accent);
  }
  block(g, 2.7, .18, 1.4, 0, .15, 5.13, materials.slab, true);
  block(g, 2.7, .14, 1, 0, .08, 6.25, materials.slab, true);
  for (const x of [-8, 8])
    for (const z of [-4, 0, 4])
      block(g, 1.4, .3, 1.5, x, .08, z, materials.plant);
  for (const x of [-9.4, 9.4])
    block(g, .2, 3.9, .2, x, 1.94, -5.6, materials.accent);
  g.userData.procedural = true;
  return g;
}
function clearModel() {
  if (!shown) return;
  root.remove(shown);
  shown.traverse(object => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    if (shown.userData.procedural) return;
    for (const m of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!m) continue;
      for (const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'])
        m[k]?.dispose();
      m.dispose();
    }
  });
  shown = null;
}
function positionOutside(depth = 11) {
  player.position.set(0, 0, Math.max(10, depth));
  player.rotation.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
}
function active(which) {
  el.demo.classList.toggle('active', which === 'demo');
  el.sample.classList.toggle('active', which === 'sample');
}
function showDemo() {
  clearModel();
  walkables = [ground];
  shown = demoBuilding();
  root.add(shown);
  positionOutside();
  el.size.textContent = '12.5 × 9.5 × 3.8 m';
  el.file.textContent = '当前：内置建筑示例';
  active('demo');
  notify('建筑已生成 · 点击电脑漫游或在 Quest 3 进入 VR');
}
async function loadGLB(url, label) {
  notify('正在加载 Rhino GLB 模型…');
  try {
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(model);
    if (bb.isEmpty()) throw new Error('模型不包含可见几何体');
    const size = bb.getSize(new THREE.Vector3());
    const centre = bb.getCenter(new THREE.Vector3());
    model.position.x -= centre.x;
    model.position.z -= centre.z;
    model.position.y -= bb.min.y;
    model.updateMatrixWorld(true);
    clearModel();
    walkables = [ground];
    model.traverse(o => { if (o.isMesh) walkables.push(o); });
    root.add(model);
    shown = model;
    const measured = size.x.toFixed(1) + ' × ' + size.z.toFixed(1)
      + ' × ' + size.y.toFixed(1) + ' m';
    el.size.textContent = measured;
    el.file.textContent = '当前：' + label;
    positionOutside(size.z / 2 + 6);
    active(label === 'sample-house.glb' ? 'sample' : '');
    notify('模型加载完成：' + measured);
  } catch (error) {
    console.error('[WebXR GLB]', error);
    notify('GLB 加载失败：' + (error.message || error), true);
  }
}
async function loadFile(file) {
  if (!file.name.toLowerCase().endsWith('.glb')) {
    notify('目前仅支持 .glb 单文件模型。', true);
    return;
  }
  if (file.size > 90 * 1024 * 1024) {
    notify('Quest 3 首次测试建议使用 90 MB 以下的 GLB。', true);
    return;
  }
  const url = URL.createObjectURL(file);
  try { await loadGLB(url, file.name); }
  finally { URL.revokeObjectURL(url); }
}
el.demo.addEventListener('click', showDemo);
el.sample.addEventListener('click', () => loadGLB('./sample-house.glb', 'sample-house.glb'));
el.input.addEventListener('change', async () => {
  const f = el.input.files?.[0];
  if (f) await loadFile(f);
  el.input.value = '';
});
let dragDepth = 0;
window.addEventListener('dragenter', e => {
  e.preventDefault(); dragDepth++; el.hint.classList.add('show');
});
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('dragleave', e => {
  e.preventDefault(); dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) el.hint.classList.remove('show');
});
window.addEventListener('drop', async e => {
  e.preventDefault(); dragDepth = 0; el.hint.classList.remove('show');
  if (e.dataTransfer.files.length) await loadFile(e.dataTransfer.files[0]);
});

// First-person keyboard and mouse in desktop browsers.
const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.code);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
el.walk.addEventListener('click', async () => {
  if (document.pointerLockElement === el.canvas) {
    document.exitPointerLock();
    return;
  }
  try { await el.canvas.requestPointerLock(); }
  catch { notify('无法锁定鼠标。请使用 HTTPS 或 localhost。', true); }
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === el.canvas;
  el.walk.innerHTML = locked ? '退出电脑漫游 <span>ESC</span>'
    : '进入电脑漫游 <span>↗</span>';
  document.querySelector('.reticle').style.display = locked ? 'block' : 'none';
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== el.canvas || renderer.xr.isPresenting) return;
  camera.rotation.y -= e.movementX * .0023;
  camera.rotation.x = THREE.MathUtils.clamp(
    camera.rotation.x - e.movementY * .0023, -Math.PI * .48, Math.PI * .48
  );
});

// Quest 3 motion controllers: point to horizontal floors, pull trigger to teleport.
const controllers = [];
const ray = new THREE.Raycaster();
const normalMatrix = new THREE.Matrix3();
const marker = new THREE.Mesh(
  new THREE.RingGeometry(.17, .24, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    color: 0x89f3dd, depthTest: false, side: THREE.DoubleSide
  })
);
marker.visible = false;
scene.add(marker);
function teleportHit(controller) {
  controller.updateWorldMatrix(true, false);
  ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  const q = new THREE.Quaternion();
  controller.getWorldQuaternion(q);
  ray.ray.direction.set(0, 0, -1).applyQuaternion(q).normalize();
  ray.far = 18;
  for (const hit of ray.intersectObjects(walkables, false)) {
    if (!hit.face) continue;
    normalMatrix.getNormalMatrix(hit.object.matrixWorld);
    const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
    if (normal.y > .67) return hit;
  }
  return null;
}
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  player.add(controller);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(0, 0, -1)
    ]),
    new THREE.LineBasicMaterial({
      color: 0xb2edff, opacity: .85, transparent: true
    })
  );
  controller.add(line);
  line.scale.z = 12;
  controller.addEventListener('selectstart', () => {
    if (!renderer.xr.isPresenting) return;
    const hit = teleportHit(controller);
    if (!hit) return;
    const head = new THREE.Vector3();
    renderer.xr.getCamera().getWorldPosition(head);
    player.position.x += hit.point.x - head.x;
    player.position.z += hit.point.z - head.z;
    player.position.y = Math.max(0, hit.point.y + .06);
  });
  controllers.push({ controller, line });
}
renderer.xr.addEventListener('sessionstart', () => {
  if (document.pointerLockElement) document.exitPointerLock();
  camera.position.set(0, 0, 0);
  notify('VR 已开启 · 左摇杆移动，扳机指向地面传送');
});
renderer.xr.addEventListener('sessionend', () => {
  camera.position.set(0, 1.65, 0);
  marker.visible = false;
  notify('已退出沉浸模式');
});

const clock = new THREE.Clock();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
let turnReady = true;
let turnCooldown = 0;
function stick(gamepad) {
  const a = gamepad?.axes;
  if (!a || a.length < 2) return [0, 0];
  return a.length >= 4 ? [a[2], a[3]] : [a[0], a[1]];
}
function locomotion(x, z, delta, xr = false) {
  const length = Math.hypot(x, z);
  if (length < .14) return;
  (xr ? renderer.xr.getCamera() : camera).getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < .001) forward.set(0, 0, -1);
  forward.normalize();
  right.set(-forward.z, 0, forward.x);
  const speed = Math.min(length, 1) * (xr ? 1.6 : 3.25) * delta;
  player.position.addScaledVector(forward, -z / length * speed);
  player.position.addScaledVector(right, x / length * speed);
}
function updateQuest(delta) {
  const session = renderer.xr.getSession();
  if (!session) return;
  for (const source of session.inputSources) {
    if (!source.gamepad) continue;
    const [x, y] = stick(source.gamepad);
    if (source.handedness === 'left') locomotion(x, y, delta, true);
    if (source.handedness === 'right') {
      if (Math.abs(x) > .72 && turnReady && turnCooldown <= 0) {
        player.rotation.y -= Math.sign(x) * Math.PI / 6;
        turnReady = false;
        turnCooldown = .25;
      }
      if (Math.abs(x) < .3) turnReady = true;
    }
  }
  turnCooldown = Math.max(0, turnCooldown - delta);
  let candidate = null;
  for (const { controller, line } of controllers) {
    const hit = teleportHit(controller);
    line.scale.z = hit ? Math.min(hit.distance, 18) : 12;
    if (hit && !candidate) candidate = hit;
  }
  marker.visible = !!candidate;
  if (candidate) marker.position.copy(candidate.point).add(
    new THREE.Vector3(0, .025, 0)
  );
}
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), .05);
  if (renderer.xr.isPresenting) updateQuest(delta);
  else {
    let x = 0, z = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x--;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z--;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z++;
    if (x || z) locomotion(x, z, delta);
  }
  renderer.render(scene, camera);
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
});
showDemo();
