import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STARTERS,
  ENCOUNTERS,
  CORRECT_MOVE,
  startEncounter,
  takeTurn,
  parseSave,
} from '../src/game.js';
import { findPath } from '../src/navigation.js';

test('every encounter can be won by responding to the current mood', () => {
  for (const encounter of ENCOUNTERS) {
    let battle = startEncounter(encounter.id);
    while (!battle.outcome && battle.turn < 20)
      battle = takeTurn(
        battle,
        CORRECT_MOVE[encounter.moods[battle.turn % encounter.moods.length]],
      );
    assert.equal(battle.outcome, 'won', encounter.id);
    assert.equal(battle.trust, 100);
    assert.ok(battle.confidence > 0);
  }
});
test('ignoring the animal can lose; a new attempt restores confidence', () => {
  let battle = startEncounter('pigeon');
  const e = ENCOUNTERS[0];
  while (!battle.outcome) {
    const correct = CORRECT_MOVE[e.moods[battle.turn % e.moods.length]];
    battle = takeTurn(
      battle,
      Object.values(CORRECT_MOVE).find((m) => m !== correct),
    );
  }
  assert.equal(battle.outcome, 'lost');
  assert.equal(startEncounter('pigeon').confidence, 100);
  assert.deepEqual(takeTurn(battle, 'snack'), battle);
});
test('full campaign saves and restores for all three starters', () => {
  for (const starter of Object.keys(STARTERS)) {
    const state = { starter, stamps: ENCOUNTERS.map((e) => e.id), chapter: 2, completed: true };
    assert.deepEqual(parseSave(JSON.stringify(state)), state);
  }
});
test('save parser handles corrupt data, duplicate stamps and locked chapters', () => {
  for (const raw of ['bad', 'null', '{}', '{"starter":"toString"}'])
    assert.equal(parseSave(raw), null);
  assert.deepEqual(
    parseSave(
      JSON.stringify({
        starter: 'cat',
        stamps: ['pigeon', 'pigeon', 'invented'],
        chapter: 2,
        completed: true,
      }),
    ),
    { starter: 'cat', stamps: ['pigeon'], chapter: 0, completed: false },
  );
  assert.equal(parseSave(JSON.stringify({ starter: 'dog', stamps: {}, chapter: -3 })).chapter, 0);
});
test('invalid encounter and move cannot corrupt game state', () => {
  assert.throws(() => startEncounter('missing'));
  const b = startEncounter('cat');
  assert.equal(takeTurn(b, 'invalid'), b);
});
test('click navigation routes around a building and never cuts a blocked corner', () => {
  const blocked = (x, z) => Math.abs(x) < 1.2 && Math.abs(z) < 1.2;
  const path = findPath({ x: -3, z: 0 }, { x: 3, z: 0 }, blocked);
  assert.ok(path.length > 0);
  assert.deepEqual(path.at(-1), { x: 3, z: 0 });
  assert.ok(path.every((p) => !blocked(p.x, p.z)));
  assert.ok(path.some((p) => Math.abs(p.z) >= 1.5));
});
test('navigation rejects an enclosed target', () => {
  const path = findPath(
    { x: 0, z: 0 },
    { x: 5, z: 5 },
    (x, z) => Math.abs(x) > 1 || Math.abs(z) > 1,
  );
  assert.deepEqual(path, []);
});
