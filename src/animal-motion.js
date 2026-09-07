const PACES = {
  cat: 0.55,
  dog: 0.75,
  hamster: 0.28,
  rat: 0.4,
  rabbit: 0.65,
  fox: 0.7,
  raccoon: 0.5,
  goat: 0.45,
};
export function clearSegment(from, to, blocked) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(distance / 0.12));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blocked(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t))
      return false;
  }
  return true;
}
export function createWander(species, x, z, seed = 1) {
  return {
    species,
    x,
    z,
    home: { x, z },
    target: null,
    wait: 4 + (seed % 4),
    seed: Math.max(1, seed >>> 0),
    heading: 0,
  };
}
function random(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}
export function updateWander(state, dt, player, blocked, paused = false) {
  if (paused) return false;
  const distance = Math.hypot(player.x - state.x, player.z - state.z);
  if (distance < 3.5) {
    state.target = null;
    state.wait = 2;
    state.heading = Math.atan2(player.x - state.x, player.z - state.z);
    return false;
  }
  if (!state.target) {
    state.wait -= dt;
    if (state.wait > 0) return false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = random(state) * Math.PI * 2,
        radius = 0.7 + random(state) * 2.3;
      const target = {
        x: state.home.x + Math.sin(angle) * radius,
        z: state.home.z + Math.cos(angle) * radius,
      };
      if (clearSegment(state, target, blocked)) {
        state.target = target;
        break;
      }
    }
    if (!state.target) {
      state.wait = 2;
      return false;
    }
  }
  const dx = state.target.x - state.x,
    dz = state.target.z - state.z,
    length = Math.hypot(dx, dz);
  const step = Math.min(length, (PACES[state.species] ?? 0.5) * dt);
  const next = {
    x: state.x + (dx / Math.max(0.001, length)) * step,
    z: state.z + (dz / Math.max(0.001, length)) * step,
  };
  if (!clearSegment(state, next, blocked)) {
    state.target = null;
    state.wait = 2;
    return false;
  }
  state.x = next.x;
  state.z = next.z;
  state.heading = Math.atan2(dx, dz);
  if (length < 0.08) {
    state.target = null;
    state.wait = 3 + random(state) * 5;
  }
  return step > 0.001;
}

// Breadcrumbs preserve turns through doors and gates instead of cutting through walls.
export function followTrail(current, trail, player, dt, blocked) {
  const last = trail.at(-1) ?? current;
  if (Math.hypot(player.x - last.x, player.z - last.z) > 0.35)
    trail.push({ x: player.x, z: player.z });
  while (
    trail.length > 1 &&
    Math.hypot(trail[0].x - current.x, trail[0].z - current.z) < 0.15
  )
    trail.shift();
  if (Math.hypot(player.x - current.x, player.z - current.z) < 1.35)
    return false;
  const target = trail[0] ?? player;
  const dx = target.x - current.x,
    dz = target.z - current.z,
    length = Math.hypot(dx, dz);
  const step = Math.min(length, dt * 3.8);
  const next = {
    x: current.x + (dx / Math.max(0.001, length)) * step,
    z: current.z + (dz / Math.max(0.001, length)) * step,
  };
  if (!clearSegment(current, next, blocked)) return false;
  current.x = next.x;
  current.z = next.z;
  return step > 0.001;
}
