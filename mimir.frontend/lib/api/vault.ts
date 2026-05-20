import { apiFetch, apiJson, ApiError } from "./client"
import type {
  AssignDocumentRequest,
  ResolvedDocumentResponse,
  ResolvedDocumentSetResponse,
  VaultTargetType,
} from "./types"

export async function getTargetDocuments(
  targetType: VaultTargetType,
  targetId: string,
  signal?: AbortSignal
): Promise<ResolvedDocumentResponse[]> {
  return apiJson<ResolvedDocumentResponse[]>(
    `/api/vault/${targetType}/${targetId}/documents`,
    { method: "GET", signal }
  )
}

export async function getRoleResolvedDocuments(
  roleId: string,
  signal?: AbortSignal
): Promise<ResolvedDocumentSetResponse> {
  return apiJson<ResolvedDocumentSetResponse>(
    `/api/vault/roles/${roleId}/documents`,
    { method: "GET", signal }
  )
}

export async function assignDocument(
  body: AssignDocumentRequest,
  signal?: AbortSignal
): Promise<void> {
  const res = await apiFetch("/api/vault/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    const message =
      typeof parsed === "string" && parsed.length > 0
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            "detail" in parsed &&
            typeof (parsed as { detail?: string }).detail === "string"
          ? (parsed as { detail: string }).detail
          : parsed &&
              typeof parsed === "object" &&
              "message" in parsed &&
              typeof (parsed as { message?: string }).message === "string"
            ? (parsed as { message: string }).message
            : `Assign failed (${res.status})`
    throw new ApiError(message, res.status, parsed)
  }
}
