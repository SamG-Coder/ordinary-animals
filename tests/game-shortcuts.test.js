import test from "node:test";
import assert from "node:assert/strict";
import {
  gameplayShortcut,
  ignoresGameKeyboard,
} from "../src/game-shortcuts.js";

const exploration = { playing: true, modal: null, battle: null };
const press = (key, options = {}) => ({ key, ...options });

test("3 opens the phone during exploration and J remains an alias", () => {
  for (const event of [
    press("3"),
    press("3", { code: "Numpad3" }),
    press("j"),
    press("J"),
  ])
    assert.deepEqual(gameplayShortcut(event, exploration), { action: "phone" });
  for (const key of ["1", "2", "4", "#", "e", "f"])
    assert.equal(gameplayShortcut(press(key), exploration), null);
});

test("all four numbers remain battle moves and cannot open the phone", () => {
  const context = { ...exploration, battle: { busy: false, finished: false } };
  for (let index = 0; index < 4; index++)
    assert.deepEqual(gameplayShortcut(press(String(index + 1)), context), {
      action: "move",
      index,
    });
  assert.equal(gameplayShortcut(press("j"), context), null);
  for (const battle of [
    { busy: true },
    { finished: true },
    { busy: true, finished: true },
  ])
    for (const key of ["1", "2", "3", "4", "j"])
      assert.equal(
        gameplayShortcut(press(key), { ...exploration, battle }),
        null,
      );
});

test("title and modal actions keep their own keys, including battle party and settings pages", () => {
  for (const context of [
    { ...exploration, playing: false },
    ...[
      "registration",
      "journal",
      "dialogue",
      "choose",
      "settings-panel",
      "ending",
    ].map((modal) => ({ ...exploration, modal })),
    { ...exploration, modal: "journal", battle: { busy: false } },
  ])
    for (const key of ["3", "j", "1"])
      assert.equal(gameplayShortcut(press(key), context), null);
});

test("form fields and editable descendants keep typing without invoking gameplay", () => {
  for (const tag of ["input", "textarea", "select", '[role="textbox"]']) {
    const target = {
      closest: (selector) => (selector.includes(tag) ? { tag } : null),
    };
    assert.equal(ignoresGameKeyboard(press("3", { target })), true);
    assert.equal(gameplayShortcut(press("3", { target }), exploration), null);
    assert.equal(gameplayShortcut(press("j", { target }), exploration), null);
  }
  assert.equal(
    gameplayShortcut(
      press("3", { target: { isContentEditable: true } }),
      exploration,
    ),
    null,
  );
  assert.deepEqual(
    gameplayShortcut(
      press("3", { target: { closest: () => null } }),
      exploration,
    ),
    { action: "phone" },
  );
});

test("held keys, input composition, consumed events and system shortcuts trigger no action", () => {
  for (const flag of [
    "repeat",
    "isComposing",
    "defaultPrevented",
    "ctrlKey",
    "altKey",
    "metaKey",
  ])
    for (const key of ["3", "j"])
      for (const battle of [null, { busy: false, finished: false }])
        assert.equal(
          gameplayShortcut(press(key, { [flag]: true }), {
            ...exploration,
            battle,
          }),
          null,
        );
});
