import { apiFetch, apiJson, ApiError } from "./client"
import type { RoleTrainingStatusResponse, TrainingOutlineResponse } from "./types"

function parseBody(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return trimmed
  }
}

export async function generateRoleOutline(
  roleId: string,
  signal?: AbortSignal
): Promise<{ roleId: string; status: string; message: string }> {
  const res = await apiFetch(`/api/training/roles/${roleId}/generate`, {
    method: "POST",
    signal,
  })

  const text = await res.text()
  const json = parseBody(text) as
    | { roleId?: string; status?: string; message?: string }
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
          : `Training generation failed (${res.status})`
    throw new ApiError(message, res.status, json)
  }

  return {
    roleId:
      (typeof json === "object" &&
        json !== null &&
        "roleId" in json &&
        typeof (json as { roleId?: string }).roleId === "string"
        ? (json as { roleId: string }).roleId
        : roleId),
    status:
      (typeof json === "object" &&
        json !== null &&
        "status" in json &&
        typeof (json as { status?: string }).status === "string"
        ? (json as { status: string }).status
        : "Generating"),
    message:
      (typeof json === "object" &&
        json !== null &&
        "message" in json &&
        typeof (json as { message?: string }).message === "string"
        ? (json as { message: string }).message
        : "Training generation started"),
  }
}

export async function getRoleTrainingStatus(
  roleId: string,
  signal?: AbortSignal
): Promise<RoleTrainingStatusResponse> {
  return apiJson<RoleTrainingStatusResponse>(
    `/api/training/roles/${roleId}/status`,
    { method: "GET", signal }
  )
}

/** Returns outline on success, `null` if not ready (409), `null` if still in progress (409). */
export async function getRoleTrainingOutline(
  roleId: string,
  signal?: AbortSignal
): Promise<TrainingOutlineResponse | null> {
  const res = await apiFetch(`/api/training/roles/${roleId}/outline`, {
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

export async function approveRoleOutline(
  roleId: string,
  signal?: AbortSignal
): Promise<TrainingOutlineResponse> {
  const res = await apiFetch(`/api/training/roles/${roleId}/approve`, {
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

  throw new ApiError("Approve failed: invalid response shape", res.status, body)
}
