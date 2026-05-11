# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mimir-ai** is a compliance training platform built as a .NET 10 Minimal API. It ingests regulatory documents (PDF/DOCX), analyzes them using Groq LLM to extract requirements, generates structured training outlines with citations, and enables role-based document assignment through a hierarchical organization model.

## Build & Run

**Prerequisites**: .NET 10 SDK, Groq API key

```bash
dotnet build
dotnet run --project Mimir.API   # listens on http://localhost:5003
```

**Set Groq API key** (leave `appsettings.json` value empty in repo):
```bash
dotnet user-secrets set "Groq:ApiKey" "<your-key>" --project Mimir.API
# or set environment variable: Groq__ApiKey=<your-key>
```

**Database**: SQLite, auto-created at runtime (`mimir.db`). No migrations command needed on first run — EF Core creates the schema.

No test project exists yet.

## Architecture

### Core Domain

Three main entity groups:

1. **Documents & Pipeline** — `Document` → `DocumentChunk` (parsed text segments) → `TrainingOutline` (AI-generated curriculum). Status lifecycle: `Pending → Parsed → Analyzed` (or `Failed`).

2. **Organizational Hierarchy** (three levels) — `OrganizationLevel` → `Department` (linked via junction `DepartmentOrganizationLevel`) → `Role` (linked via junction `RoleDepartment`).

3. **Document Vault** — `DocumentAssignment` uses a polymorphic `TargetType`/`TargetId` pair (string + Guid) instead of typed FK because EF Core doesn't support multi-target FKs. Referential integrity enforced in `DocumentVaultService`.

### Pipeline

`DocumentPipeline` orchestrates three phases:
1. **Parse** — `ParsingService` extracts `DocumentChunk`s from PDF (PdfPig) or DOCX (DocumentFormat.OpenXml)
2. **Analyze** — `AnalysisService` calls Groq with `ExtractRequirements.txt` prompt to pull regulatory requirements from chunks
3. **Outline** — `AnalysisService` calls Groq with `GenerateOutline.txt` prompt to produce a structured `TrainingOutline`

The pipeline uses a thread-safe `_runningDocuments HashSet` to prevent duplicate concurrent runs. The `POST /api/analysis` endpoint returns `202 Accepted` immediately and fires the pipeline in a background task; callers poll `GET /api/analysis/{docId}/outline` for completion.

### LLM Integration

Groq is called via the OpenAI SDK (OpenAI-compatible API). `AnalysisService` constructs the client per-request, overriding the base URL and API key from config:

```json
"Groq": {
  "ApiKey": "",
  "BaseUrl": "https://api.groq.com/openai/v1",
  "Model": "openai/gpt-oss-20b"
}
```

Prompt templates in `Prompts/` use `{{CHUNKS}}` and `{{REQUIREMENTS}}` as injection markers.

### Inheritance Resolution

`DocumentVaultService.GetResolvedDocumentSetAsync` implements the core business logic:
- Load the role → its departments → their org levels
- Collect `DocumentAssignment`s from all three levels
- Deduplicate by `DocumentId`, keeping the most specific level: **role > department > org level**

### Error Handling Convention

| Exception | HTTP status |
|-----------|-------------|
| `KeyNotFoundException` | 404 |
| `ArgumentException` | 400 |
| `InvalidOperationException` | 409 |

## Implementation Status

The codebase is approximately **40% implemented** — services and repositories are scaffolded with `TODO` comments. Key stubs:

- `DocumentService` — file upload validation & persistence
- `ParsingService` — PDF/DOCX parsing into chunks
- `AnalysisService` — Groq LLM calls and JSON parsing
- `CitationService` — keyword-overlap chunk matching (planned: vector search)
- `HierarchyService` / `DocumentVaultService` — all CRUD and inheritance resolution
- All repositories — EF Core queries

When implementing stubs, follow the existing pattern: constructor injection, `async Task` returns, map exceptions to the error handling convention above.
