/** An address on our Worker (api.<domain>), for example the partner redirect `/go/<event id>`. */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_URL
  return base ? `${base.replace(/\/$/, '')}${path}` : '#'
}
