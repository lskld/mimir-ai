import { apiFetch, apiJson, ApiError } from "./client"
import type { AnalyzeDocumentRequest, TrainingOutlineResponse } from "./types"

function parseBody(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return trimmed
  }
}

export async function startAnalysis(
  body: AnalyzeDocumentRequest,
  signal?: AbortSignal
): Promise<{ documentId: string }> {
  const res = await apiFetch("/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  const text = await res.text()
  const json = parseBody(text) as { documentId?: string } | string | null

  if (res.status === 202) {
    const id =
      typeof json === "object" && json !== null && "documentId" in json
        ? json.documentId
        : undefined
    if (id) {
      return { documentId: id }
    }
  }

  if (!res.ok) {
    const message =
      typeof json === "string"
        ? json
        : json &&
            typeof json === "object" &&
            "detail" in json &&
            typeof (json as { detail?: string }).detail === "string"
          ? (json as { detail: string }).detail
          : `Analysis start failed (${res.status})`
    throw new ApiError(message, res.status, json)
  }

  return {
    documentId:
      (typeof json === "object" &&
        json !== null &&
        "documentId" in json &&
        typeof (json as { documentId?: string }).documentId === "string"
        ? (json as { documentId: string }).documentId
        : body.documentId),
  }
}

/** Returns outline on success, `null` if not ready (404), `null` if still in progress (409). */
export async function tryGetOutline(
  documentId: string,
  signal?: AbortSignal
): Promise<TrainingOutlineResponse | null> {
  const res = await apiFetch(`/api/analysis/${documentId}/outline`, {
    method: "GET",
    signal,
  })

  if (res.status === 404 || res.status === 409) {
    return null
  }

  const text = await res.text()
  const body = parseBody(text)

  if (!res.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message?: string }).message === "string"
        ? (body as { message: string }).message
        : `Outline fetch failed (${res.status})`
    throw new ApiError(message, res.status, body)
  }

  return body as TrainingOutlineResponse
}

export async function getOutline(
  documentId: string,
  signal?: AbortSignal
): Promise<TrainingOutlineResponse> {
  const outline = await tryGetOutline(documentId, signal)
  if (!outline) {
    throw new ApiError("Outline not available", 404, null)
  }
  return outline
}

export async function approveOutline(
  documentId: string,
  signal?: AbortSignal
): Promise<TrainingOutlineResponse> {
  const res = await apiFetch(`/api/analysis/${documentId}/approve`, {
    method: "POST",
    signal,
  })

  const text = await res.text()
  const body = parseBody(text)

  if (!res.ok) {
    const message =
      typeof body === "string"
        ? body
        : body &&
            typeof body === "object" &&
            "detail" in body &&
            typeof (body as { detail?: string }).detail === "string"
          ? (body as { detail: string }).detail
          : body &&
              typeof body === "object" &&
              "message" in body &&
              typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : `Approve failed (${res.status})`
    throw new ApiError(message, res.status, body)
  }

  if (body && typeof body === "object" && "sections" in body) {
    return body as TrainingOutlineResponse
  }

  return getOutline(documentId, signal)
}
