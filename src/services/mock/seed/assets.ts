/**
 * Where the seed images live. Every seed image path is built here, so
 * swapping the placeholder artwork for generated photos is a change to this
 * file only (for example, from ".svg" to ".webp").
 */
const IMAGE_EXTENSION = 'svg'

export const AVATAR_VARIANTS = 3

export function avatarUrl(userId: string, variant = 1): string {
  return `/assets/avatars/${userId}-${variant}.${IMAGE_EXTENSION}`
}

export function coverUrl(slug: string): string {
  return `/assets/covers/${slug}.${IMAGE_EXTENSION}`
}

export function hubArtworkUrl(slug: string): string {
  return `/assets/hubs/${slug}.${IMAGE_EXTENSION}`
}
