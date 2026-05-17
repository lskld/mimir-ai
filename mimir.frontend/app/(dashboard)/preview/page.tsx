import Link from "next/link"

export default function PreviewIndexPage() {
  return (
    <div className="mx-auto max-w-md space-y-3 text-sm">
      <h2 className="text-base font-semibold">Preview</h2>
      <p className="text-muted-foreground leading-relaxed">
        Open a read-only outline from Studio using the Preview link, or go to{" "}
        <code className="bg-muted rounded px-1 py-0.5 text-xs">/preview/&lt;documentId&gt;</code>
        .
      </p>
      <Link
        href="/"
        className="text-primary inline-block text-sm font-medium hover:underline"
      >
        Go to Home
      </Link>
    </div>
  )
}
