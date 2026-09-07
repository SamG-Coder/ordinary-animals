import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { portraitBattleFrame } from "../src/battle-framing.js";

test("portrait battle framing keeps horizontal vision and puts the aim above the phone", () => {
  for (const [width,height] of [[390,844],[360,640],[320,568],[650,900]]) {
    const frame=portraitBattleFrame(width,height,true);
    const camera=new PerspectiveCamera(frame.fov,width/height,.1,100);
    camera.setViewOffset(width,height,0,frame.offsetY,width,height);
    const target=new Vector3(0,0,-3).project(camera);
    assert.ok(Math.abs((1-target.y)*height/2-height*.18)<.001);
    const horizontal=2*Math.atan(Math.tan(frame.fov*Math.PI/360)*width/height)*180/Math.PI;
    assert.ok(Math.abs(horizontal-60)<.001);
    assert.equal(frame.panelTop,height*.38);
  }
});

test("exploration, desktop and landscape retain normal camera framing", () => {
  for(const [width,height,active] of [[390,844,false],[1440,960,true],[844,390,true],[650,650,true],[0,844,true]])
    assert.equal(portraitBattleFrame(width,height,active),null);
});
