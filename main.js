import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setupPerformance } from './performance.js?v=1.3';
import { createUnitEditor } from './unit_editor.js?v=1.4';

// London 2100 WebXR proof of concept. All dimensions are in metres.
const $ = id => document.getElementById(id);
const el = {
  canvas: $('scene'), demo: $('demoBtn'), sample: $('sampleBtn'),
  input: $('modelInput'), walk: $('walkBtn'), file: $('fileName'),
  size: $('sizeReadout'), status: $('notification'), hint: $('dropHint'),
  fit: $('fitBtn'), top: $('topBtn'), outline: $('outlineBtn'),
  material: $('materialBtn'), unit: $('unitBtn')
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
scene.fog = null; // Large Rhino models were fading away behind the old fog.
const camera = new THREE.PerspectiveCamera(73, innerWidth / innerHeight, .05, 6000);
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
renderer.toneMappingExposure = 1.15;
// glTF PBR metallic surfaces need image-based lighting. Without this environment,
// reflective V-Ray-to-PBR materials can render as flat black on Quest / desktop.
const pmrem = new THREE.PMREMGenerator(renderer);
const studio = new RoomEnvironment();
const studioMap = pmrem.fromScene(studio).texture;
scene.environment = studioMap;
scene.environmentIntensity = 1.1;
studio.dispose();
pmrem.dispose();
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
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshStandardMaterial({ color: 0x101e2a, roughness: .93 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.06;
scene.add(ground);
const grid = new THREE.GridHelper(2000, 200, 0x3d6981, 0x1d3343);
grid.position.y = -.04;
grid.material.transparent = true;
grid.material.opacity = .21;
scene.add(grid);

const root = new THREE.Group();
scene.add(root);
let shown = null;
let unitEditor = null;
let walkables = [ground];
const perf = setupPerformance(renderer, camera);
const loader = new GLTFLoader();
function mat(color, metalness = .05, roughness = .8) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
// White-model diagnostic deliberately does not alter the GLB source materials.
const diagnosticMaterial = new THREE.MeshStandardMaterial({
  color: 0xd6dee5, metalness: 0, roughness: 0.78, side: THREE.DoubleSide
});
let diagnosticActive = false;
const originalMaterials = new Map();
function setMaterialDiagnostic(on) {
  if (diagnosticActive && originalMaterials.size) {
    for (const [mesh, original] of originalMaterials) mesh.material = original;
    originalMaterials.clear();
  }
  diagnosticActive = false;
  if (on && shown) {
    shown.traverse(o => {
      if (!o.isMesh) return;
      originalMaterials.set(o, o.material);
      o.material = diagnosticMaterial;
    });
    diagnosticActive = true;
  }
  el.material.classList.toggle('active', diagnosticActive);
  el.material.textContent = diagnosticActive ? '恢复 Rhino 材质' : '灰模诊断';
}
el.material.addEventListener('click', () => {
  setMaterialDiagnostic(!diagnosticActive);
  notify(diagnosticActive ? '已切换灰模：如果变亮，需检查 Rhino 导出材质与贴图。'
    : '已恢复 GLB 原始材质');
});
function diagnoseMaterials(model) {
  const unique = new Set();
  let meshes = 0, maps = 0, highMetal = 0, transparent = 0;
  model.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m) unique.add(m);
  });
  for (const m of unique) {
    if (m.map) maps++;
    if ('metalness' in m && m.metalness > .85) highMetal++;
    if (m.transparent || m.opacity < 0.98) transparent++;
  }
  const stats = {meshCount: meshes, materialCount: unique.size,
    mappedMaterials: maps, highMetalMaterials: highMetal,
    transparentMaterials: transparent};
  console.info('[London WebXR] GLB material report', stats);
  return stats;
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
  if (unitEditor?.active) unitEditor.leave();
  perf.reset();
  setMaterialDiagnostic(false);
  clearBoundsHelper();
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
// Desktop loads in orbit/inspection mode, never as a ground-level camera.
const orbit = {
  target: new THREE.Vector3(), theta: Math.PI / 4,
  phi: 1.02, radius: 25, min: 2, max: 5000
};
let currentSize = new THREE.Vector3(12.5, 3.8, 9.5);
let orbitDragging = null;
let boundsHelper = null;
let outlineEnabled = true;
function updateOrbitCamera() {
  if (renderer.xr.isPresenting || document.pointerLockElement === el.canvas) return;
  const sinPhi = Math.sin(orbit.phi);
  const offset = new THREE.Vector3(
    orbit.radius * sinPhi * Math.sin(orbit.theta),
    orbit.radius * Math.cos(orbit.phi),
    orbit.radius * sinPhi * Math.cos(orbit.theta)
  );
  player.rotation.set(0, 0, 0);
  camera.position.set(0, 1.65, 0);
  player.position.copy(orbit.target).add(offset);
  player.position.y -= camera.position.y;
  player.updateMatrixWorld(true);
  camera.lookAt(orbit.target);
}
function fitModel(size, top = false) {
  currentSize.copy(size);
  const diagonal = Math.max(1, size.length());
  const halfVertical = THREE.MathUtils.degToRad(camera.fov) / 2;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
  const halfFov = Math.min(halfVertical, halfHorizontal);
  orbit.radius = Math.max(6, diagonal * .58 / Math.sin(halfFov));
  orbit.min = Math.max(.6, diagonal * .008);
  orbit.max = Math.max(120, diagonal * 15);
  orbit.radius = THREE.MathUtils.clamp(orbit.radius, orbit.min, orbit.max);
  orbit.target.set(0, size.y * .48, 0);
  orbit.theta = top ? 0.001 : Math.PI / 4;
  orbit.phi = top ? 0.09 : 1.02;
  updateOrbitCamera();
}
function enterWalkPosition() {
  const margin = THREE.MathUtils.clamp(currentSize.z * .03, 2.5, 8);
  player.position.set(0, 0, currentSize.z / 2 + margin);
  player.rotation.set(0, 0, 0);
  camera.position.set(0, 1.65, 0);
  camera.rotation.set(0, 0, 0);
}
function clearBoundsHelper() {
  if (!boundsHelper) return;
  scene.remove(boundsHelper);
  boundsHelper.geometry.dispose();
  boundsHelper.material.dispose();
  boundsHelper = null;
}
function rebuildBoundsHelper() {
  clearBoundsHelper();
  if (!shown) return;
  shown.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(shown);
  if (box.isEmpty()) return;
  boundsHelper = new THREE.Box3Helper(box, 0x7ddff8);
  boundsHelper.visible = outlineEnabled;
  scene.add(boundsHelper);
  el.outline.classList.toggle('active', outlineEnabled);
}
function active(which) {
  el.demo.classList.toggle('active', which === 'demo');
  el.sample.classList.toggle('active', which === 'sample');
  el.unit.classList.toggle('active', which === 'unit');
}
function showUnits() {
  clearModel();
  walkables = [ground];
  shown = unitEditor.enter();
  root.add(shown);
  perf.onModelLoaded(shown);
  fitModel(new THREE.Vector3(18, 9, 20));
  rebuildBoundsHelper();
  // Selected units have their own bright cyan highlight; avoid a huge box
  // around the entire editing sandbox.
  if (boundsHelper) boundsHelper.visible = false;
  el.size.textContent = '3 × 6 × 3 m / Unit';
  el.file.textContent = '当前：Unit 组合编辑测试 · 6 个独立模块';
  active('unit');
  notify('已进入 Unit 编辑 · 桌面点击拖动 / Quest 3 Grip 抓取');
}
function showDemo() {
  clearModel();
  walkables = [ground];
  shown = demoBuilding();
  root.add(shown);
  perf.onModelLoaded(shown);
  fitModel(new THREE.Vector3(12.5, 3.8, 9.5));
  rebuildBoundsHelper();
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
    const materialReport = diagnoseMaterials(model);
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
    perf.onModelLoaded(model);
    const measured = size.x.toFixed(1) + ' × ' + size.z.toFixed(1)
      + ' × ' + size.y.toFixed(1) + ' m';
    el.size.textContent = measured;
    el.file.textContent = '当前：' + label;
    fitModel(size);
    rebuildBoundsHelper();
    active(label === 'sample-house.glb' ? 'sample' : '');
    notify('模型已加载并自动定位：' + measured +
      (materialReport.highMetalMaterials > 0
        ? ' · 检测到高金属度材质，现已启用环境反射' : '') +
      ' · 发黑时点击灰模诊断');
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
el.unit.addEventListener('click', showUnits);
el.fit.addEventListener('click', () => {
  if (document.pointerLockElement) document.exitPointerLock();
  fitModel(currentSize);
  notify('已自动适配并显示整个模型');
});
el.top.addEventListener('click', () => {
  if (document.pointerLockElement) document.exitPointerLock();
  fitModel(currentSize, true);
  notify('已切换顶视角 · 拖动可旋转');
});
el.outline.addEventListener('click', () => {
  outlineEnabled = !outlineEnabled;
  if (boundsHelper) boundsHelper.visible = outlineEnabled;
  el.outline.classList.toggle('active', outlineEnabled);
});
el.canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || renderer.xr.isPresenting || document.pointerLockElement) return;
  if (unitEditor?.handlePointerDown(e)) return;
  orbitDragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
  el.canvas.setPointerCapture(e.pointerId);
});
el.canvas.addEventListener('pointermove', e => {
  if (unitEditor?.handlePointerMove(e)) return;
  if (!orbitDragging || orbitDragging.id !== e.pointerId ||
      renderer.xr.isPresenting || document.pointerLockElement) return;
  const dx = e.clientX - orbitDragging.x, dy = e.clientY - orbitDragging.y;
  orbitDragging.x = e.clientX;
  orbitDragging.y = e.clientY;
  orbit.theta -= dx * .006;
  orbit.phi = THREE.MathUtils.clamp(orbit.phi + dy * .006, .06, Math.PI - .06);
  updateOrbitCamera();
});
function stopOrbit(e) {
  if (unitEditor?.handlePointerEnd(e)) return;
  if (orbitDragging && orbitDragging.id === e.pointerId) orbitDragging = null;
}
el.canvas.addEventListener('pointerup', stopOrbit);
el.canvas.addEventListener('pointercancel', stopOrbit);
el.canvas.addEventListener('wheel', e => {
  if (renderer.xr.isPresenting || document.pointerLockElement) return;
  e.preventDefault();
  orbit.radius = THREE.MathUtils.clamp(
    orbit.radius * Math.exp(e.deltaY * .0011), orbit.min, orbit.max
  );
  updateOrbitCamera();
}, { passive: false });
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
  if (unitEditor?.handleKey(e)) { e.preventDefault(); return; }
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
  enterWalkPosition();
  try { await el.canvas.requestPointerLock(); }
  catch { notify('无法锁定鼠标。请使用 HTTPS 或 localhost。', true); }
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === el.canvas;
  el.walk.innerHTML = locked ? '退出电脑漫游 <span>ESC</span>'
    : '进入电脑漫游 <span>↗</span>';
  document.querySelector('.reticle').style.display = locked ? 'block' : 'none';
  if (!locked && !renderer.xr.isPresenting) updateOrbitCamera();
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
    if (unitEditor?.active) { unitEditor.selectXR(controller); return; }
    const hit = teleportHit(controller);
    if (!hit) return;
    const head = new THREE.Vector3();
    renderer.xr.getCamera().getWorldPosition(head);
    player.position.x += hit.point.x - head.x;
    player.position.z += hit.point.z - head.z;
    player.position.y = Math.max(0, hit.point.y + .06);
  });
  controller.addEventListener('squeezestart', () => {
    if (renderer.xr.isPresenting && unitEditor?.active) unitEditor.gripStart(controller);
  });
  controller.addEventListener('squeezeend', () => {
    if (renderer.xr.isPresenting && unitEditor?.active) unitEditor.releaseGrip(controller);
  });
  controllers.push({ controller, line });
}
unitEditor = createUnitEditor({
  canvas: el.canvas, scene, camera, renderer,
  controls: controllers, onNotice: notify
});
renderer.xr.addEventListener('sessionstart', () => {
  if (document.pointerLockElement) document.exitPointerLock();
  enterWalkPosition();
  camera.position.set(0, 0, 0);
  notify('VR 已开启 · 左摇杆移动，扳机指向地面传送');
});
renderer.xr.addEventListener('sessionend', () => {
  camera.position.set(0, 1.65, 0);
  marker.visible = false;
  updateOrbitCamera();
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
        if (unitEditor?.active && unitEditor.selection) {
          unitEditor.rotateSelected();
        } else {
          player.rotation.y -= Math.sign(x) * Math.PI / 6;
        }
        turnReady = false;
        turnCooldown = .25;
      }
      if (Math.abs(x) < .3) turnReady = true;
    }
  }
  turnCooldown = Math.max(0, turnCooldown - delta);
  if (unitEditor?.active) {
    unitEditor.tickXR();
    marker.visible = false;
    for (const { line } of controllers) line.scale.z = 18;
    return;
  }
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
    if (document.pointerLockElement === el.canvas) {
      if (x || z) locomotion(x, z, delta);
      // Free-flight in desktop walkthrough: E ascends, Q descends.
      const upDown = Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));
      if (upDown) player.position.y = Math.max(0,
        player.position.y + upDown * 3.25 * delta);
    }
  }
  perf.beforeFrame(performance.now());
  renderer.render(scene, camera);
  perf.afterFrame(performance.now());
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  perf.onResize();
  updateOrbitCamera();
});
showDemo();
