"use client"

import { Download, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/mimir/status-badge"
import { RiskBadge } from "@/components/mimir/risk-badge"
import {
  useDownloadScormMutation,
  useFullProgram,
} from "@/lib/api/hooks/use-full-program"
import { useToast } from "@/components/providers/toast-provider"
import { getErrorMessage } from "@/lib/api/error-message"

type ProgramDetailDialogProps = {
  open: boolean
  roleId: string
  roleName: string
  onOpenChange: (open: boolean) => void
}

export function ProgramDetailDialog({
  open,
  roleId,
  roleName,
  onOpenChange,
}: ProgramDetailDialogProps) {
  const programQuery = useFullProgram(roleId, open)
  const program = programQuery.data ?? null
  const download = useDownloadScormMutation(roleId, roleName)
  const { toast } = useToast()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[min(960px,calc(100vw-2rem))] max-w-none overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>{roleName}</DialogTitle>
              <DialogDescription>
                Full training program — lessons, quizzes, and case studies
              </DialogDescription>
            </div>
            {program ? <StatusBadge status="Ready" /> : null}
          </div>
        </DialogHeader>

        <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
          {programQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading program…
            </div>
          ) : programQuery.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {getErrorMessage(programQuery.error, "Failed to load program.")}
            </p>
          ) : !program ? (
            <p className="text-sm text-muted-foreground">
              No program available for this role.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
                <Badge variant="primary">{program.regulationType}</Badge>
                <Badge variant="secondary">{program.modules.length} modules</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  Generated{" "}
                  {new Date(program.generatedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>

              {program.riskProfile ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(program.riskProfile).map(([k, v]) => (
                    <RiskBadge key={k} type={k} risk={v} />
                  ))}
                </div>
              ) : null}

              <ol className="space-y-3">
                {program.modules.map((mod, idx) => (
                  <li
                    key={`${mod.moduleTitle}-${idx}`}
                    className="rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                          Module {idx + 1}
                        </p>
                        <h3 className="font-heading text-sm font-semibold leading-tight">
                          {mod.moduleTitle}
                        </h3>
                      </div>
                      {mod.amlrArticle ? (
                        <Badge variant="outline" size="sm">
                          Article {mod.amlrArticle}
                        </Badge>
                      ) : null}
                    </div>
                    {mod.description ? (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        {mod.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="muted" size="sm">
                        {mod.objectives.length} objectives
                      </Badge>
                      <Badge variant="muted" size="sm">
                        {mod.objectives.reduce((n, o) => n + o.quizQuestions.length, 0)} questions
                      </Badge>
                      <Badge variant="muted" size="sm">
                        {mod.scenarios.length} scenarios
                      </Badge>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border bg-surface px-6 py-3">
          <span className="text-xs text-muted-foreground">
            SCORM 1.2 — works in any standards-compliant LMS.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {program ? (
              <Button
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
                disabled={download.isPending}
              >
                {download.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Export SCORM
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
