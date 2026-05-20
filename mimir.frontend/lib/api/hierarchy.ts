import { apiJson } from "./client"
import {
  normalizeDepartment,
  normalizeHierarchy,
  normalizeOrganizationLevel,
  normalizeRole,
} from "./hierarchy-normalize"
import type {
  CreateDepartmentRequest,
  CreateOrganizationLevelRequest,
  CreateRoleRequest,
  DepartmentResponse,
  OrganizationLevelResponse,
  RoleResponse,
} from "./types"

export async function getHierarchy(
  signal?: AbortSignal
): Promise<OrganizationLevelResponse[]> {
  const data = await apiJson<unknown>("/api/hierarchy", {
    method: "GET",
    signal,
  })
  return normalizeHierarchy(data)
}

export async function createOrganizationLevel(
  body: CreateOrganizationLevelRequest,
  signal?: AbortSignal
): Promise<OrganizationLevelResponse> {
  const data = await apiJson<unknown>("/api/hierarchy/organization-levels", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  })
  return normalizeOrganizationLevel(data as Record<string, unknown>)
}

export async function createDepartment(
  body: CreateDepartmentRequest,
  signal?: AbortSignal
): Promise<DepartmentResponse> {
  const data = await apiJson<unknown>("/api/hierarchy/departments", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  })
  return normalizeDepartment(data as Record<string, unknown>)
}

export async function createRole(
  body: CreateRoleRequest,
  signal?: AbortSignal
): Promise<RoleResponse> {
  const data = await apiJson<unknown>("/api/hierarchy/roles", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  })
  return normalizeRole(data as Record<string, unknown>)
}

export async function publishRole(
  roleId: string,
  signal?: AbortSignal
): Promise<RoleResponse> {
  const data = await apiJson<unknown>(`/api/hierarchy/roles/${roleId}/publish`, {
    method: "POST",
    signal,
  })
  return normalizeRole(data as Record<string, unknown>)
}
