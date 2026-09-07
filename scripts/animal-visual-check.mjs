import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 820 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("http://127.0.0.1:5174/animal-review", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html><head><style>body{margin:0;background:#10181c;color:#dedccc;font:12px monospace}canvas{position:absolute;inset:0}.labels{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:1fr 1fr;pointer-events:none}.labels div{padding:22px;border:1px solid #99aa9922}</style><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head><body><div class="labels">${["CAT", "DOG", "HAMSTER", "RAT", "RABBIT", "FOX", "RACCOON", "GOAT"].map((s) => `<div>${s} / BLENDER ASSET</div>`).join("")}</div><script type="module">
import * as T from 'three';import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;document.body.prepend(renderer.domElement);renderer.setScissorTest(true);
const loader=new GLTFLoader();const entries=[];
for(const name of ['cat','dog','hamster','rat','rabbit','fox','raccoon','goat']){
 const gltf=await loader.loadAsync('/models/'+name+'.glb');const scene=new T.Scene();scene.background=new T.Color('#172126');scene.add(gltf.scene);scene.add(new T.HemisphereLight(0xbcd7e8,0x493d29,2.2));const sun=new T.DirectionalLight(0xffdbb5,3.5);sun.position.set(2,4,3);scene.add(sun);
 const camera=new T.PerspectiveCamera(38,360/410,.01,50);const box=new T.Box3().setFromObject(gltf.scene);const center=box.getCenter(new T.Vector3());const size=box.getSize(new T.Vector3()).length();camera.position.copy(center).add(new T.Vector3(1.35,.75,1.55).multiplyScalar(size*.83));camera.lookAt(center);
 entries.push({name,scene,camera,gltf,mixer:new T.AnimationMixer(gltf.scene),size});
}
window.showClip=(clip)=>{const bounds=[];entries.forEach((e,i)=>{e.mixer.stopAllAction();const action=e.mixer.clipAction(e.gltf.animations.find(a=>a.name===clip));action.reset().play();e.mixer.setTime(action.getClip().duration*.4);e.gltf.scene.updateMatrixWorld(true);e.gltf.scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});const b=new T.Box3().setFromObject(e.gltf.scene);bounds.push({name:e.name,size:b.getSize(new T.Vector3()).toArray()});const x=i%4*360,y=i<4?410:0;renderer.setViewport(x,y,360,410);renderer.setScissor(x,y,360,410);renderer.render(e.scene,e.camera);});return bounds;};window.showClip('Idle');window.ready=true;
</script></body></html>`,
  }),
);
try {
  await page.goto("http://127.0.0.1:5174/animal-review");
  await page.waitForFunction(() => window.ready);
  for (const clip of ["Idle", "Walk", "Attack", "Hit", "Faint"]) {
    const bounds = await page.evaluate((clip) => window.showClip(clip), clip);
    for (const animal of bounds)
      for (const n of animal.size) {
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThan(0.02);
        expect(n).toBeLessThan(4);
      }
    await page.screenshot({
      path: "artifacts/animals-" + clip.toLowerCase() + ".png",
    });
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS: eight skinned animals, five clips each; finite animation bounds and visual contact sheets",
  );
} finally {
  await browser.close();
}
