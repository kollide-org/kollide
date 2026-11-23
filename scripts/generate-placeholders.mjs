/**
 * Draws the placeholder artwork for the seed data: event covers, hub artwork
 * and monogram avatars, as small SVG files in public/assets.
 *
 * These stand in for photographs. Every piece is soft, shapeless light in
 * the brand palette, like a photograph out of focus, so the product looks
 * finished until the real photographs replace them. To swap in real images, add the
 * files and change IMAGE_EXTENSION in src/services/mock/seed/assets.ts.
 *
 *   npm run placeholders
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'assets')
const capitals = JSON.parse(readFileSync(join(root, 'scripts', 'gloock-capitals.json'), 'utf8'))

// Read the seed through Vite, so this script always matches the data.
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { PEOPLE } = await server.ssrLoadModule('/src/services/mock/seed/people.ts')
const { buildEvents, buildHubs, HUB_NYE } = await server.ssrLoadModule('/src/services/mock/seed/events.ts')
const { EVENT_CATEGORIES } = await server.ssrLoadModule('/src/services/types/event.ts')
await server.close()

/** A deterministic random source, seeded from a string. */
function randomFrom(text) {
  let state = 2166136261
  for (const char of text) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CHERRY = '#a63a50'
const DUSTY = '#ba6e63'
const ANTIQUE = '#f0e7d8'
const INK = '#2a2224'
const WINE = '#6e2233'
const GOLD = '#d9b26a'

/** [background from, background to, first light, second light, third light, blend mode] */
const PALETTES = {
  rose: ['#f3e6d6', '#e7c6ba', CHERRY, DUSTY, WINE, 'multiply'],
  wine: ['#7a2639', '#3d1622', '#c75a6f', '#e0a090', ANTIQUE, 'screen'],
  clay: ['#ecd2b8', '#cf9a7b', CHERRY, '#f6e9da', '#7a3b2e', 'multiply'],
  night: [INK, '#4c2a3b', DUSTY, CHERRY, GOLD, 'screen'],
  sage: ['#e3e6d6', '#bcc7a9', '#7f9a7a', CHERRY, '#3f5140', 'multiply'],
  blush: ['#f7e7df', '#ecc7bc', DUSTY, GOLD, CHERRY, 'multiply'],
  gold: ['#2d2022', '#5c2031', GOLD, CHERRY, ANTIQUE, 'screen'],
}

const CATEGORY_PALETTE = {
  house_party: 'wine',
  games: 'clay',
  food_drink: 'blush',
  music: 'night',
  outdoors: 'sage',
  arts: 'rose',
  wellness: 'sage',
  nightlife: 'night',
}

const round = (value) => Math.round(value * 10) / 10

const grain = (id) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .45 0 0 0 0 .45 0 0 0 .22 0"/></filter>`

/**
 * Soft light with no shapes: a base gradient, three wide pools of colour with
 * blurred edges, and a film of grain. It reads as a photograph out of focus,
 * a stand-in for the real photograph that will replace it.
 */
function composition(key, width, height, paletteName) {
  const random = randomFrom(key)
  const [from, to, first, second, detail, blend] = PALETTES[paletteName]
  const angle = Math.floor(random() * 360)
  const pool = (colour, id) => {
    const cx = round(0.1 + random() * 0.8)
    const cy = round(0.1 + random() * 0.8)
    const r = round(0.45 + random() * 0.35)
    return [
      `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${colour}" stop-opacity="${round(0.55 + random() * 0.3)}"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></radialGradient>`,
      `<rect width="${width}" height="${height}" fill="url(#${id})" style="mix-blend-mode:${blend}"/>`,
    ]
  }
  const pools = [pool(first, 'p1'), pool(second, 'p2'), pool(detail, 'p3')]

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice">`,
    `<defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>${pools.map((item) => item[0]).join('')}${grain('n')}</defs>`,
    `<rect width="${width}" height="${height}" fill="url(#g)"/>`,
    ...pools.map((item) => item[1]),
    `<rect width="${width}" height="${height}" filter="url(#n)" opacity=".55" style="mix-blend-mode:soft-light"/>`,
    `</svg>`,
  ].join('')
}

const AVATAR_TONES = [
  ['#f1d9d6', '#e6b8ae', CHERRY, WINE],
  ['#ecdccf', '#d9b79d', '#7a3b2e', CHERRY],
  [CHERRY, WINE, '#f6e9da', DUSTY],
  [DUSTY, '#9c5247', '#f6e9da', WINE],
  ['#e3e6d6', '#bcc7a9', '#3f5140', '#7f9a7a'],
  ['#f3e6d6', '#e3cba9', WINE, GOLD],
  [INK, '#4c2a3b', '#f0c9c0', DUSTY],
  ['#f7e7df', '#eac9a8', CHERRY, GOLD],
]

/** A monogram: the person’s initial in the display font, over a soft pool of light. */
function avatar(person, variant) {
  const size = 400
  const random = randomFrom(`${person.id}-${variant}`)
  const tone = AVATAR_TONES[Math.floor(randomFrom(person.id)() * AVATAR_TONES.length + variant - 1) % AVATAR_TONES.length]
  const [from, to, ink, accent] = tone
  const glyph = capitals[person.firstName[0].toUpperCase()]
  const glyphHeight = glyph.y2 - glyph.y1
  const scale = (size * (variant === 3 ? 0.3 : 0.44)) / glyphHeight
  const x = size / 2 - ((glyph.x1 + glyph.x2) / 2) * scale
  const y = size / 2 - ((glyph.y1 + glyph.y2) / 2) * scale
  const cx = size * (0.26 + random() * 0.5)
  const cy = size * (0.62 + random() * 0.24)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<defs><linearGradient id="g" gradientTransform="rotate(${45 + variant * 30} .5 .5)"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient><radialGradient id="l" cx="${round(cx / size)}" cy="${round(cy / size)}" r=".7"><stop offset="0" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect width="${size}" height="${size}" fill="url(#g)"/>`,
    `<rect width="${size}" height="${size}" fill="url(#l)"/>`,
    `<path transform="translate(${round(x)} ${round(y)}) scale(${round(scale * 1000) / 1000})" fill="${ink}" d="${glyph.d}"/>`,
    `</svg>`,
  ].join('')
}

function write(folder, name, svg) {
  mkdirSync(join(out, folder), { recursive: true })
  writeFileSync(join(out, folder, `${name}.svg`), `${svg}\n`)
}

const events = buildEvents(new Date()).filter((event) => !event.id.startsWith('ev-past-'))
for (const event of events) {
  const palette = event.hubId === HUB_NYE ? 'gold' : CATEGORY_PALETTE[event.category]
  write('covers', event.slug, composition(event.slug, 1200, 800, palette))
}
for (const category of EVENT_CATEGORIES) {
  write('covers', `category-${category}`, composition(`category-${category}`, 1200, 800, CATEGORY_PALETTE[category]))
}

const HUB_PALETTE = { 'new-years-eve': 'gold', 'long-weekend-outdoors': 'sage' }
for (const hub of buildHubs(new Date())) {
  write('hubs', hub.slug, composition(hub.slug, 1600, 900, HUB_PALETTE[hub.slug] ?? 'rose'))
}

for (const person of PEOPLE) {
  for (const variant of [1, 2, 3]) write('avatars', `${person.id}-${variant}`, avatar(person, variant))
}

console.log(`Wrote ${events.length + EVENT_CATEGORIES.length} covers, ${PEOPLE.length * 3} avatars and hub artwork to public/assets`)
