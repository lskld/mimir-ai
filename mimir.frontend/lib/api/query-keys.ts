export const queryKeys = {
  documents: {
    all: ["documents"] as const,
    detail: (documentId: string) =>
      [...queryKeys.documents.all, documentId] as const,
  },
  outlines: {
    all: ["outlines"] as const,
    detail: (documentId: string) =>
      [...queryKeys.outlines.all, documentId] as const,
  },
}
