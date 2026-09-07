import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readAnimalModel, modelFingerprint, clipFingerprint, animationDuration, poseHeightRange } from './lib/gltf-animal-pose.js';

// These fingerprints were recorded from the published exports before their
// Faint floor-contact correction, independently of the repaired files.
const baseline = JSON.parse(readFileSync(new URL('./fixtures/animal-faint-baseline.json', import.meta.url)));
for (const [animal, original] of Object.entries(baseline)) {
  test(`${animal}: Faint stays above the floor without changing the animal or its other clips`, () => {
    const model = readAnimalModel(new URL(`../game-assets/models/${animal}.glb`, import.meta.url));
    assert.deepEqual(modelFingerprint(model), original.structure, 'Geometry, material, embedded-image or skin-binding data changed');
    assert.deepEqual(model.gltf.animations.map((a) => a.name).sort(), ['Attack', 'Faint', 'Hit', 'Idle', 'Walk']);
    for (const [clip, fingerprint] of Object.entries(original.clips))
      assert.equal(clipFingerprint(model, clip), fingerprint, `${clip} no longer matches its original exported keyframes`);
    assert.equal(clipFingerprint(model, 'Faint', true), original.faintOtherTransforms,
      'Faint changed beyond body height and whisker-scale correction (1 micrometre tolerance for re-exported local transforms)');
    const duration = animationDuration(model, 'Faint');
    assert.equal(duration, original.duration, 'Original exported Faint timing changed');
    let final;
    for (let sample = 0; sample <= 160; sample++) {
      const time = duration * sample / 160;
      const bounds = poseHeightRange(model, 'Faint', time);
      assert.ok(bounds.minY >= 0, `${animal} crosses the ground at ${time.toFixed(4)}s: ${bounds.minY}m`);
      assert.ok(bounds.maxY > .02, `${animal} disappears below the ground`);
      final = bounds;
    }
    assert.ok(final.minY < .003, `${animal} final pose floats more than 3mm above its contact point`);
    assert.ok(final.skinMinY < .003, `${animal} is propped up on rigid whiskers instead of resting its body on the floor`);
    const initial = poseHeightRange(model, 'Faint', 0);
    assert.ok(final.maxY < initial.maxY * .8 || ['hamster', 'rat'].includes(animal), 'The original sideward roll was lost');
  });
}

test('export sampling holds the first key instead of extrapolating before Blender frame one', () => {
  const model = readAnimalModel(new URL('../game-assets/models/dog.glb', import.meta.url));
  const faint = model.gltf.animations.find((a) => a.name === 'Faint');
  const first = Math.min(...faint.samplers.map((s) => model.values(s.input)[0]));
  assert.ok(first > 0, 'Fixture must retain its original delayed first key');
  assert.deepEqual(poseHeightRange(model, 'Faint', 0), poseHeightRange(model, 'Faint', first));
});
