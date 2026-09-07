// Pointer ownership keeps a moving thumb independent from the camera thumb.
export function createTouchInput() {
  const axes = { x: 0, z: 0 }, knob = { x: 0, y: 0 };
  let movement = null, look = null, sprint = null;
  function updateMove(x, y) {
    const dx = x - movement.x, dy = y - movement.y;
    const length = Math.hypot(dx, dy), reach = Math.min(1, length / movement.radius);
    const directionX = length ? dx / length : 0, directionY = length ? dy / length : 0;
    knob.x = directionX * reach * movement.radius;
    knob.y = directionY * reach * movement.radius;
    const speed = Math.max(0, (reach - 0.12) / 0.88);
    axes.x = directionX * speed;
    axes.z = directionY * speed;
  }
  const owns = id => movement?.id === id || look?.id === id || sprint === id;
  return {
    axes, knob,
    get sprinting() { return sprint !== null; },
    beginMove(id, x, y, centerX, centerY, radius) {
      if (movement || owns(id)) return false;
      movement = { id, x: centerX, y: centerY, radius: Math.max(1, radius) };
      updateMove(x, y);
      return true;
    },
    move(id, x, y) {
      if (movement?.id !== id) return false;
      updateMove(x, y);
      return true;
    },
    beginLook(id, x, y) {
      if (look || owns(id)) return false;
      look = { id, x, y };
      return true;
    },
    rotate(id, x, y) {
      if (look?.id !== id) return null;
      const delta = { x: x - look.x, y: y - look.y };
      look.x = x; look.y = y;
      return delta;
    },
    beginSprint(id) {
      if (sprint !== null || owns(id)) return false;
      sprint = id;
      return true;
    },
    end(id) {
      if (movement?.id === id) { movement = null; axes.x = axes.z = knob.x = knob.y = 0; }
      if (look?.id === id) look = null;
      if (sprint === id) sprint = null;
    },
    reset() {
      movement = look = sprint = null;
      axes.x = axes.z = knob.x = knob.y = 0;
    },
  };
}

export function mountTouchControls({ canvas, root, stick, knob, sprint, torch, canExplore, onLook, onTorch }) {
  // Declare gesture ownership before the first touch, preserving phone scrolling.
  canvas.style.touchAction = "none";
  const input = createTouchInput();
  let enabled = matchMedia("(any-pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  function paint() {
    knob.style.transform = `translate(${input.knob.x}px, ${input.knob.y}px)`;
    sprint.setAttribute("aria-pressed", String(input.sprinting));
  }
  function reset() {
    input.reset();
    paint();
  }
  function sync() {
    document.documentElement.classList.toggle("touch-controls-enabled", enabled);
    root.hidden = !enabled || !canExplore();
    if (root.hidden) reset();
  }
  function enable(event) {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      enabled = true;
      sync();
    }
  }
  function capture(element, event) {
    event.preventDefault();
    try { element.setPointerCapture(event.pointerId); } catch { /* Window end/cancel still releases state. */ }
  }
  window.addEventListener("pointerdown", enable, { capture: true });
  stick.addEventListener("pointerdown", event => {
    if (!canExplore() || event.button > 0) return;
    const rect = stick.getBoundingClientRect();
    if (input.beginMove(event.pointerId, event.clientX, event.clientY,
      rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width * 0.32)) {
      capture(stick, event);
      paint();
    }
  });
  canvas.addEventListener("pointerdown", event => {
    if (!canExplore() || !["touch", "pen"].includes(event.pointerType) || event.clientX < innerWidth * 0.4) return;
    if (input.beginLook(event.pointerId, event.clientX, event.clientY)) capture(canvas, event);
  });
  sprint.addEventListener("pointerdown", event => {
    if (canExplore() && event.button <= 0 && input.beginSprint(event.pointerId)) {
      capture(sprint, event);
      paint();
    }
  });
  torch.addEventListener("click", () => { if (canExplore()) onTorch(); });
  window.addEventListener("pointermove", event => {
    if (!canExplore()) return;
    const moved = input.move(event.pointerId, event.clientX, event.clientY);
    const delta = input.rotate(event.pointerId, event.clientX, event.clientY);
    if (moved || delta) {
      event.preventDefault();
      if (moved) paint();
      if (delta) onLook(delta.x, delta.y);
    }
  }, { passive: false });
  const end = event => { input.end(event.pointerId); paint(); };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  for (const element of [stick, canvas, sprint]) element.addEventListener("lostpointercapture", end);
  window.addEventListener("blur", reset);
  window.addEventListener("resize", reset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); });
  sync();
  return { input, sync, reset, get enabled() { return enabled; }, useMouse() { enabled = false; sync(); } };
}
