// Pure keyboard routing: callers perform the selected action, never dispatch input.
export function ignoresGameKeyboard(event) {
  return Boolean(
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.target?.isContentEditable ||
    event.target?.closest?.('input, textarea, select, [role="textbox"]'),
  );
}

export function gameplayShortcut(event, { playing, modal, battle }) {
  if (!playing || modal || event.repeat || ignoresGameKeyboard(event))
    return null;
  const key = event.key.toLowerCase();
  if (battle) {
    if (battle.busy || battle.finished || !["1", "2", "3", "4"].includes(key))
      return null;
    return { action: "move", index: Number(key) - 1 };
  }
  return key === "3" || key === "j" ? { action: "phone" } : null;
}
