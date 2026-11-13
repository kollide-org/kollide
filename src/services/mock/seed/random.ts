/** A small seeded random source, so the seed data is the same on every machine. */
export interface Random {
  next: () => number
  int: (min: number, max: number) => number
  chance: (probability: number) => boolean
  pick: <T>(items: readonly T[]) => T
  sample: <T>(items: readonly T[], count: number) => T[]
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const sample = <T>(items: readonly T[], count: number): T[] => {
    const pool = [...items]
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, Math.max(0, Math.min(count, pool.length)))
  }
  return {
    next,
    int,
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
    sample,
  }
}
