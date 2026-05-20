"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  assignDocument,
  getRoleResolvedDocuments,
  getTargetDocuments,
} from "@/lib/api/vault"
import { fetchVaultCatalog } from "@/lib/api/vault-utils"
import type { AssignDocumentRequest, VaultTarget } from "@/lib/api/types"
import { queryKeys } from "@/lib/api/query-keys"

export function useVaultCatalog() {
  return useQuery({
    queryKey: queryKeys.vault.catalog(),
    queryFn: ({ signal }) => fetchVaultCatalog(signal),
  })
}

export function useTargetDocuments(target: VaultTarget | null) {
  return useQuery({
    queryKey: queryKeys.vault.target(
      target?.type ?? "",
      target?.id ?? ""
    ),
    queryFn: ({ signal }) =>
      getTargetDocuments(target!.type, target!.id, signal),
    enabled: Boolean(target),
  })
}

export function useRoleResolvedDocuments(roleId: string | null) {
  return useQuery({
    queryKey: queryKeys.vault.roleResolved(roleId ?? ""),
    queryFn: ({ signal }) => getRoleResolvedDocuments(roleId!, signal),
    enabled: Boolean(roleId),
  })
}

export function useAssignDocumentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AssignDocumentRequest) => assignDocument(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vault.all })
    },
  })
}
