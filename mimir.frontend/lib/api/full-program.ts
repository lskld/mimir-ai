import { apiFetch, apiJson, ApiError } from "./client"
import type {
  FullProgramStatusResponse,
  FullTrainingProgramResponse,
} from "./types"

function parseBody(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return trimmed
  }
}

export async function generateFullProgram(
  roleId: string,
  signal?: AbortSignal
): Promise<{ status: string; roleId: string; errorMessage: string | null }> {
  const res = await apiFetch(
    `/api/training/roles/${roleId}/full-program/generate`,
    {
      method: "POST",
      signal,
    }
  )

  const text = await res.text()
  const json = parseBody(text) as
    | {
        status?: string
        roleId?: string
        errorMessage?: string | null
      }
    | string
    | null

  if (!res.ok) {
    const message =
      typeof json === "string"
        ? json
        : json &&
            typeof json === "object" &&
            "detail" in json &&
            typeof (json as { detail?: string }).detail === "string"
          ? (json as { detail: string }).detail
          : `Full program generation failed (${res.status})`
    throw new ApiError(message, res.status, json)
  }

  return {
    status:
      typeof json === "object" && json !== null && "status" in json
        ? ((json as { status?: string }).status ?? "Generating")
        : "Generating",
    roleId:
      typeof json === "object" && json !== null && "roleId" in json
        ? ((json as { roleId?: string }).roleId ?? roleId)
        : roleId,
    errorMessage:
      typeof json === "object" && json !== null && "errorMessage" in json
        ? ((json as { errorMessage?: string | null }).errorMessage ?? null)
        : null,
  }
}

export async function getFullProgramStatus(
  roleId: string,
  signal?: AbortSignal
): Promise<FullProgramStatusResponse> {
  return apiJson<FullProgramStatusResponse>(
    `/api/training/roles/${roleId}/full-program/status`,
    { method: "GET", signal }
  )
}

/** Returns program on success, `null` if not ready (409 or 404). */
export async function getFullProgram(
  roleId: string,
  signal?: AbortSignal
): Promise<FullTrainingProgramResponse | null> {
  const res = await apiFetch(`/api/training/roles/${roleId}/full-program`, {
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
        : `Program fetch failed (${res.status})`
    throw new ApiError(message, res.status, body)
  }

  return body as FullTrainingProgramResponse
}

/** Triggers SCORM download. Reads filename from Content-Disposition header. */
export async function downloadScorm(
  roleId: string,
  roleName: string,
  signal?: AbortSignal
): Promise<void> {
  const res = await apiFetch(
    `/api/training/roles/${roleId}/full-program/export/scorm`,
    { method: "GET", signal }
  )

  if (!res.ok) {
    const text = await res.text()
    const body = parseBody(text)
    const message =
      typeof body === "string"
        ? body
        : body &&
            typeof body === "object" &&
            "detail" in body &&
            typeof (body as { detail?: string }).detail === "string"
          ? (body as { detail: string }).detail
          : `SCORM download failed (${res.status})`
    throw new ApiError(message, res.status, body)
  }

  const blob = await res.blob()

  // Extract filename from Content-Disposition header
  const disposition = res.headers.get("content-disposition")
  const filename =
    disposition?.match(/filename="([^"]+)"/)?.[1] ??
    `training-course-${roleName.toLowerCase().replace(/\s+/g, "-")}.zip`

  // Trigger browser download
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
