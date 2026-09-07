import test from "node:test";
import assert from "node:assert/strict";
import { phoneFocusables, phoneFocusWrap } from "../src/phone-ui.js";

// DOM-shaped controls keep this a pure Node check: no page, events or focus calls.
function control(
  name,
  { disabled = false, hidden = false, visible = true, tabIndex = 0 } = {},
) {
  return {
    name,
    disabled,
    tabIndex,
    closest: () => (hidden ? {} : null),
    getClientRects: () => (visible ? [{}] : []),
  };
}
const root = (...nodes) => ({ querySelectorAll: () => nodes });

test("opening SMS can tab past NEXT to phone navigation instead of trapping inside dialogue", () => {
  const back = control("back"),
    home = control("home"),
    next = control("next"),
    bar = control("home-bar");
  const phone = root(back, home, next, bar);
  assert.deepEqual(phoneFocusables(phone), [back, home, next, bar]);
  assert.equal(phoneFocusWrap(phone, next), null); // Native Tab continues to the home bar.
  assert.equal(phoneFocusWrap(phone, next, true), null); // Native Shift+Tab reaches Home.
  assert.equal(phoneFocusWrap(phone, bar), back);
  assert.equal(phoneFocusWrap(phone, back, true), bar);
});

test("hidden app controls and disabled purchases are excluded from phone focus", () => {
  const hidden = control("inactive-page", { hidden: true });
  const cssHidden = control("hidden-journal-close", { visible: false });
  const disabled = control("unaffordable-purchase", { disabled: true });
  const programmaticOnly = control("not-tab-stop", { tabIndex: -1 });
  const home = control("home"),
    input = control("player-name");
  const phone = root(
    hidden,
    home,
    disabled,
    cssHidden,
    input,
    programmaticOnly,
  );
  assert.deepEqual(phoneFocusables(phone), [home, input]);
  assert.equal(phoneFocusWrap(phone, input), home);
});

test("focus arriving from outside the phone enters at the correct end, with empty scopes harmless", () => {
  const back = control("back"),
    bar = control("home-bar"),
    outside = control("canvas");
  const phone = root(back, bar);
  assert.equal(phoneFocusWrap(phone, outside), back);
  assert.equal(phoneFocusWrap(phone, outside, true), bar);
  assert.equal(phoneFocusWrap(root(), outside), null);
});
