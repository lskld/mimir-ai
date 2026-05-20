import { getHierarchy } from "./hierarchy"
import { getTargetDocuments } from "./vault"
import type {
  OrganizationLevelResponse,
  VaultCatalogAssignment,
  VaultCatalogDocument,
  VaultTarget,
  VaultTargetType,
} from "./types"

export function flattenHierarchyTargets(
  orgs: OrganizationLevelResponse[]
): VaultTarget[] {
  const targets: VaultTarget[] = []
  const seen = new Set<string>()

  const add = (t: VaultTarget) => {
    const key = `${t.type}-${t.id}`
    if (seen.has(key)) return
    seen.add(key)
    targets.push(t)
  }

  for (const org of orgs) {
    add({ type: "OrganizationLevel", id: org.id, name: org.name, path: org.name })

    for (const dept of org.departments ?? []) {
      add({
        type: "Department",
        id: dept.id,
        name: dept.name,
        path: `${org.name} / ${dept.name}`,
      })

      for (const role of dept.roles ?? []) {
        add({
          type: "Role",
          id: role.id,
          name: role.name,
          path: `${org.name} / ${dept.name} / ${role.name}`,
        })
      }
    }
  }

  return targets
}

export async function fetchVaultCatalog(
  signal?: AbortSignal
): Promise<VaultCatalogDocument[]> {
  const hierarchy = await getHierarchy(signal)
  const targets = flattenHierarchyTargets(hierarchy)

  if (targets.length === 0) {
    return []
  }

  const byTarget = await Promise.all(
    targets.map(async (target) => {
      const docs = await getTargetDocuments(target.type, target.id, signal)
      return { target, docs }
    })
  )

  const map = new Map<string, VaultCatalogDocument>()

  for (const { target, docs } of byTarget) {
    for (const doc of docs) {
      const assignment: VaultCatalogAssignment = {
        targetType: target.type,
        targetId: target.id,
        targetPath: target.path,
      }

      const existing = map.get(doc.documentId)
      if (existing) {
        existing.assignments.push(assignment)
      } else {
        map.set(doc.documentId, {
          documentId: doc.documentId,
          fileName: doc.fileName,
          assignments: [assignment],
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.fileName.localeCompare(b.fileName)
  )
}

export function formatTargetType(type: VaultTargetType | string): string {
  switch (type) {
    case "OrganizationLevel":
      return "Organization"
    case "Department":
      return "Department"
    case "Role":
      return "Role"
    default:
      return type
  }
}

export function formatInheritedFrom(value: string): string {
  switch (value) {
    case "OrganizationLevel":
      return "Organization"
    case "Department":
      return "Department"
    case "Role":
      return "Role"
    default:
      return value
  }
}
