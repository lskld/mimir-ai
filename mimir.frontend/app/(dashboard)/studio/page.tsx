import Link from "next/link"

export default function StudioIndexPage() {
  return (
    <div className="mx-auto max-w-md space-y-3 text-sm">
      <h2 className="text-base font-semibold">Studio</h2>
      <p className="text-muted-foreground leading-relaxed">
        Upload a document from Documents, then you will be redirected here to run
        analysis and review the generated outline.
      </p>
      <Link
        href="/vault"
        className="text-primary inline-block text-sm font-medium hover:underline"
      >
        Go to Documents
      </Link>
    </div>
  )
}
