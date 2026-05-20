"use client"

import { DocumentOutlineView } from "@/components/document-outline-view"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/api/error-message"
import {
  useRoleTrainingStatus,
  useRoleTrainingOutline,
  useGenerateRoleOutlineMutation,
  useApproveRoleOutlineMutation,
} from "@/lib/api/hooks/use-training"

type RoleTrainingPanelProps = {
  roleId: string
}

export function RoleTrainingPanel({ roleId }: RoleTrainingPanelProps) {
  const statusQuery = useRoleTrainingStatus(roleId)
  const generateMutation = useGenerateRoleOutlineMutation(roleId)
  const status = statusQuery.data

  const isReady = status?.status === "Ready"
  const outlineQuery = useRoleTrainingOutline(roleId, isReady)
  const outline = outlineQuery.data

  const approveMutation = useApproveRoleOutlineMutation(roleId)
  const isApproved = outline?.status === "Approved"
  const isEmpty = isReady && outline && outline.sections.length === 0

  const isGenerateBusy = generateMutation.isPending || statusQuery.isPending
  const statusBadge = status?.status ?? "Pending"

  const generateError = generateMutation.isError
    ? getErrorMessage(generateMutation.error, "Training generation failed.")
    : null

  const approveError = approveMutation.isError
    ? getErrorMessage(approveMutation.error, "Approval failed.")
    : null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Training outline</h3>
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
            statusBadge === "Pending"
              ? "bg-muted text-muted-foreground"
              : statusBadge === "Generating"
                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 animate-pulse"
                : statusBadge === "Ready"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : statusBadge === "Failed"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
          }`}
        >
          {statusBadge}
        </span>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Generate a role-specific training outline from assigned documents,
        calibrated to this role's risk profile.
      </p>

      <Button
        type="button"
        disabled={
          isGenerateBusy ||
          approveMutation.isPending ||
          statusBadge === "Generating"
        }
        onClick={() => generateMutation.mutate()}
      >
        {isGenerateBusy || statusBadge === "Generating"
          ? "Generating…"
          : "Generate outline"}
      </Button>

      {statusBadge === "Generating" ? (
        <p className="text-muted-foreground text-sm">
          Polling for updates every 2 seconds…
        </p>
      ) : null}

      {generateError ? (
        <p className="text-destructive text-sm" role="alert">
          {generateError}
        </p>
      ) : null}

      {statusBadge === "Failed" && status?.errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {status.errorMessage}
        </p>
      ) : null}

      {isEmpty ? (
        <p className="text-muted-foreground rounded-md border border-dashed border-border px-3 py-2 text-sm">
          Vault is empty — assign regulation documents to this role first.
        </p>
      ) : null}

      {isReady && outline && !isEmpty ? (
        <>
          <DocumentOutlineView outline={outline} />

          {!isApproved ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isGenerateBusy || approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? "Approving…" : "Approve outline"}
            </Button>
          ) : (
            <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Outline approved
            </span>
          )}

          {approveError ? (
            <p className="text-destructive text-sm" role="alert">
              {approveError}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
