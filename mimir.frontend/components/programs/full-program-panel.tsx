"use client"

import Link from "next/link"
import { FullProgramView } from "./full-program-view"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/api/error-message"
import { useRoleTrainingStatus, useRoleTrainingOutline } from "@/lib/api/hooks/use-training"
import {
  useFullProgramStatus,
  useFullProgram,
  useGenerateFullProgramMutation,
  useDownloadScormMutation,
} from "@/lib/api/hooks/use-full-program"

type FullProgramPanelProps = {
  roleId: string
}

export function FullProgramPanel({ roleId }: FullProgramPanelProps) {
  const outlineStatusQuery = useRoleTrainingStatus(roleId)
  const outlineStatus = outlineStatusQuery.data?.status ?? "Pending"
  const isOutlineReady = outlineStatus === "Ready"

  const outlineQuery = useRoleTrainingOutline(roleId, isOutlineReady)
  const outline = outlineQuery.data

  // The outline response doesn't include approval status, so we assume it's approved if it's ready.
  // If the outline isn't actually approved, the backend will return a 409 when we try to generate.
  const isOutlineApproved = isOutlineReady && outline !== null

  const programStatusQuery = useFullProgramStatus(roleId)
  const programStatus = programStatusQuery.data?.status ?? "not started"
  const isProgramReady = programStatus === "Ready"

  const programQuery = useFullProgram(roleId, isProgramReady)
  const program = programQuery.data

  const generateMutation = useGenerateFullProgramMutation(roleId)
  const downloadMutation = useDownloadScormMutation(roleId, outline?.roleName ?? "training")

  const generateError = generateMutation.isError
    ? getErrorMessage(generateMutation.error, "Generation failed.")
    : null

  const downloadError = downloadMutation.isError
    ? getErrorMessage(downloadMutation.error, "Download failed.")
    : null

  const isBusy =
    generateMutation.isPending ||
    downloadMutation.isPending ||
    programStatusQuery.isPending

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      {/* Section 1: Outline Status */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Training outline</h2>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              outlineStatus === "Pending"
                ? "bg-muted text-muted-foreground"
                : outlineStatus === "Generating"
                  ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 animate-pulse"
                  : outlineStatus === "Ready"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
            }`}
          >
            {outlineStatus === "Ready" ? (isOutlineApproved ? "Approved" : "Draft") : outlineStatus}
          </span>
        </div>

        {isOutlineApproved ? (
          <p className="text-muted-foreground text-sm">
            Outline is approved. Proceed to full program generation.
          </p>
        ) : (
          <div className="space-y-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4">
            <p className="text-yellow-900 dark:text-yellow-200 text-sm">
              The training outline must be approved before generating a full program. Go to{" "}
              <Link href="/hierarchy" className="font-semibold hover:underline">
                Hierarchy
              </Link>
              {" "}to approve the outline for this role.
            </p>
          </div>
        )}
      </section>

      {/* Section 2: Full Program */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Full program</h2>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              programStatus === "Generating"
                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 animate-pulse"
                : programStatus === "Ready"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : programStatus === "Failed"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {programStatus === "not started" ? "Not started" : programStatus}
          </span>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed">
          Generate a full training program with lesson content, quizzes, and scenarios for this role. The process takes 2–5 minutes.
        </p>

        <Button
          disabled={
            isBusy ||
            !isOutlineApproved ||
            programStatus === "Generating"
          }
          onClick={() => generateMutation.mutate()}
        >
          {programStatus === "Generating" || generateMutation.isPending
            ? "Generating…"
            : "Generate full program"}
        </Button>

        {programStatus === "Generating" ? (
          <p className="text-muted-foreground text-sm">
            Polling for updates every 4 seconds — this takes 2–5 minutes.
          </p>
        ) : null}

        {generateError ? (
          <p className="text-destructive text-sm" role="alert">
            {generateError}
          </p>
        ) : null}

        {programStatus === "Failed" && programStatusQuery.data?.errorMessage ? (
          <p className="text-destructive text-sm" role="alert">
            {programStatusQuery.data.errorMessage}
          </p>
        ) : null}

        {isProgramReady && program ? (
          <>
            {program.modules.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed border-border px-3 py-2 text-sm">
                No modules in this program — the vault may be empty or the outline had no sections.
              </p>
            ) : (
              <>
                <FullProgramView program={program} />

                <div className="flex gap-2">
                  <Button
                    disabled={downloadMutation.isPending}
                    onClick={() => downloadMutation.mutate()}
                  >
                    {downloadMutation.isPending ? "Downloading…" : "Download SCORM"}
                  </Button>
                </div>

                {downloadError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {downloadError}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </section>
    </div>
  )
}
