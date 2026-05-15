/**
 * Base URL for the Mimir Minimal API (no trailing slash).
 * Set in `.env.local`: NEXT_PUBLIC_MIMIR_API_BASE_URL=http://localhost:5003
 */
export function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_MIMIR_API_BASE_URL ?? "http://localhost:5003"
  return raw.replace(/\/+$/, "")
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  const p = path.startsWith("/") ? path : `/${path}`
  return `${base}${p}`
}
