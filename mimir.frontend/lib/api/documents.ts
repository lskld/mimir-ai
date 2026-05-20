import { apiJson, ApiError } from "./client"
import { apiUrl } from "./base"
import type { DocumentResponse } from "./types"

export async function uploadDocument(
  file: File,
  regulationType?: string,
  signal?: AbortSignal
): Promise<DocumentResponse> {
  const params = new URLSearchParams()
  if (regulationType?.trim()) {
    params.set("regulationType", regulationType.trim())
  }
  const qs = params.toString()
  const path = `/api/documents/upload${qs ? `?${qs}` : ""}`

  const formData = new FormData()
  formData.append("file", file)

  const res = await fetch(apiUrl(path), {
    method: "POST",
    body: formData,
    signal,
  })

  const text = await res.text()
  let body: unknown = null
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    throw new ApiError(
      typeof body === "string" ? body : `Upload failed (${res.status})`,
      res.status,
      body
    )
  }

  return body as DocumentResponse
}

export async function listDocuments(
  signal?: AbortSignal
): Promise<DocumentResponse[]> {
  return apiJson<DocumentResponse[]>("/api/documents", {
    method: "GET",
    signal,
  })
}

export async function getDocument(
  documentId: string,
  signal?: AbortSignal
): Promise<DocumentResponse> {
  return apiJson<DocumentResponse>(`/api/documents/${documentId}`, {
    method: "GET",
    signal,
  })
}
