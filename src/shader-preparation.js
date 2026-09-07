// Three is pinned to r185. compileAsync waits each Material's currentProgram,
// but one shared material can have plain/instanced/skinned variants. Complete
// every generated program, retaining Three's shader error checks, before play.
const nextFrame = () => new Promise(requestAnimationFrame);
const lightConfigurations = [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
];

export async function finishPreparedPrograms(
  renderer,
  { yieldFrame = nextFrame, now = () => performance.now(), budgetMs = 3 } = {},
) {
  const pending = new Set(renderer.info.programs);
  const count = pending.size;
  while (pending.size) {
    const started = now();
    for (const program of pending) {
      if (program.isReady()) {
        // r185 lazily checks shader logs and initializes uniform/attribute
        // locations here. KHR_parallel_shader_compile permits a readiness check;
        // without it, one GL call can still block while the loading screen is up.
        program.getUniforms();
        pending.delete(program);
      }
      if (now() - started >= budgetMs) break;
    }
    if (pending.size) await yieldFrame();
  }
  return count;
}

export async function prepareWorldShaders({
  renderer,
  scene,
  camera,
  worldTarget,
  normalTarget,
  normalMaterial,
  flashlight,
  battleLight,
  scheduling,
}) {
  const originalTarget = renderer.getRenderTarget();
  const originalTorch = flashlight.visible;
  const originalBattle = battleLight.visible;
  const originalMaterials = new Map();
  try {
    // RenderPass uses the composer's linear buffer, not screen output. This
    // determines both output colour space and tone-mapping program variants.
    renderer.setRenderTarget(worldTarget);
    for (const [torch, battle] of lightConfigurations) {
      flashlight.visible = torch;
      battleLight.visible = battle;
      await renderer.compileAsync(scene, camera);
      await finishPreparedPrograms(renderer, scheduling);
    }

    // compile() reads object.material rather than scene.overrideMaterial.
    // Reuse the actual Blender mesh variants to prepare GTAO's normal pass.
    // frame() is still gated by renderReady; no gameplay draw sees this swap.
    scene.traverse((object) => {
      if (!object.isMesh) return;
      originalMaterials.set(object, object.material);
      object.material = normalMaterial;
    });
    renderer.setRenderTarget(normalTarget);
    // Three's cache key includes light counts even for the normal material.
    for (const [torch, battle] of lightConfigurations) {
      flashlight.visible = torch;
      battleLight.visible = battle;
      await renderer.compileAsync(scene, camera);
      await finishPreparedPrograms(renderer, scheduling);
    }
  } finally {
    for (const [object, material] of originalMaterials)
      object.material = material;
    renderer.setRenderTarget(originalTarget);
    flashlight.visible = originalTorch;
    battleLight.visible = originalBattle;
  }
}
