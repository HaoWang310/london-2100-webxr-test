import * as THREE from 'three';

// London 2100 / Unit assembly laboratory.
// Standalone prefabs deliberately use independent scene nodes to allow future
// substitution with named glTF Unit objects without merging geometry.
const GRID = Object.freeze({ x: 3, y: 3, z: 6 });
const TYPES = {
  residential: { name: 'Residential', color: 0xd9c2a2, trim: 0xb0a28e },
  agriculture: { name: 'Agriculture', color: 0x8cd0a7, trim: 0x639b78 },
  public: { name: 'Public', color: 0x9cd4ea, trim: 0x779fae },
  bridge: { name: 'Bridge', color: 0xc4b6e4, trim: 0x8b80ad },
  core: { name: 'Core', color: 0xf0c099, trim: 0xb88662 }
};
const pickRay = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tempMatrix = new THREE.Matrix4();
const parentInverse = new THREE.Matrix4();
const controllerQ = new THREE.Quaternion();
const rayOrigin = new THREE.Vector3();
const rayDir = new THREE.Vector3();
const movePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersectPoint = new THREE.Vector3();

export function createUnitEditor({
  canvas, scene, camera, renderer, player, controls, onChange = () => {},
  onNotice = () => {}
}) {
  const $ = id => document.getElementById(id);
  const panel = $('unitPanel'), status = $('unitStatus');
  const modeButton = $('unitBtn'), typeSelect = $('unitTypeSelect');
  const addButton = $('addUnitBtn'), duplicateButton = $('duplicateUnitBtn');
  const rotateButton = $('rotateUnitBtn'), deleteButton = $('deleteUnitBtn');
  const resetButton = $('resetUnitsBtn'), snapButton = $('snapUnitBtn');
  const gltfHint = $('unitRhinoHint');
  const state = {
    active: false, group: null, units: [], selected: null, hover: null,
    snap: true, nextId: 1, drag: null, grip: null, helper: null
  };
  const palette = {
    slab: new THREE.MeshStandardMaterial({ color: 0xd8d9d4, roughness: .83 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x6a838d, metalness: .46, roughness: .4 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xa7d8e8, transparent: true, opacity: .24, roughness: .18,
      depthWrite: false, side: THREE.DoubleSide
    }),
    plant: new THREE.MeshStandardMaterial({ color: 0x77b78d, roughness: .83 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x334b5a, roughness: .75 }),
    deck: new THREE.MeshStandardMaterial({ color: 0x9fa9b3, roughness: .84 })
  };
  const coloredMats = Object.fromEntries(Object.entries(TYPES).map(([key, val]) => [
    key, new THREE.MeshStandardMaterial({ color: val.color, roughness: .65 })
  ]));

  // Immersive WebXR has no visible HTML DOM panel. Provide a real 3D,
  // controller-ray clickable toolbar on the left side of the user.
  const xrToolbar = new THREE.Group();
  xrToolbar.position.set(-1.05, 1.48, -1.5);
  xrToolbar.visible = false;
  xrToolbar.name = 'London2100_XR_Unit_Toolbar';
  player.add(xrToolbar);
  const vrButtons = [];
  function toolbarButton(label, action, index) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 104;
    const ctx = c.getContext('2d');
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    function redraw(text) {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#0b2533'; ctx.fillRect(1, 1, 510, 102);
      ctx.strokeStyle = '#9de6f3'; ctx.lineWidth = 5;
      ctx.strokeRect(3, 3, 506, 98);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#d8f7ff'; ctx.font = 'bold 38px sans-serif';
      ctx.fillText(text, 256, 52);
      texture.needsUpdate = true;
    }
    redraw(label);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.82, .174),
      new THREE.MeshBasicMaterial({map: texture, transparent: true,
        side: THREE.DoubleSide, depthTest: false}));
    mesh.position.y = -index * .21;
    mesh.renderOrder = 999;
    mesh.userData.unitAction = action;
    xrToolbar.add(mesh);
    vrButtons.push(mesh);
    return {mesh, redraw};
  }
  const typeOptions = Object.keys(TYPES);
  const typeName = () => TYPES[typeSelect.value]?.name?.toUpperCase() || 'RESIDENTIAL';
  const typeTool = toolbarButton('TYPE: ' + typeName(), () => {
    typeSelect.value = typeOptions[(typeOptions.indexOf(typeSelect.value) + 1) % typeOptions.length];
    typeTool.redraw('TYPE: ' + typeName());
  }, 0);
  toolbarButton('ADD UNIT', () => add(), 1);
  toolbarButton('COPY', () => duplicate(), 2);
  toolbarButton('ROTATE 90°', () => rotate(), 3);
  toolbarButton('DELETE', () => remove(), 4);
  toolbarButton('RESET', () => reset(), 5);
  typeSelect.addEventListener('change', () => typeTool.redraw('TYPE: ' + typeName()));
  function syncVrUI(force = null) {
    const presenting = force === null ? renderer.xr.isPresenting : force;
    xrToolbar.visible = state.active && presenting;
  }
  function toolbarHit(ray) {
    if (!xrToolbar.visible) return null;
    const hits = ray.intersectObjects(vrButtons, false);
    return hits[0] || null;
  }
  // Create helper objects per activation because the host disposes procedural
  // mesh geometries when changing models; never reuse a disposed GPU buffer.
  function createWorkArea(group) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(33, 45),
      new THREE.MeshBasicMaterial({
        color: 0x193442, transparent: true, opacity: .35,
        side: THREE.DoubleSide, depthWrite: false
      }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.025;
    floor.name = 'Unit_Work_Area';
    const grid = new THREE.GridHelper(42, 14, 0x67aaba, 0x345a64);
    grid.position.y = .004;
    grid.material.transparent = true;
    grid.material.opacity = .31;
    group.add(floor, grid);
  }
  // No all-building GLB geometry is ray-tested or reparented in edit mode.
  function box(parent, w, h, d, x, y, z, material) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  function prefab(type, id) {
    const cfg = TYPES[type] || TYPES.residential;
    const unit = new THREE.Group();
    unit.name = 'Unit_' + String(id).padStart(3, '0') + '_' + cfg.name;
    unit.userData.editableUnit = true;
    unit.userData.unitType = type;
    unit.userData.id = id;
    const color = coloredMats[type];
    if (type === 'bridge') {
      box(unit, 2.92, .19, 5.92, 0, 1.55, 0, palette.deck);
      for (const x of [-1.4, 1.4]) {
        box(unit, .11, 1.0, 5.85, x, 2.11, 0, palette.metal);
      }
      for (const z of [-2.75, 0, 2.75]) {
        box(unit, 2.9, .12, .11, 0, 1.53, z, color);
      }
    } else {
      box(unit, 2.94, .17, 5.94, 0, .09, 0, palette.slab);
      box(unit, 3.0, .14, 6.0, 0, 2.93, 0, color);
      for (const x of [-1.4, 1.4]) {
        for (const z of [-2.85, 2.85]) {
          box(unit, .13, 2.72, .13, x, 1.54, z, palette.metal);
        }
      }
      if (type === 'core') {
        box(unit, 1.8, 2.62, 4.3, 0, 1.45, 0, color);
        box(unit, 1.2, .06, 2.5, 0, 1.53, .45, palette.metal);
      } else {
        box(unit, 2.75, 2.35, .09, 0, 1.51, -2.86, palette.glass);
        for (const x of [-1.42, 1.42]) {
          box(unit, .09, 2.35, 5.67, x, 1.5, 0, palette.glass);
        }
        if (type === 'agriculture') {
          for (const x of [-.85, 0, .85]) for (const z of [-1.8, -.6, .6, 1.8]) {
            box(unit, .66, .3, .84, x, .38, z, palette.plant);
            box(unit, .10, .5, .1, x, .79, z, color);
          }
        } else if (type === 'residential') {
          box(unit, 1.55, .5, 1.95, -.42, .43, -.9, palette.dark);
          box(unit, 1.65, .06, 1.96, -.42, .73, -.9, color);
        } else if (type === 'public') {
          box(unit, 1.8, .36, 1.0, 0, .38, .6, palette.dark);
          box(unit, 2.0, .1, 1.1, 0, .6, .6, color);
        }
      }
    }
    return unit;
  }
  function disposeUnit(unit) {
    unit.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  }
  function invalidate() { if (state.active) onChange(); }
  function setSelected(next) {
    state.selected = next && state.units.includes(next) ? next : null;
    if (state.helper) {
      scene.remove(state.helper);
      state.helper.geometry.dispose();
      state.helper.material.dispose();
      state.helper = null;
    }
    if (state.selected) {
      state.selected.updateWorldMatrix(true, true);
      state.helper = new THREE.Box3Helper(
        new THREE.Box3().setFromObject(state.selected), 0x72edff
      );
      scene.add(state.helper);
    }
    updateUI();
  }
  function refreshHelper() {
    if (!state.helper || !state.selected) return;
    state.selected.updateWorldMatrix(true, true);
    state.helper.box.setFromObject(state.selected);
    state.helper.updateMatrixWorld(true);
  }
  function updateUI() {
    status.textContent = state.selected ?
      state.selected.name + ' · X ' + state.selected.position.x.toFixed(1) +
      ' / Y ' + state.selected.position.y.toFixed(1) +
      ' / Z ' + state.selected.position.z.toFixed(1) +
      ' m · Units ' + state.units.length :
      '未选择 Unit · 当前 ' + state.units.length + ' 个模块';
    for (const b of [duplicateButton, rotateButton, deleteButton]) {
      b.disabled = !state.selected || !!state.grip;
    }
    snapButton.classList.toggle('active', state.snap);
    snapButton.textContent = state.snap ? '网格吸附：开' : '网格吸附：关';
  }
  function create(type, point = new THREE.Vector3()) {
    if (!state.group) return null;
    const u = prefab(type, state.nextId++);
    u.position.copy(point);
    state.group.add(u);
    state.units.push(u);
    updateUI();
    return u;
  }
  function snap(unit) {
    if (!unit || !state.snap) return;
    unit.position.set(
      Math.round(unit.position.x / GRID.x) * GRID.x,
      Math.max(0, Math.round(unit.position.y / GRID.y) * GRID.y),
      Math.round(unit.position.z / GRID.z) * GRID.z
    );
    // Modules rotate in 90-degree steps in architectural assembly mode.
    unit.rotation.set(0, Math.round(unit.rotation.y / (Math.PI / 2)) * Math.PI / 2, 0);
  }
  function reset() {
    if (!state.active || !state.group) return;
    releaseGrip();
    setSelected(null);
    for (const u of state.units) { state.group.remove(u); disposeUnit(u); }
    state.units.length = 0; state.nextId = 1;
    for (const [type, x, z, y] of [
      ['residential', -3, -6, 0], ['residential', 0, -6, 0],
      ['agriculture', 3, -6, 0], ['public', -3, 0, 0],
      ['bridge', 0, 0, 0], ['core', 3, 0, 0]
    ]) create(type, new THREE.Vector3(x, y, z));
    selectByIndex(0);
    onNotice('已重置 6 个模块 · 3 × 6 × 3 m');
    invalidate();
  }
  function selectByIndex(i) { setSelected(state.units[i] || null); }
  function add() {
    if (!state.active) return;
    const p = state.selected ?
      state.selected.position.clone().add(new THREE.Vector3(3, 0, 0)) :
      new THREE.Vector3(0, 0, 6);
    const u = create(typeSelect.value, p);
    snap(u);
    setSelected(u);
    invalidate();
  }
  function duplicate() {
    if (!state.selected || state.grip) return;
    const original = state.selected;
    const u = create(original.userData.unitType,
      original.position.clone().add(new THREE.Vector3(3, 0, 0)));
    u.quaternion.copy(original.quaternion);
    snap(u);
    setSelected(u);
    invalidate();
  }
  function rotate() {
    if (!state.selected || state.grip) return;
    state.selected.rotation.y += Math.PI / 2;
    snap(state.selected);
    refreshHelper(); updateUI(); invalidate();
  }
  function remove() {
    if (!state.selected || state.grip) return;
    const u = state.selected;
    setSelected(null);
    state.units.splice(state.units.indexOf(u), 1);
    state.group.remove(u); disposeUnit(u);
    updateUI(); invalidate();
  }
  addButton.addEventListener('click', add);
  duplicateButton.addEventListener('click', duplicate);
  rotateButton.addEventListener('click', rotate);
  deleteButton.addEventListener('click', remove);
  resetButton.addEventListener('click', reset);
  snapButton.addEventListener('click', () => {
    state.snap = !state.snap;
    updateUI();
  });
  function enter() {
    leave();
    state.active = true;
    state.group = new THREE.Group();
    state.group.name = 'London2100_Editable_Unit_Collection';
    state.group.userData.procedural = true;
    createWorkArea(state.group);
    panel.hidden = false;
    modeButton.classList.add('active');
    gltfHint.hidden = false;
    syncVrUI();
    reset();
    return state.group;
  }
  function leave() {
    if (!state.active) return;
    releaseGrip();
    setSelected(null);
    state.drag = null;
    state.active = false;
    syncVrUI();
    panel.hidden = true;
    modeButton.classList.remove('active');
    gltfHint.hidden = true;
    // Dispose auxiliary resources not owned by the host mesh traversal.
    if (state.group) for (const child of state.group.children) {
      if (child.isLineSegments) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
      if (child.isMesh && child.name === 'Unit_Work_Area') {
        child.material?.dispose();
      }
    }
    // Keep no stale grip or raycast references to cleared nodes.
    state.units.length = 0;
    state.group = null;
    state.hover = null;
  }
  function pick(ray) {
    if (!state.active || !state.units.length) return null;
    const hits = ray.intersectObjects(state.units, true);
    if (!hits.length) return null;
    let current = hits[0].object;
    while (current && !current.userData.editableUnit) current = current.parent;
    return current && state.units.includes(current) ? current : null;
  }
  function desktopRay(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    camera.updateWorldMatrix(true, false);
    pickRay.setFromCamera(mouse, camera);
    return pickRay;
  }
  function handlePointerDown(e) {
    if (!state.active || renderer.xr.isPresenting || e.button !== 0 ||
        document.pointerLockElement === canvas) return false;
    const target = pick(desktopRay(e));
    if (!target) { setSelected(null); return false; }
    setSelected(target);
    movePlane.constant = -target.position.y;
    const ray = desktopRay(e);
    const point = ray.ray.intersectPlane(movePlane, intersectPoint);
    if (!point) return true;
    state.drag = {
      pointerId: e.pointerId,
      offset: target.position.clone().sub(point),
      unit: target
    };
    canvas.setPointerCapture(e.pointerId);
    return true;
  }
  function handlePointerMove(e) {
    if (!state.active || !state.drag ||
        e.pointerId !== state.drag.pointerId) return false;
    const ray = desktopRay(e);
    if (ray.ray.intersectPlane(movePlane, intersectPoint)) {
      state.drag.unit.position.copy(intersectPoint).add(state.drag.offset);
      refreshHelper(); updateUI();
    }
    return true;
  }
  function handlePointerEnd(e) {
    if (!state.active || !state.drag ||
        e.pointerId !== state.drag.pointerId) return false;
    snap(state.drag.unit);
    refreshHelper(); updateUI(); invalidate();
    state.drag = null;
    return true;
  }
  function controllerRay(controller) {
    controller.updateWorldMatrix(true, false);
    rayOrigin.setFromMatrixPosition(controller.matrixWorld);
    controller.getWorldQuaternion(controllerQ);
    rayDir.set(0, 0, -1).applyQuaternion(controllerQ).normalize();
    pickRay.set(rayOrigin, rayDir);
    pickRay.near = 0;
    pickRay.far = 24;
    return pickRay;
  }
  function selectXR(controller) {
    if (!state.active) return false;
    const ray = controllerRay(controller);
    const tool = toolbarHit(ray);
    if (tool) {
      tool.object.userData.unitAction();
      return true;
    }
    const unit = pick(ray);
    setSelected(unit);
    return true;
  }
  function gripStart(controller) {
    if (!state.active || state.grip) return false;
    const ray = controllerRay(controller);
    if (toolbarHit(ray)) return false;
    const unit = pick(ray);
    if (!unit) return false;
    setSelected(unit);
    controller.updateWorldMatrix(true, false);
    unit.updateWorldMatrix(true, false);
    const relative = new THREE.Matrix4().copy(controller.matrixWorld).invert()
      .multiply(unit.matrixWorld);
    state.grip = { controller, unit, relative };
    return true;
  }
  function releaseGrip(controller = null) {
    if (!state.grip || (controller && controller !== state.grip.controller)) return false;
    const unit = state.grip.unit;
    state.grip = null;
    snap(unit);
    refreshHelper(); updateUI(); invalidate();
    return true;
  }
  function tickXR() {
    syncVrUI();
    if (!state.active || !renderer.xr.isPresenting) return;
    if (!state.grip) return;
    const { controller, unit, relative } = state.grip;
    controller.updateWorldMatrix(true, false);
    state.group.updateWorldMatrix(true, false);
    parentInverse.copy(state.group.matrixWorld).invert();
    tempMatrix.multiplyMatrices(controller.matrixWorld, relative).premultiply(parentInverse);
    tempMatrix.decompose(unit.position, unit.quaternion, unit.scale);
    refreshHelper();
  }
  function handleKey(e) {
    if (!state.active || !state.selected || renderer.xr.isPresenting ||
        document.pointerLockElement === canvas || e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement) return false;
    if (e.code === 'Delete' || e.code === 'Backspace') { remove(); return true; }
    if (e.code === 'KeyR') { rotate(); return true; }
    if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
      duplicate(); return true;
    }
    if (e.code === 'KeyE' || e.code === 'KeyQ') {
      state.selected.position.y += e.code === 'KeyE' ? 3 : -3;
      state.selected.position.y = Math.max(0, state.selected.position.y);
      refreshHelper(); updateUI(); invalidate();
      return true;
    }
    return false;
  }
  return {
    get active() { return state.active; },
    get group() { return state.group; },
    enter, leave, reset, selectXR, gripStart, releaseGrip, tickXR,
    handlePointerDown, handlePointerMove, handlePointerEnd, handleKey,
    get selection() { return state.selected; },
    rotateSelected: rotate, syncVrUI
  };
}
