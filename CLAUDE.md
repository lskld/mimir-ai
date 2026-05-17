# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mimir-ai** is a compliance training platform built as a .NET 10 Minimal API. It ingests regulatory documents (PDF/DOCX), uses an LLM (OpenRouter, currently routed to `google/gemini-2.5-flash-lite`) to extract AMLR requirements, and produces a three-stage training pipeline:

1. **Document outline** — a generic, regulation-grounded training outline per document.
2. **Role outline** — that outline customized to a specific role's risk profile, merged across all documents inherited via the vault hierarchy.
3. **Full training program** — an LLM-generated lesson + multiple-choice quiz + role-specific scenarios for every objective in the approved role outline, exportable as a SCORM 1.2 ZIP package for any standards-compliant LMS.

## Build & Run

**Prerequisites**: .NET 10 SDK, OpenRouter API key (see [openrouter.ai](https://openrouter.ai))

```bash
dotnet build
dotnet run --project Mimir.API   # listens on http://localhost:5003
```

**Set OpenRouter API key** (leave `appsettings.json` value empty in repo):
```bash
dotnet user-secrets set "OpenRouter:ApiKey" "<your-key>" --project Mimir.API
# or set environment variable: OpenRouter__ApiKey=<your-key>
```

`Program.cs` validates the key at startup and throws `InvalidOperationException` if it is missing — misconfiguration fails fast rather than at the first request.

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

### Training Generation — Three-Step Pipeline

The most complex flow in the system. Understanding it requires reading across multiple files. All three stages run as background tasks via the same `Task.Run + IServiceScopeFactory` pattern (see "Background Task Pattern" below).

**Step 1 — Generic document analysis (runs once per document):**
`DocumentPipeline.RunAsync` → `ParsingService.ParseDocumentAsync` (PDF via PdfPig, DOCX via DocumentFormat.OpenXml) → `AnalysisService.AnalyzeDocumentAsync` → persists a `TrainingOutline` with `RawJson`.

The pipeline uses a static `Lock + HashSet<Guid>` to prevent duplicate concurrent runs. Called from `POST /api/analysis`.

**Step 2 — Role outline (runs per role, persisted to `RoleTrainingOutlines`):**
`RoleTrainingService.GenerateTrainingForRoleAsync` orchestrates:
1. Load role + build `roleRiskProfile` dictionary
2. Resolve inherited documents via `DocumentVaultService.GetResolvedDocumentSetAsync` (role > department > org level precedence)
3. For each document: ensure a generic `TrainingOutline` exists (run `DocumentPipeline` if missing), then call `AnalysisService.CustomizeOutlineForRoleAsync` with the stored `RawJson` + role context — one more LLM call per document
4. Merge all customized outlines via `MergeOutlines` (deduplicates by section title, sorts by AMLR article number)
5. Persist result as `RoleTrainingOutline` (separate table from `TrainingOutline`)

Called from `POST /api/training/roles/{roleId}/generate`. Empty vault is *not* an error — the pipeline completes successfully with an empty `sections` array.

**Step 3 — Full training program (runs per role, persisted to `FullTrainingPrograms`):**
`FullTrainingProgramService.GenerateFullProgramAsync` requires an **Approved** `RoleTrainingOutline` and turns each section/objective into deliverable course content. Orchestration:
1. Load role + load the approved `RoleTrainingOutline`; throw if it does not exist or is not in `"Approved"` state (`InvalidOperationException` → 409 via middleware)
2. Persist a `FullTrainingProgram` record with `Status = "Generating"` immediately so the status endpoint reflects progress
3. For each section in the outline:
   - For each learning objective: call `GenerateLessonContentAsync` (Gemini → plain text) and `GenerateQuizQuestionsAsync` (Gemini → JSON list of MCQs)
   - Once per section: call `GenerateScenariosAsync` (Gemini → JSON list of role-specific case studies)
4. Compile into `FullTrainingProgramResponse`, serialize, update record to `Status = "Ready"`
5. On any uncaught exception, update record to `Status = "Failed"` with `ErrorMessage`, then re-throw

A typical AMLR-scale program triggers ~50 LLM calls and takes 2–5 minutes. Called from `POST /api/training/roles/{roleId}/full-program/generate`. The endpoint pre-flight-validates that an approved outline exists and that no other generation is already running for this role (`status != "Generating"`), so a 409 is returned synchronously in those cases rather than letting the background task fail.

**SCORM export** (`ScormPackageService.PackageAsScormAsync`): synchronous helper called from `GET /api/training/roles/{roleId}/full-program/export/scorm`. Builds the ZIP entirely in-memory via `System.IO.Compression.ZipArchive` — no external SCORM library. Output structure:
```
training-course-{role}.zip
├── imsmanifest.xml          SCORM 1.2 manifest
├── content/module_N.html    Self-contained HTML modules with inline CSS + embedded quiz JS
└── data/quiz_data.json      Flat question list for LMS integration
```
Each HTML module is self-contained (no `fetch()`) so the export works both inside an LMS and when opened directly from the filesystem.

### LLM Integration (OpenRouter)

All LLM calls go through the **`ILlmService`** abstraction, currently implemented by **`OpenRouterLlmService`** which posts to OpenRouter's OpenAI-compatible `/chat/completions` endpoint. Registered via typed HttpClient in `Program.cs`:

```csharp
builder.Services.AddHttpClient<ILlmService, OpenRouterLlmService>();
```

Config (`appsettings.json`):
```json
"OpenRouter": {
  "ApiKey": "",
  "Model": "google/gemini-2.5-flash-lite",
  "BaseUrl": "https://openrouter.ai/api/v1"
}
```

`OpenRouterLlmService` request shape: standard OpenAI chat-completions with `max_tokens: 16000` and `temperature: 0.7`. The 16k cap is important — earlier 4k caused silent JSON truncation on AMLR-scale prompts. The service inspects `choices[0].finish_reason` and throws `InvalidOperationException("LLM response was truncated at N tokens …")` if it equals `"length"`, so token-cap hits surface as clean errors instead of downstream JSON parse failures. HTTP errors are mapped explicitly: 401 → "authentication failed", 429 → "rate limited", 5xx → "service error".

Prompts in `Prompts/` (all `<None>` copy-to-output):
- `ExtractRequirements.txt` — extracts requirements as a JSON array from document chunks (Step 1)
- `GenerateOutline.txt` — produces a `TrainingOutlineResponse` JSON from requirements (Step 1)
- `GenerateLessonContent.txt` — 2-3 paragraphs of plain-text lesson per objective (Step 3)
- `GenerateQuizQuestions.txt` — 3-5 MCQs per objective as JSON (Step 3)
- `GenerateScenarios.txt` — 1-2 role-specific case studies per module as JSON (Step 3)

Role customization (Step 2) uses `BuildCustomizationPrompt()` in `AnalysisService` — built inline (not a file) using `$$"""..."""` raw string syntax (double `$`) so JSON braces `{`/`}` are literal and `{{expr}}` is interpolation.

**Markdown fence stripping**: despite explicit "no markdown" instructions, the model frequently wraps JSON in ` ```json ... ``` ` fences. Both `AnalysisService` and `FullTrainingProgramService` have private `StripMarkdownFences` helpers applied before every `JsonSerializer.Deserialize`. Do **not** move this into `OpenRouterLlmService` — it would mangle legitimate plain-text responses (`GenerateLessonContent` returns prose that may discuss code/markdown).

**Defensive JSON parsing in Step 3**: `GenerateQuizQuestionsAsync` and `GenerateScenariosAsync` catch `JsonException` and return `[]` instead of failing the whole program — one malformed LLM response shouldn't abort a 50-call pipeline. `GenerateFullProgramAsync` still fails loudly on infrastructure errors (HTTP, timeout, truncation).

`AmlrArticle` in the outline response uses a custom `AmlrArticleConverter` that tolerates three shapes the LLM returns: integer (`6`), string (`"Preamble"`), or array (`[6, 25]`) — all normalized to a string.

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

`ExceptionHandlingMiddleware` (registered as the first middleware in `Program.cs`) wraps every request and maps uncaught exceptions of three specific types to HTTP status codes plus a uniform JSON body shape (`ErrorResponse` = `{ status, title, detail, instance }`).

| Exception | HTTP status | Logger level |
|-----------|-------------|--------------|
| `KeyNotFoundException` | 404 Not Found | Warning |
| `ArgumentException` | 400 Bad Request | Warning |
| `InvalidOperationException` | 409 Conflict | Warning |
| anything else | 500 Internal Server Error (generic detail, full stack logged) | Error |

This is why services *throw* domain exceptions instead of returning result types — the handler-to-status mapping is centralized. **Never** catch one of these three exception types in an endpoint or service unless you intend to handle it locally; let it bubble to the middleware.

**Exception to the uniform shape:** a few endpoints (`GET /api/training/roles/{roleId}/outline`, `POST /api/training/roles/{roleId}/approve`, `GET /api/training/roles/{roleId}/full-program`) return their 409s as `Results.Conflict(new { message = "..." })` because the conflict is *state-based*, not exception-based, and the message text is part of the API contract. These bodies are `{ "message": "..." }` (and sometimes `{ "message": "...", "errorMessage": "..." }` for the Failed cases) — not `ErrorResponse`. The frontend treats HTTP status as authoritative; body shape is secondary.

### Status State Machines

**`RoleTrainingOutline.Status`** — `Generating → Draft → Approved` (or `Failed`)
- Created with `"Generating"` at the start of `RoleTrainingService.GenerateTrainingForRoleAsync`
- Updated to `"Draft"` with `RawJson` on success
- Updated to `"Failed"` with `ErrorMessage` on exception (then re-throws)
- Status endpoint maps both `Draft` and `Approved` → `"Ready"` for the API consumer (approval state is queryable separately by re-fetching the outline)
- Approval (`POST /api/training/roles/{roleId}/approve`) is the gate for Step 3 — `FullTrainingProgramService.GenerateFullProgramAsync` refuses to run unless `Status == "Approved"`

**`FullTrainingProgram.Status`** — `Generating → Ready` (or `Failed`)
- Created with `"Generating"` via `FullTrainingProgramRepository.SaveOrUpdateAsync` (insert-or-overwrite by `RoleId`) at the start of `GenerateFullProgramAsync`
- Updated to `"Ready"` with `RawJson` + `CompletedAt` on success
- Updated to `"Failed"` with `ErrorMessage` on exception (then re-throws)
- No "Pending" state — the record only exists once generation has been triggered; missing record = "never triggered" (the status endpoint returns 404 in that case)
- Re-triggering generation overwrites the existing record (no version history)

### Database FK Conventions

There are two patterns for role references in this codebase. Be explicit about which you use:

- **No-FK pattern (`DocumentAssignment`, `RoleTrainingOutline`):** holds a `Guid RoleId` (or polymorphic `TargetId`) with **no FK constraint to `Roles`**. Referential integrity is enforced in the service layer (`DocumentVaultService`, `RoleTrainingService`). Configured by simply omitting `HasOne<Role>()` from `OnModelCreating`. The comment "same no-FK pattern; integrity enforced in service" marks these.
- **Real-FK pattern (`FullTrainingProgram`):** has a configured `RoleId → Roles.Id` foreign key with `OnDelete(DeleteBehavior.Cascade)`, declared via `.HasOne<Role>().WithMany().HasForeignKey(p => p.RoleId)` (no navigation property on `Role`). Deleting a role cascades to its full programs.

When adding a new entity that references a role, pick the pattern deliberately — don't copy whichever one is closest.

## Code Layout — Where to Find Things

```
Mimir.API/
├── Program.cs                       DI registration, middleware, endpoint mapping, startup validation
├── Data/
│   ├── AppDbContext.cs              EF Core context — DbSets + OnModelCreating (FK config)
│   ├── SeedData.cs                  Idempotent seed (org level + departments + roles + AMLR doc)
│   └── Repositories/                One repository per aggregate; constructor-injected DbContext
├── Endpoints/                       One static class per resource group, registered via Map…Endpoints extension
│   ├── DocumentEndpoints.cs
│   ├── AnalysisEndpoints.cs         /api/analysis (Step 1)
│   ├── HierarchyEndpoints.cs        org levels / departments / roles
│   ├── VaultEndpoints.cs            document assignments
│   ├── RoleTrainingEndpoints.cs     /api/training/roles/{roleId}/...  (Step 2)
│   └── FullTrainingProgramEndpoints.cs   /api/training/roles/{roleId}/full-program/...  (Step 3 + SCORM)
├── Services/
│   ├── ILlmService + OpenRouterLlmService     HTTP client wrapping OpenRouter chat completions
│   ├── ParsingService                          PDF/DOCX → DocumentChunk
│   ├── AnalysisService                         Steps 1 + role customization
│   ├── CitationService                         Maps LLM citation stubs back to real chunks
│   ├── DocumentVaultService                    Inheritance resolution + assignment integrity
│   ├── HierarchyService                        Org level / department / role CRUD + publish
│   ├── RoleTrainingService                     Step 2 orchestration
│   ├── FullTrainingProgramService              Step 3 orchestration (lesson + quiz + scenario calls)
│   └── ScormPackageService                     In-memory SCORM 1.2 ZIP build (synchronous, no external libs)
├── Pipeline/DocumentPipeline.cs     Step 1 orchestrator (parse → analyze)
├── Middleware/ExceptionHandlingMiddleware.cs   Domain exceptions → HTTP codes + ErrorResponse JSON
├── Models/
│   ├── Domain/                      EF entities
│   ├── Requests/                    Request DTOs (camelCase JSON)
│   └── Responses/                   Response DTOs (camelCase JSON)
└── Prompts/                         Five .txt prompt files, copy-to-output via .csproj
```

**Adding a new endpoint:** create the handler in the relevant `Endpoints/*.cs` class, throw domain exceptions for failures, register the resource group in `Program.cs` if it's new. Match the existing `IServiceScopeFactory` pattern if it kicks off background work.

**Adding a new LLM call:** inject `ILlmService` and call `llmService.CallLlmAsync(systemPrompt + "\n\n" + userPrompt)`. Put the system prompt in `Prompts/<Name>.txt` and add it to the `<None>` copy-to-output glob in `Mimir.API.csproj`. If the response is JSON, run it through `StripMarkdownFences` before `JsonSerializer.Deserialize`.

**Adding a new domain entity:** add to `Models/Domain/`, register `DbSet` in `AppDbContext`, configure indexes / FKs in `OnModelCreating`, add a repository in `Data/Repositories/`. The schema is created by `EnsureCreatedAsync()` on startup — there are no migrations, so deleting `mimir.db` is how you apply schema changes locally.
