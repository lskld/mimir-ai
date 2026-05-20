"use client"

import type { FullTrainingProgramResponse } from "@/lib/api/types"

type FullProgramViewProps = {
  program: FullTrainingProgramResponse
}

export function FullProgramView({ program }: FullProgramViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 border-b border-border pb-4">
        <h3 className="text-lg font-semibold">{program.roleName}</h3>
        <div className="flex flex-wrap gap-2">
          {program.riskProfile ? (
            Object.entries(program.riskProfile).map(([key, value]) => (
              <span
                key={key}
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  value === "High"
                    ? "bg-red-500/10 text-red-700 dark:text-red-400"
                    : value === "Medium"
                      ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                      : "bg-green-500/10 text-green-700 dark:text-green-400"
                }`}
              >
                {key}: {value}
              </span>
            ))
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          Generated: {new Date(program.generatedAt).toLocaleDateString()} at{" "}
          {new Date(program.generatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Modules */}
      <ol className="space-y-4">
        {program.modules.map((module, moduleIdx) => (
          <li key={moduleIdx} className="space-y-3">
            <details
              open
              className="group rounded-lg border border-border bg-muted/30 p-4"
            >
              <summary className="cursor-pointer font-semibold flex items-center justify-between">
                <span>
                  Module {moduleIdx + 1} — {module.moduleTitle}
                </span>
                {module.amlrArticle ? (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                    Article {module.amlrArticle}
                  </span>
                ) : null}
              </summary>

              <div className="mt-4 space-y-4">
                {module.description ? (
                  <p className="text-muted-foreground text-sm">
                    {module.description}
                  </p>
                ) : null}

                {/* Objectives */}
                <ol className="space-y-3 ml-2">
                  {module.objectives.map((objective, objIdx) => (
                    <li key={objIdx} className="space-y-2">
                      <div className="font-medium text-sm">
                        {objIdx + 1}. {objective.objective}
                      </div>

                      {objective.lessonContent ? (
                        <p className="text-muted-foreground text-sm whitespace-pre-wrap ml-2">
                          {objective.lessonContent}
                        </p>
                      ) : null}

                      {/* Quiz Questions */}
                      {objective.quizQuestions.length > 0 ? (
                        <div className="ml-2 mt-2 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">
                            Quiz Questions
                          </p>
                          <ul className="space-y-2">
                            {objective.quizQuestions.map((question, qIdx) => (
                              <li
                                key={qIdx}
                                className="text-sm border-l-2 border-primary/30 pl-2 space-y-1"
                              >
                                <p className="font-medium">{qIdx + 1}. {question.text}</p>
                                <ul className="space-y-0.5 ml-2 text-xs text-muted-foreground">
                                  {Object.entries(question.options).map(
                                    ([key, option]) => (
                                      <li
                                        key={key}
                                        className={
                                          key === question.correctAnswer
                                            ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                                            : ""
                                        }
                                      >
                                        <span className="font-mono font-semibold">
                                          {key}.
                                        </span>{" "}
                                        {option}
                                      </li>
                                    )
                                  )}
                                </ul>
                                <details className="mt-1">
                                  <summary className="text-xs text-primary cursor-pointer hover:underline">
                                    Explanation
                                  </summary>
                                  <p className="text-xs text-muted-foreground mt-1 pl-2">
                                    {question.explanation}
                                  </p>
                                </details>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>

                {/* Scenarios */}
                {module.scenarios.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      Case Studies
                    </p>
                    <ol className="space-y-2">
                      {module.scenarios.map((scenario, sIdx) => (
                        <li
                          key={sIdx}
                          className="border-l-2 border-amber-500/30 pl-3 text-sm space-y-1"
                        >
                          <p className="font-semibold">{sIdx + 1}. {scenario.title}</p>
                          <p className="text-muted-foreground">
                            <span className="text-xs font-semibold">Situation: </span>
                            {scenario.description}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="text-xs font-semibold">Decision point: </span>
                            {scenario.complication}
                          </p>
                          {scenario.discussionQuestions.length > 0 ? (
                            <details className="mt-2">
                              <summary className="text-xs text-primary cursor-pointer hover:underline">
                                Discussion questions ({scenario.discussionQuestions.length})
                              </summary>
                              <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-0.5 pl-1">
                                {scenario.discussionQuestions.map((q, qIdx) => (
                                  <li key={qIdx}>{q}</li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  )
}
