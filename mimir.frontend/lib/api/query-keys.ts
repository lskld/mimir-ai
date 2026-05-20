export const queryKeys = {
  documents: {
    all: ["documents"] as const,
    list: () => [...queryKeys.documents.all, "list"] as const,
    detail: (documentId: string) =>
      [...queryKeys.documents.all, documentId] as const,
  },
  outlines: {
    all: ["outlines"] as const,
    detail: (documentId: string) =>
      [...queryKeys.outlines.all, documentId] as const,
  },
  training: {
    all: ["training"] as const,
    status: (roleId: string) =>
      [...queryKeys.training.all, roleId, "status"] as const,
    outline: (roleId: string) =>
      [...queryKeys.training.all, roleId, "outline"] as const,
  },
  hierarchy: {
    all: ["hierarchy"] as const,
  },
  vault: {
    all: ["vault"] as const,
    catalog: () => [...queryKeys.vault.all, "catalog"] as const,
    target: (targetType: string, targetId: string) =>
      [...queryKeys.vault.all, "target", targetType, targetId] as const,
    roleResolved: (roleId: string) =>
      [...queryKeys.vault.all, "role-resolved", roleId] as const,
  },
}
