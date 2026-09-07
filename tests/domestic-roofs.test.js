import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Group, Scene, Vector3 } from "three";
import { assembleWorld } from "../src/world.js";
import { loadCatalog, exportedBounds } from "./lib/scene-geometry.js";

const catalog=loadCatalog();
const assets=Object.fromEntries(Object.keys(catalog).map(name=>[name,{scene:new Group(),animations:[]}]));
const world=assembleWorld(new Scene(),assets,catalog,JSON.parse(readFileSync("game-assets/bedroom-layout.json")));
const panels=world.placementLog.filter(p=>p.asset==="roof-panel-4m");

test("domestic roof cores match their floor modules without overlapping exported metal skins",()=>{
  const local=exportedBounds(catalog,"roof-panel-4m");
  assert.ok(Math.abs(local.max.x-local.min.x-4)<1e-5);
  assert.ok(Math.abs(local.max.z-local.min.z-4)<1e-5);
  assert.equal(panels.length,22,"Bedroom, extended home and clinic all have roof cores");
  const boxes=panels.map(p=>local.clone().translate(new Vector3(p.x,p.y,p.z)));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
    const a=boxes[i],b=boxes[j];
    const width=Math.min(a.max.x,b.max.x)-Math.max(a.min.x,b.min.x);
    const depth=Math.min(a.max.z,b.max.z)-Math.max(a.min.z,b.min.z);
    assert.ok(width<1e-5||depth<1e-5,`Roof cores ${i}/${j} have overlapping skins`);
  }
});
test("every roof eave borders the outside of the furnished footprint",()=>{
  const covered=(x,z)=>panels.some(p=>Math.abs(x-p.x)<2&&Math.abs(z-p.z)<2);
  for(const edge of world.info.roofEdges) {
    const dx=Math.sin(edge.rotation)*.2,dz=Math.cos(edge.rotation)*.2;
    assert.equal(covered(edge.x-dx,edge.z-dz),true,"Eave must attach to a roof core");
    assert.equal(covered(edge.x+dx,edge.z+dz),false,"Internal room joins must not carry gutters");
  }
});
