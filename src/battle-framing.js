// Match mobile-battle.css: the portrait handset starts 38% down the screen.
// Keep a 60-degree horizontal field of view and aim into the exposed world.
export function portraitBattleFrame(width, height, active) {
  if (!active || width > 650 || height <= width || width <= 0) return null;
  return {
    fov: Math.max(52, 2 * Math.atan(Math.tan(30 * Math.PI / 180) * height / width) * 180 / Math.PI),
    offsetY: height * 0.32,
    panelTop: height * 0.38,
  };
}
