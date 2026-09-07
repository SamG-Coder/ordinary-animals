import test from "node:test";
import assert from "node:assert/strict";
import { createLookControl } from "../src/look-control.js";
function fixture() {
  const state = {
    locked: false,
    allowed: true,
    requests: 0,
    releases: 0,
    fallbacks: 0,
  };
  const control = createLookControl({
    isLocked: () => state.locked,
    canLook: () => state.allowed,
    request: () => {
      state.requests++;
      state.locked = true;
    },
    release: () => {
      state.releases++;
      state.locked = false;
    },
    onFallback: () => state.fallbacks++,
  });
  return { state, control };
}
test("dialogue chains and battle returns restore the player mouse-look preference", () => {
  const { state, control } = fixture();
  control.engage();
  state.allowed = false;
  control.suspend();
  control.changed();
  control.suspend();
  control.resume();
  assert.equal(state.requests, 1);
  state.allowed = true;
  control.resume();
  assert.equal(state.requests, 2);
  assert.equal(state.locked, true);
});
test("Escape in the world cancels automatic recapture, and drag-only players are left alone", () => {
  const { state, control } = fixture();
  control.suspend();
  control.resume();
  assert.equal(state.requests, 0);
  control.engage();
  state.locked = false;
  control.changed();
  state.allowed = false;
  control.suspend();
  state.allowed = true;
  control.resume();
  assert.equal(state.requests, 1);
});
test("pointer-lock rejection leaves a usable click/drag fallback", async () => {
  let fallback = 0;
  const control = createLookControl({
    isLocked: () => false,
    canLook: () => true,
    release: () => {},
    request: () => Promise.reject(new Error("denied")),
    onFallback: () => fallback++,
  });
  control.engage();
  await Promise.resolve();
  assert.equal(fallback, 1);
});

test("New Game can remember mouse-look through the opening SMS without capturing it early",()=>{
  const {state,control}=fixture();
  state.allowed=false;
  control.prepare();
  control.suspend();
  control.resume();
  assert.equal(state.requests,0);
  state.allowed=true;
  control.resume();
  assert.equal(state.requests,1);
});
