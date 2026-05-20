"use client"

import { useState } from "react"
import { BookOpen, CheckCircle2, Download, FileText, HelpCircle, Loader2, Quote } from "lucide-react"
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
import {
  useDownloadScormMutation,
  useFullProgram,
} from "@/lib/api/hooks/use-full-program"
import { useRoleTrainingOutline } from "@/lib/api/hooks/use-training"
import { useToast } from "@/components/providers/toast-provider"
import { getErrorMessage } from "@/lib/api/error-message"
import { cn } from "@/lib/utils"
import type {
  CitationResponse,
  FullTrainingModuleResponse,
  OutlineSectionResponse,
  QuizQuestionResponse,
  ScenarioResponse,
} from "@/lib/api/types"

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

  // Fetch the approved outline to get citations (outline must be Approved since program is Ready).
  const outlineQuery = useRoleTrainingOutline(roleId, open)
  const outline = outlineQuery.data ?? null

  const download = useDownloadScormMutation(roleId, roleName)
  const { toast } = useToast()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(1100px,calc(100vw-2rem))] max-w-none overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>{roleName}</DialogTitle>
              <DialogDescription>
                Full training program — lessons, quizzes, case studies, and regulatory grounding
              </DialogDescription>
            </div>
            {program ? <StatusBadge status="Ready" /> : null}
          </div>
        </DialogHeader>

        <div className="max-h-[74vh] overflow-y-auto px-6 py-5">
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
            <p className="text-sm text-muted-foreground">No program available for this role.</p>
          ) : (
            <div className="space-y-6">
              {/* Program header */}
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
                <Badge variant="primary">{program.regulationType}</Badge>
                <Badge variant="secondary">{program.modules.length} modules</Badge>
                <Badge variant="muted">
                  {program.modules.reduce((n, m) => n + m.objectives.length, 0)} objectives
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  Generated{" "}
                  {new Date(program.generatedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>

              {/* Modules */}
              <ol className="space-y-8">
                {program.modules.map((mod, idx) => (
                  <ModuleSection
                    key={`${mod.moduleTitle}-${idx}`}
                    module={mod}
                    index={idx}
                    outlineSection={outline?.sections?.[idx] ?? null}
                  />
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

function ModuleSection({
  module: mod,
  index,
  outlineSection,
}: {
  module: FullTrainingModuleResponse
  index: number
  outlineSection: OutlineSectionResponse | null
}) {
  return (
    <li className="space-y-4 rounded-xl border border-border bg-card">
      {/* Module header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Module {index + 1}
          </p>
          <h3 className="font-heading text-base font-semibold leading-tight">
            {mod.moduleTitle}
          </h3>
          {mod.description ? (
            <p className="text-sm text-muted-foreground leading-relaxed pt-1">
              {mod.description}
            </p>
          ) : null}
        </div>
        {mod.amlrArticle ? (
          <Badge variant="outline" size="sm" className="shrink-0">
            Article {mod.amlrArticle}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-5 px-5 pb-5">
        {/* Objectives with lesson content + quiz */}
        {mod.objectives.length > 0 ? (
          <section className="space-y-4">
            <SectionLabel icon={BookOpen} label="Learning objectives" />
            <ol className="space-y-5">
              {mod.objectives.map((obj, oi) => (
                <ObjectiveBlock key={`${obj.objective}-${oi}`} objective={obj} index={oi} />
              ))}
            </ol>
          </section>
        ) : null}

        {/* Scenarios */}
        {mod.scenarios.length > 0 ? (
          <section className="space-y-3">
            <SectionLabel icon={FileText} label="Case studies" />
            <div className="space-y-3">
              {mod.scenarios.map((s, si) => (
                <ScenarioBlock key={`${s.title}-${si}`} scenario={s} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Regulatory grounding / citations */}
        {outlineSection && outlineSection.citations.length > 0 ? (
          <section className="space-y-3">
            <SectionLabel icon={Quote} label="Regulatory grounding" />
            <CitationsBlock
              citations={outlineSection.citations}
              regulatoryBasis={outlineSection.regulatoryBasis}
            />
          </section>
        ) : null}
      </div>
    </li>
  )
}

function SectionLabel({ icon: Icon, label }: { icon: typeof BookOpen; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function ObjectiveBlock({
  objective: obj,
  index,
}: {
  objective: { objective: string; lessonContent: string; quizQuestions: QuizQuestionResponse[] }
  index: number
}) {
  const [showQuiz, setShowQuiz] = useState(false)

  return (
    <li className="rounded-lg border border-border bg-surface">
      {/* Objective + lesson */}
      <div className="space-y-2 px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Objective {index + 1}
        </p>
        <p className="text-sm font-semibold leading-snug">{obj.objective}</p>
        {obj.lessonContent ? (
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {obj.lessonContent}
          </p>
        ) : null}
      </div>

      {/* Quiz toggle */}
      {obj.quizQuestions.length > 0 ? (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowQuiz((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-primary hover:bg-surface-elevated transition-colors"
          >
            <HelpCircle className="size-3.5" />
            {showQuiz ? "Hide" : "Show"} quiz ({obj.quizQuestions.length}{" "}
            {obj.quizQuestions.length === 1 ? "question" : "questions"})
          </button>
          {showQuiz ? (
            <div className="space-y-4 border-t border-border px-4 py-3">
              {obj.quizQuestions.map((q, qi) => (
                <QuizBlock key={`q-${qi}`} question={q} index={qi} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function QuizBlock({ question: q, index }: { question: QuizQuestionResponse; index: number }) {
  const options = (["A", "B", "C", "D"] as const).filter((k) => q.options[k])

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Q{index + 1}
      </p>
      <p className="text-sm font-medium">{q.text}</p>
      <ul className="space-y-1">
        {options.map((letter) => {
          const isCorrect = q.correctAnswer?.toUpperCase().startsWith(letter)
          return (
            <li
              key={letter}
              className={cn(
                "flex items-start gap-2 rounded-md px-3 py-1.5 text-sm",
                isCorrect
                  ? "bg-success/10 text-success font-medium"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5",
                  isCorrect
                    ? "bg-success text-white"
                    : "bg-border text-muted-foreground"
                )}
              >
                {letter}
              </span>
              {q.options[letter]}
              {isCorrect ? <CheckCircle2 className="ml-auto size-3.5 shrink-0 mt-0.5" /> : null}
            </li>
          )
        })}
      </ul>
      {q.explanation ? (
        <p className="rounded-md bg-blue-subtle/20 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Explanation: </span>
          {q.explanation}
        </p>
      ) : null}
    </div>
  )
}

function ScenarioBlock({ scenario: s }: { scenario: ScenarioResponse }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 space-y-2">
      <p className="text-sm font-semibold">{s.title}</p>
      {s.description ? (
        <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
      ) : null}
      {s.complication ? (
        <div className="rounded-md border border-warning/30 bg-warning/8 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-warning mb-1">
            Complication
          </p>
          <p className="text-xs text-foreground/80 leading-relaxed">{s.complication}</p>
        </div>
      ) : null}
      {s.discussionQuestions.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Discussion questions
          </p>
          <ul className="space-y-1">
            {s.discussionQuestions.map((dq, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-primary font-bold">{i + 1}.</span>
                {dq}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function CitationsBlock({
  citations,
  regulatoryBasis,
}: {
  citations: CitationResponse[]
  regulatoryBasis: { amlrArticle: string; articleTitle: string } | null
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 space-y-3">
      {regulatoryBasis ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" size="sm">Article {regulatoryBasis.amlrArticle}</Badge>
          {regulatoryBasis.articleTitle ? (
            <span className="text-xs text-muted-foreground">{regulatoryBasis.articleTitle}</span>
          ) : null}
        </div>
      ) : null}
      <ul className="space-y-2">
        {citations.map((c, i) => (
          <li key={c.chunkId || i} className="border-l-2 border-primary/40 pl-3 space-y-0.5">
            <p className="text-xs text-foreground/90 leading-relaxed italic">
              &ldquo;{c.text}&rdquo;
            </p>
            <p className="text-[11px] text-muted-foreground">
              {c.sourceDocument}
              {c.pageNumber ? ` · p.${c.pageNumber}` : ""}
              {c.section ? ` · ${c.section}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
