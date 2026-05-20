"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Download, Eye, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/mimir/status-badge"
import { ProgramDetailDialog } from "@/components/programs/program-detail-dialog"
import { useHierarchy } from "@/lib/api/hooks/use-hierarchy"
import { useFullProgramStatuses } from "@/lib/api/hooks/use-program-statuses"
import { useDownloadScormMutation } from "@/lib/api/hooks/use-full-program"
import { buildRoleOptions, type RoleOption } from "@/components/training/role-selector"
import { useToast } from "@/components/providers/toast-provider"
import { getErrorMessage } from "@/lib/api/error-message"
import { cn } from "@/lib/utils"

export default function ProgramsPage() {
  const hierarchyQuery = useHierarchy()
  const roles = buildRoleOptions(hierarchyQuery.data ?? [])
  const statuses = useFullProgramStatuses(roles.map((r) => r.id))

  const [viewing, setViewing] = useState<RoleOption | null>(null)

  // Roles that have an attempted program (Ready, Generating, or Failed).
  const programs = roles
    .map((role) => ({ role, status: statuses.byRole[role.id] }))
    .filter((p) => p.status !== null && p.status !== undefined)

  const isPending = hierarchyQuery.isPending || statuses.isPending

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Programs</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/training">
            <Workflow className="size-3.5" />
            Open training pipeline
          </Link>
        </Button>
      </header>

      {isPending ? (
        <GridSkeleton />
      ) : programs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <ProgramCard
              key={p.role.id}
              role={p.role}
              status={p.status!.status}
              errorMessage={p.status!.errorMessage}
              onView={() => setViewing(p.role)}
            />
          ))}
        </div>
      )}

      {viewing ? (
        <ProgramDetailDialog
          open
          roleId={viewing.id}
          roleName={viewing.name}
          onOpenChange={(open) => {
            if (!open) setViewing(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ProgramCard({
  role,
  status,
  errorMessage,
  onView,
}: {
  role: RoleOption
  status: string
  errorMessage: string | null
  onView: () => void
}) {
  const download = useDownloadScormMutation(role.id, role.name)
  const { toast } = useToast()
  const isReady = status === "Ready"

  return (
    <div
      className={cn(
        "group/program flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-accent",
        isReady && "hover:border-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <StatusBadge status={status} />
      </div>
      <div className="space-y-0.5">
        <p className="font-heading text-base font-semibold leading-tight">
          {role.name}
        </p>
        <p className="text-xs text-muted-foreground">{role.departmentName} · {role.orgName}</p>
      </div>
      {status === "Failed" && errorMessage ? (
        <p className="line-clamp-2 text-xs text-destructive">{errorMessage}</p>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onView}
          disabled={!isReady}
          className="flex-1"
        >
          <Eye className="size-3.5" />
          View
        </Button>
        <Button
          size="sm"
          disabled={!isReady || download.isPending}
          onClick={() =>
            download.mutate(undefined, {
              onSuccess: () =>
                toast({
                  title: "SCORM exported",
                  description: "Your download has started.",
                  variant: "success",
                }),
              onError: (err) =>
                toast({
                  title: "Export failed",
                  description: getErrorMessage(err, "Could not export SCORM."),
                  variant: "error",
                }),
            })
          }
        >
          <Download className="size-3.5" />
          SCORM
        </Button>
      </div>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">No programs generated yet.</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/training">
          Open training pipeline
          <ArrowUpRight className="size-4" />
        </Link>
      </Button>
    </div>
  )
}
