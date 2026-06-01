export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

export function damp(start, end, smoothing, deltaSeconds) {
  const alpha = 1 - Math.exp(-smoothing * deltaSeconds);
  return lerp(start, end, alpha);
}

export function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function wrap(value, min, max) {
  const range = max - min;
  if (range === 0) {
    return min;
  }
  return ((((value - min) % range) + range) % range) + min;
}

export function seededFloat(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

export function pickNearest(items, point) {
  return items.reduce((nearest, item) => {
    if (!nearest) {
      return item;
    }
    return distance2D(item, point) < distance2D(nearest, point) ? item : nearest;
  }, null);
}
