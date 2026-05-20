import type {
  DepartmentResponse,
  OrganizationLevelResponse,
  RoleResponse,
} from "./types"

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "")
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return asString(value)
}

export function normalizeRole(raw: Record<string, unknown>): RoleResponse {
  const departmentsRaw = raw.departments ?? raw.Departments
  const departments = Array.isArray(departmentsRaw)
    ? departmentsRaw.map((d) =>
        normalizeDepartment(d as Record<string, unknown>)
      )
    : []

  return {
    id: asString(raw.id ?? raw.Id),
    name: asString(raw.name ?? raw.Name),
    description: asNullableString(raw.description ?? raw.Description),
    status: asString(raw.status ?? raw.Status),
    amlRisk: asString(raw.amlRisk ?? raw.AmlRisk ?? "Medium"),
    sanctionsRisk: asString(raw.sanctionsRisk ?? raw.SanctionsRisk ?? "Medium"),
    fraudRisk: asString(raw.fraudRisk ?? raw.FraudRisk ?? "Medium"),
    documentationRisk: asString(
      raw.documentationRisk ?? raw.DocumentationRisk ?? "Medium"
    ),
    operationalRisk: asString(
      raw.operationalRisk ?? raw.OperationalRisk ?? "Medium"
    ),
    departments,
  }
}

export function normalizeDepartment(
  raw: Record<string, unknown>
): DepartmentResponse {
  const orgLevelsRaw = raw.organizationLevels ?? raw.OrganizationLevels
  const rolesRaw = raw.roles ?? raw.Roles

  return {
    id: asString(raw.id ?? raw.Id),
    name: asString(raw.name ?? raw.Name),
    description: asNullableString(raw.description ?? raw.Description),
    organizationLevels: Array.isArray(orgLevelsRaw)
      ? orgLevelsRaw.map((o) =>
          normalizeOrganizationLevel(o as Record<string, unknown>)
        )
      : [],
    roles: Array.isArray(rolesRaw)
      ? rolesRaw.map((r) => normalizeRole(r as Record<string, unknown>))
      : [],
  }
}

export function normalizeOrganizationLevel(
  raw: Record<string, unknown>
): OrganizationLevelResponse {
  const departmentsRaw = raw.departments ?? raw.Departments

  return {
    id: asString(raw.id ?? raw.Id),
    name: asString(raw.name ?? raw.Name),
    description: asNullableString(raw.description ?? raw.Description),
    geography: asNullableString(raw.geography ?? raw.Geography),
    createdAt: asString(raw.createdAt ?? raw.CreatedAt),
    departments: Array.isArray(departmentsRaw)
      ? departmentsRaw.map((d) =>
          normalizeDepartment(d as Record<string, unknown>)
        )
      : [],
  }
}

export function normalizeHierarchy(
  data: unknown
): OrganizationLevelResponse[] {
  if (!Array.isArray(data)) return []
  return data.map((item) =>
    normalizeOrganizationLevel(item as Record<string, unknown>)
  )
}
