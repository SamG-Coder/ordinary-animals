import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

// A separate view-model pass, using the same renderer, keeps the Blender hands
// out of the world's ambient-occlusion/shadow passes and prevents wall clipping.
export function createHeldPhone(gltf, element) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
  camera.position.z = 1000;
  scene.add(new THREE.HemisphereLight(0xcad4df, 0x32212b, 1.7));
  const light = new THREE.DirectionalLight(0xffe0bf, 2.2);
  light.position.set(-200, 400, 700);
  scene.add(light);
  const root = clone(gltf.scene);
  scene.add(root);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  const mixer = new THREE.AnimationMixer(root);
  gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  let rect = null,
    dirty = true;
  const observer = new ResizeObserver(() => {
    dirty = true;
  });
  observer.observe(element);
  return {
    invalidate() {
      dirty = true;
    },
    render(renderer, dt) {
      if (element.hidden) return;
      if (dirty || !rect) {
        rect = element.getBoundingClientRect();
        dirty = false;
        camera.left = -innerWidth / 2;
        camera.right = innerWidth / 2;
        camera.top = innerHeight / 2;
        camera.bottom = -innerHeight / 2;
        camera.updateProjectionMatrix();
        root.position.set(
          rect.x + rect.width / 2 - innerWidth / 2,
          innerHeight / 2 - rect.y - rect.height / 2,
          0,
        );
        const sx = rect.width / 0.074,
          sy = rect.height / 0.157;
        root.scale.set(sx, sy, Math.min(sx, sy));
      }
      mixer.update(dt);
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
    },
    async prepare(renderer) {
      await renderer.compileAsync(scene, camera);
      // Keep the CSS handset as a loading fallback until the Blender pass is ready.
      element.classList.add("has-held-model");
      dirty = true;
    },
  };
}
