# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mimir-ai** is a compliance training platform built as a .NET 10 Minimal API. It ingests regulatory documents (PDF/DOCX), analyzes them using Gemini LLM to extract AMLR requirements, generates structured training outlines, and produces role-customized training curricula through a hierarchical organization model.

## Build & Run

**Prerequisites**: .NET 10 SDK, Gemini API key

```bash
dotnet build
dotnet run --project Mimir.API   # listens on http://localhost:5003
```

**Set Gemini API key** (leave `appsettings.json` value empty in repo):
```bash
dotnet user-secrets set "Gemini:ApiKey" "<your-key>" --project Mimir.API
# or set environment variable: Gemini__ApiKey=<your-key>
```

**Database**: SQLite, auto-created at `Mimir.API/mimir.db` on first run via `EnsureCreatedAsync()`. No migration command needed. To reset, delete `mimir.db` and restart.

**Seed data**: On every startup, `SeedData.InitializeAsync()` runs. It is idempotent — skips if `Roles` table is non-empty. Seeds: 1 org level, 2 departments, 4 roles with risk profiles, and the AMLR document if a seed file exists at `Uploads/seed-documents/AMLR_1624.pdf` (resolved against `AppContext.BaseDirectory`). The AMLR document uses fixed `Id = 11111111-1111-1111-1111-111111111111`.

No test project exists.

## Architecture

### Core Domain — Three Entity Groups

**1. Documents & Pipeline**

`Document` → `DocumentChunk` (parsed text segments) → `TrainingOutline` (generic AI-generated curriculum, stored as `RawJson`).

Document status lifecycle: `Pending → Parsed → Analyzed` (or `Failed`).  
`TrainingOutline` has a unique constraint on `DocumentId` — one generic outline per document.

**2. Organizational Hierarchy**

Three levels with many-to-many relationships via junction tables:
```
OrganizationLevel ↔ Department (via DepartmentOrganizationLevel)
Department ↔ Role (via RoleDepartment)
```
`Role` carries a 5-dimension risk profile: `AmlRisk`, `SanctionsRisk`, `FraudRisk`, `DocumentationRisk`, `OperationalRisk` — all strings defaulting to `"Medium"`. Role status: `Draft → Published`.

**3. Document Vault**

`DocumentAssignment` uses a polymorphic `TargetType` (string: `"OrganizationLevel"`, `"Department"`, or `"Role"`) + `TargetId` (Guid) pattern instead of typed FKs — EF Core doesn't support multi-target FKs. **Referential integrity is enforced in `DocumentVaultService`, not the database.**

### Training Generation — Two-Step Pipeline

The most complex flow in the system. Understanding this requires reading across multiple files:

**Step 1 — Generic document analysis (runs once per document):**
`DocumentPipeline.RunAsync` → `ParsingService.ParseDocumentAsync` (PDF via PdfPig, DOCX via DocumentFormat.OpenXml) → `AnalysisService.AnalyzeDocumentAsync` → persists a `TrainingOutline` with `RawJson`.

The pipeline uses a static `Lock + HashSet<Guid>` to prevent duplicate concurrent runs. Called from `POST /api/analysis` (background task with `IServiceScopeFactory` scope).

**Step 2 — Role customization (runs per role, not persisted to `Outlines`):**
`RoleTrainingService.GenerateTrainingForRoleAsync` orchestrates:
1. Load role + build `roleRiskProfile` dictionary
2. Resolve inherited documents via `DocumentVaultService.GetResolvedDocumentSetAsync` (role > department > org level precedence)
3. For each document: ensure a generic `TrainingOutline` exists (run pipeline if missing), then call `AnalysisService.CustomizeOutlineForRoleAsync` with the stored `RawJson` + role context — one more Gemini call per document
4. Merge all customized outlines via `MergeOutlines` (deduplicates by section title, sorts by AMLR article number)
5. Persist result as `RoleTrainingOutline` (separate table from `TrainingOutline`)

Called from `POST /api/training/roles/{roleId}/generate` via `Task.Run` + new `IServiceScopeFactory` scope (same pattern as analysis endpoint — the request scope is disposed before background work starts).

### LLM Integration (Gemini)

`AnalysisService` calls Gemini via the `GenerativeAI` SDK:

```json
"Gemini": {
  "ApiKey": "",
  "Model": "gemini-2.5-flash-lite"
}
```

Two prompts in `Prompts/`:
- `ExtractRequirements.txt` — extracts requirements as a JSON array from document chunks
- `GenerateOutline.txt` — produces a generic `TrainingOutlineResponse` JSON from requirements

Role customization uses `BuildCustomizationPrompt()` in `AnalysisService` — the prompt is built inline (not a file). It uses `$$"""..."""` raw string syntax (double `$`) so JSON braces `{`/`}` are literal and `{{expr}}` is interpolation.

`AmlrArticle` in the outline response uses a custom `AmlrArticleConverter` that tolerates three shapes Gemini returns: integer (`6`), string (`"Preamble"`), or array (`[6, 25]`) — all normalized to a string.

### Vault Inheritance Resolution

`DocumentVaultService.GetResolvedDocumentSetAsync`:
1. Load role → its departments → their org levels
2. Collect `DocumentAssignment`s from all three levels
3. Deduplicate by `DocumentId`, keeping the most specific assignment: **role > department > org level**

### Background Task Pattern

Both `POST /api/analysis` and `POST /api/training/roles/{id}/generate` use the same pattern:
```csharp
_ = Task.Run(async () =>
{
    await using var scope = scopeFactory.CreateAsyncScope();
    var svc = scope.ServiceProvider.GetRequiredService<ITheService>();
    await svc.DoWorkAsync(...);
});
return Results.Accepted(...);
```
The `IServiceScopeFactory` scope is required because the request's DI scope (and its `DbContext`) is disposed before `Task.Run` executes.

### Error Handling Convention

Exceptions map to HTTP status codes via global middleware:

| Exception | HTTP status |
|-----------|-------------|
| `KeyNotFoundException` | 404 |
| `ArgumentException` | 400 |
| `InvalidOperationException` | 409 |

### RoleTrainingOutline Status State Machine

`Generating → Draft → Approved` (or `Failed`)

- Created with `"Generating"` at the start of background work
- Updated to `"Draft"` with `RawJson` on success
- Updated to `"Failed"` with `ErrorMessage` on exception
- Status endpoint maps `Draft`/`Approved` → `"Ready"` for the API consumer
