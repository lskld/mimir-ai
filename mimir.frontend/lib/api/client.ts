import { apiUrl } from "./base"
import type { ProblemDetails } from "./types"

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function parseErrorBody(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return trimmed
  }
}

function formatApiErrorMessage(status: number, body: unknown): string {
  if (typeof body === "string" && body.length > 0) return body
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as ProblemDetails).detail
    if (typeof d === "string" && d.length > 0) return d
  }
  if (body && typeof body === "object" && "title" in body) {
    const t = (body as ProblemDetails).title
    if (typeof t === "string" && t.length > 0) return t
  }
  return `Request failed (${status})`
}

/** JSON request with default headers. */
export async function apiJson<T>(
  path: string,
  init: RequestInit & { parseJson?: true } = {}
): Promise<T> {
  const { parseJson = true, headers: h, ...rest } = init
  const headers = new Headers(h)
  if (rest.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const res = await fetch(apiUrl(path), { ...rest, headers })
  const text = await res.text()
  const body = text ? parseErrorBody(text) : null

  if (!res.ok) {
    throw new ApiError(formatApiErrorMessage(res.status, body), res.status, body)
  }

  if (!parseJson || !text) {
    return undefined as T
  }

  return body as T
}

/** Raw fetch for non-JSON or custom status handling. */
export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(apiUrl(path), init)
}
