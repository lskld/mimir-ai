import type { TrainingOutlineResponse } from "@/lib/api/types"

export function DocumentOutlineView({
  outline,
}: {
  outline: TrainingOutlineResponse
}) {
  return (
    <div className="space-y-8">
      <header className="space-y-1 border-b border-border pb-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Training outline
        </p>
        <h2 className="text-lg font-semibold">
          {outline.regulationType}{" "}
          <span className="text-muted-foreground font-normal">
            · {outline.sections.length} sections
          </span>
        </h2>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <span>
            Generated{" "}
            {new Date(outline.generatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          {outline.status ? (
            <span
              className={
                outline.status === "Approved"
                  ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                  : "rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium"
              }
            >
              {outline.status}
            </span>
          ) : null}
        </div>
      </header>

      <ol className="space-y-10">
        {outline.sections.map((section, i) => (
          <li
            key={`${section.title}-${i}`}
            className="rounded-lg border border-border bg-card p-4 shadow-xs"
          >
            <p className="text-muted-foreground mb-1 text-xs font-medium">
              Module {i + 1}
            </p>
            <h3 className="text-base font-semibold">{section.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {section.description}
            </p>

            {section.regulatoryBasis ? (
              <p className="text-muted-foreground mt-3 text-sm">
                <span className="font-medium text-foreground">Basis: </span>
                Article {section.regulatoryBasis.amlrArticle}
                {section.regulatoryBasis.articleTitle
                  ? ` — ${section.regulatoryBasis.articleTitle}`
                  : null}
              </p>
            ) : null}

            {section.learningObjectives.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium tracking-wide uppercase">
                  Learning objectives
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {section.learningObjectives.map((obj) => (
                    <li key={obj} className="leading-relaxed">
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {section.citations.length > 0 ? (
              <details className="mt-4 group">
                <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
                  Sources ({section.citations.length})
                </summary>
                <ul className="mt-3 space-y-3 border-t border-border pt-3">
                  {section.citations.map((c) => (
                    <li
                      key={c.chunkId}
                      className="text-muted-foreground border-l-2 border-muted pl-3 text-sm"
                    >
                      <p className="text-foreground">{c.text}</p>
                      <p className="mt-1 text-xs">
                        {c.sourceDocument} · p.{c.pageNumber} · {c.section}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
