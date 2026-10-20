import * as THREE from 'three';

// Reversible quality controls for Rhino models. Meshes and node names remain
// intact so Unit-level selection/grabbing can be implemented independently.
export function setupPerformance(renderer, camera) {
  const selector = document.getElementById('qualitySelect');
  const detail = document.getElementById('detailBtn');
  const readout = document.getElementById('perfReadout');
  const state = {
    model: null, entries: [], meshes: 0, materials: 0, triangles: 0,
    hidden: 0, mode: 'auto', effective: 'balanced', cull: true,
    lastCull: 0, changed: true, frameCount: 0, lastStats: performance.now(),
    position: new THREE.Vector3(), lastPosition: new THREE.Vector3(1e9, 1e9, 1e9)
  };
  function restoreVisibility() {
    for (const e of state.entries) e.mesh.visible = e.baseVisible;
    state.hidden = 0;
  }
  function reset() {
    restoreVisibility();
    state.entries = [];
    state.model = null;
    state.meshes = 0; state.triangles = 0; state.materials = 0;
    state.changed = true;
  }
  function effectiveQuality() {
    if (state.mode !== 'auto') return state.mode;
    if (state.meshes > 1800 || state.triangles > 1300000) return 'low';
    if (state.meshes > 450 || state.triangles > 280000) return 'balanced';
    return 'high';
  }
  function applyQuality() {
    state.effective = effectiveQuality();
    const pixels = state.effective === 'low' ? 0.85 :
      state.effective === 'balanced' ? 1 : 1.5;
    // WebXR framebuffer resolution may only be changed before a VR session.
    if (!renderer.xr.isPresenting) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixels));
      if (typeof renderer.xr.setFramebufferScaleFactor === 'function') {
        renderer.xr.setFramebufferScaleFactor(
          state.effective === 'low' ? 0.70 :
          state.effective === 'balanced' ? 0.85 : 1
        );
      }
    }
    state.changed = true;
  }
  function onModelLoaded(model) {
    reset();
    state.model = model;
    const materials = new Set();
    model.updateWorldMatrix(true, true);
    model.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry) return;
      state.meshes++;
      const geo = mesh.geometry;
      const vertexCount = geo.getAttribute('position')?.count || 0;
      state.triangles += Math.round((geo.index?.count || vertexCount) / 3);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) if (mat) materials.add(mat);
      if (!mesh.visible || mesh.isSkinnedMesh || mesh.morphTargetInfluences) return;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      if (!geo.boundingSphere) return;
      const center = geo.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld);
      const radius = geo.boundingSphere.radius * mesh.matrixWorld.getMaxScaleOnAxis();
      if (Number.isFinite(radius) && radius > 0) {
        state.entries.push({ mesh, center, radius, baseVisible: mesh.visible });
      }
    });
    state.materials = materials.size;
    applyQuality();
    console.info('[WebXR] Rhino scene report', {
      meshes: state.meshes, triangles: state.triangles,
      materials: state.materials, effectiveQuality: state.effective
    });
  }
  function updateCulling(now) {
    if (!state.model || !state.entries.length) return;
    if (!state.cull || state.meshes < 100) {
      if (state.hidden) restoreVisibility();
      return;
    }
    if (!state.changed && now - state.lastCull < 500) return;
    if (renderer.xr.isPresenting) renderer.xr.getCamera().getWorldPosition(state.position);
    else camera.getWorldPosition(state.position);
    if (!state.changed && state.position.distanceToSquared(state.lastPosition) < 1 &&
        now - state.lastCull < 1500) return;
    state.lastPosition.copy(state.position);
    state.changed = false;
    state.lastCull = now;
    const ratio = renderer.xr.isPresenting ? 0.0015 : 0.003;
    const limit = ratio * ratio;
    let removed = 0;
    for (const entry of state.entries) {
      const dist2 = entry.center.distanceToSquared(state.position);
      const tinyAtDistance = dist2 > 120 * 120 &&
        entry.radius * entry.radius / dist2 < limit;
      entry.mesh.visible = entry.baseVisible && !tinyAtDistance;
      if (tinyAtDistance && entry.baseVisible) removed++;
    }
    state.hidden = removed;
  }
  function afterFrame(now) {
    state.frameCount++;
    if (now - state.lastStats < 1000) return;
    const fps = Math.round(state.frameCount * 1000 /
      Math.max(1, now - state.lastStats));
    state.lastStats = now;
    state.frameCount = 0;
    const fmt = n => Math.round(n).toLocaleString('en-US');
    const render = renderer.info.render;
    readout.textContent =
      'FPS ' + fps + ' · Draw calls ' + fmt(render.calls) +
      '\nTriangles ' + fmt(render.triangles) + ' · Meshes ' + fmt(state.meshes) +
      '\nMaterials ' + fmt(state.materials) +
      ' · 远景隐藏 ' + fmt(state.hidden) +
      ' · 画质 ' + state.effective;
  }
  selector.addEventListener('change', () => {
    state.mode = selector.value;
    applyQuality();
  });
  detail.addEventListener('click', () => {
    state.cull = !state.cull;
    if (!state.cull) restoreVisibility();
    state.changed = true;
    detail.classList.toggle('active', state.cull);
    detail.textContent = '远景细节优化：' + (state.cull ? '开' : '关');
  });
  applyQuality();
  return {
    reset, onModelLoaded, beforeFrame: updateCulling, afterFrame,
    onResize: applyQuality
  };
}
