// Crescent Bay — random.js
// RNG seedable (mulberry32) + helper acak. Semua generasi kota memakai ini
// supaya peta yang sama selalu muncul dari seed yang sama.

export function hashStringSeed(text) {
  let hash = 2166136261;
  const input = String(text);
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// RNG object kecil: simpan fungsi next + method helper dalam satu wadah.
export function createRng(seed) {
  const numericSeed = typeof seed === 'string' ? hashStringSeed(seed) : (seed >>> 0) || 1;
  const next = mulberry32(numericSeed);
  return {
    seed: numericSeed,
    next,
    float(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(probability) {
      return next() < probability;
    },
    shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
  };
}

// Helper sekali pakai tanpa membuat objek RNG.
export function randomInt(rng, min, max) {
  const next = typeof rng === 'function' ? rng : rng.next;
  return Math.floor(min + next() * (max - min + 1));
}

export function randomFloat(rng, min, max) {
  const next = typeof rng === 'function' ? rng : rng.next;
  return min + next() * (max - min);
}

export function randomPick(rng, list) {
  const next = typeof rng === 'function' ? rng : rng.next;
  return list[Math.floor(next() * list.length)];
}

export function randomShuffle(rng, list) {
  const next = typeof rng === 'function' ? rng : rng.next;
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function seedFromString(text) {
  return hashStringSeed(text);
}

export default createRng;
