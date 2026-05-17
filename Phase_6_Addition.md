# Phase 6 — Full Training Program Generation + SCORM Export

**Timeline:** Monday (6-8 hours) + Tuesday (4-5 hours) + Wednesday morning (2 hours testing)
**Scope:** Takes an approved training outline and generates full lesson content (text, quizzes, scenarios) + SCORM-compliant package
**Token budget:** ~100€ of OpenRouter credits available for hackathon day

---

## What is Phase 6?

**Input:** An approved TrainingOutlineResponse for a role
**Output:** A complete training program with:
- Full lesson text for each module (2-3 paragraphs per objective)
- Multiple-choice quiz questions (3-5 per objective)
- Role-specific case study scenarios (1-2 per module)
- SCORM 1.2 manifest and package (ZIP file with HTML, metadata, quiz data)

**Why this matters:**
- The outline is a blueprint; Phase 6 builds the actual course
- Demonstrates full automation end-to-end (upload PDF → outline → full program)
- Shows "content generation at scale" — impressive for demo
- Opens the roadmap: "Phase 7 would be LMS integration, learner tracking, etc."

---

## Phase 6 — Implementation Steps

### 28. New Service: IFullTrainingProgramService ← Monday morning

Create interface and implementation:

**File:** `Services/IFullTrainingProgramService.cs` + `Services/FullTrainingProgramService.cs`

**Interface methods:**

```csharp
public interface IFullTrainingProgramService
{
    /// <summary>
    /// Generates full training program (lessons, quizzes, scenarios) from an approved outline.
    /// Runs as a background task; client polls status via GetFullProgramStatusAsync.
    /// </summary>
    Task<FullTrainingProgramResponse> GenerateFullProgramAsync(Guid roleId);
    
    /// <summary>
    /// Returns generation status: Pending, Generating, Ready, Failed
    /// </summary>
    Task<string> GetFullProgramStatusAsync(Guid roleId);
    
    /// <summary>
    /// Retrieves the completed program if Ready status.
    /// </summary>
    Task<FullTrainingProgramResponse?> GetFullProgramAsync(Guid roleId);
    
    /// <summary>
    /// Exports the completed program as SCORM 1.2 ZIP package.
    /// </summary>
    Task<byte[]> ExportScormAsync(Guid roleId);
}
```

**Implementation pseudocode:**

```
GenerateFullProgramAsync(roleId):
  1. Load role + approved outline from database
  2. Load role's risk profile
  3. For each module in outline:
     a. For each learning objective:
        i.   Generate lesson text (call GenerateLessonContentAsync)
        ii.  Generate quiz questions (call GenerateQuizQuestionsAsync)
     b. Generate 1-2 role-specific scenarios (call GenerateScenariosAsync)
  4. Compile all content into FullTrainingProgramResponse
  5. Serialize to JSON + store in database
  6. Update status to "Ready"
  7. Return response

Where FullTrainingProgramResponse includes:
  {
    roleId: Guid,
    roleName: string,
    modules: [
      {
        moduleTitle: string,
        lessonText: string,
        learningObjectives: [
          { objective: string, lessonContent: string, quizQuestions: [...], scenarios: [...] }
        ]
      }
    ]
  }
```

**Constraints:**
- Do NOT modify existing outline or training outline records
- Store full program in a new database table: `FullTrainingPrograms`
- Log each Gemini call with timing (track token usage)
- If any Gemini call fails, mark status as "Failed" + store error message

---

### 29. Create New Prompts (for content generation) ← Monday

Create three new prompt files in `Prompts/`:

**Prompts/GenerateLessonContent.txt**
- Input: Module title, learning objective, AMLR article references, role name, risk profile
- Output: 2-3 paragraphs of instructional text
- Constraints:
  - Plain text, no markdown
  - Practical examples relevant to the role
  - Reference AMLR articles in text where applicable
  - Include a real-world scenario at the end

**Prompts/GenerateQuizQuestions.txt**
- Input: Learning objective, AMLR regulation details, role context
- Output: 3-5 multiple-choice questions with answer key
- Constraints:
  - Return JSON array of questions
  - Each question: text, 4 options (A/B/C/D), correctAnswer: "A" | "B" | "C" | "D", explanation
  - Questions should assess the objective, not just recall facts
  - One question should be scenario-based ("In this situation, what would you do?")

**Prompts/GenerateScenarios.txt**
- Input: Module topic, role name, risk profile, AMLR context
- Output: 1-2 role-specific case studies
- Constraints:
  - Return JSON array with scenario title, description, complication, discussion questions
  - Scenarios must reflect the role's actual risks (e.g., KYC Analyst gets EDD scenarios, not policy-setting scenarios)
  - 150-250 words per scenario
  - Include "What would you do?" prompts for trainer facilitation

---

### 30. New Database Table: FullTrainingPrograms ← Monday afternoon

Create EF Core migration:

```csharp
public class FullTrainingProgram
{
    public Guid Id { get; set; }
    public Guid RoleId { get; set; }
    public string RoleName { get; set; }
    public string Status { get; set; } // Pending, Generating, Ready, Failed
    public string? RawJson { get; set; } // Serialized FullTrainingProgramResponse
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? ScormZipPath { get; set; } // Path to generated SCORM package (if exported)
}
```

Add repository: `Data/Repositories/FullTrainingProgramRepository.cs`

Methods:
- `SaveOrUpdateAsync(FullTrainingProgram program)`
- `GetByRoleIdAsync(Guid roleId)`
- `UpdateStatusAsync(Guid id, string status, string? rawJson, string? errorMessage)`

---

### 31. SCORM Packaging Logic ← Tuesday morning

Create a new service: `Services/ScormPackageService.cs`

**Responsibility:** Convert FullTrainingProgramResponse into a valid SCORM 1.2 ZIP file.

**Files to generate inside ZIP:**

```
training-course.zip
├── imsmanifest.xml          (SCORM metadata)
├── content/
│   ├── module_1.html        (Lesson for Module 1)
│   ├── module_2.html
│   └── ...
└── data/
    └── quiz_data.json       (All quiz questions + answers)
```

**imsmanifest.xml structure:**
- Defines course title, organization, resources
- Points to each module HTML file as a learning object
- Includes quiz tracking metadata

**module_N.html structure:**
- Course header with title + module name
- Lesson text for each objective
- Embedded quiz questions (read from quiz_data.json via JavaScript)
- Scenario cards for group discussion
- Navigation buttons (Previous, Next, Back to Menu)
- SCORM API hooks for LMS integration (track completion when quiz passed)

**Method signature:**

```csharp
public async Task<byte[]> PackageAsScormAsync(FullTrainingProgramResponse program)
{
    // Create in-memory ZIP
    // Add imsmanifest.xml (generate from template + program metadata)
    // For each module: generate HTML from lesson content + quiz data
    // Compress to byte[]
    // Return
}
```

**Constraint:** Use System.IO.Compression.ZipArchive (built-in .NET, no external dependencies)

---

### 32. New Endpoints: FullTrainingProgramEndpoints ← Tuesday afternoon

Create `Endpoints/FullTrainingProgramEndpoints.cs`

**Endpoints:**

```
POST /api/training/roles/{roleId}/full-program/generate
  Response: 202 Accepted
  Body: { "status": "Generating", "roleId": "..." }
  
GET /api/training/roles/{roleId}/full-program/status
  Response: 200 OK
  Body: { "status": "Pending | Generating | Ready | Failed", 
          "errorMessage": "..." (if Failed) }
  
GET /api/training/roles/{roleId}/full-program
  Response: 200 OK (if Ready) or 404 (if not generated yet)
  Body: FullTrainingProgramResponse (full lesson content + quiz data)
  
GET /api/training/roles/{roleId}/full-program/export/scorm
  Response: 200 OK + Content-Disposition: attachment; filename="training-course.zip"
  Body: ZIP file (binary)
```

**Implementation notes:**
- POST endpoint triggers `IFullTrainingProgramService.GenerateFullProgramAsync()` as background Task
- Endpoint returns immediately with 202 (do NOT await the task)
- Status endpoint polls the `FullTrainingProgram` record
- GET /export/scorm calls `ScormPackageService.PackageAsScormAsync()`

---

### 33. Integration Test: End-to-End Full Program Generation ← Tuesday evening

Test the full flow manually:

1. Approve a training outline for a role (use existing endpoints from Phase 5)
2. POST /api/training/roles/{roleId}/full-program/generate
   - Verify 202 response
   - Verify status polling works
3. Poll status every 2-3 seconds until "Ready" (should take 2-3 minutes depending on Gemini)
4. GET /api/training/roles/{roleId}/full-program
   - Verify all modules have lesson text + quiz questions + scenarios
5. GET /api/training/roles/{roleId}/full-program/export/scorm
   - Verify ZIP file downloads
   - Unzip locally and inspect:
     - imsmanifest.xml exists and is valid
     - HTML files are well-formed
     - Quiz JSON is present

---

### 34. Demo Preparation for Phase 6 ← Wednesday morning (09:00-10:30)

Before the live demo:

1. Run the full program generation for 2-3 roles locally (costs ~3-5€ in tokens)
2. Download and inspect SCORM packages — they should open in a browser
3. Prepare talking points:
   - "The outline is the blueprint. Now we auto-generate the actual course content."
   - "Every lesson cites AMLR. Every quiz question tests the specific objective."
   - "This SCORM package can go directly into any learning management system."
   - "The same pipeline works for any regulation — just swap the PDF and prompts."
4. Time the demo: outline generation (1-2 min) + full program generation (2-3 min) + SCORM export (10 sec)
5. Have a pre-generated SCORM backup on your laptop in case Gemini is slow on demo day

---

## What We're NOT Building (Phase 6 Scope Boundaries)

- LMS integration (tracking learner progress, completions)
- Learner accounts or authentication
- Bulk email invitations to employees
- PDF export (SCORM is the deliverable format)
- Video content generation
- Interaction design (drag-and-drop, branching scenarios)

These are "Phase 7+" items that show you've thought about the roadmap.

---

## Token Cost Estimate

Per role (assuming 7 modules × 6 objectives = ~42 content pieces):
- Lesson text: 7 calls × ~$0.10 = $0.70
- Quiz questions: 7 calls × ~$0.10 = $0.70
- Scenarios: 7 calls × ~$0.10 = $0.70
- **Per role: ~$2.10**

For 4 roles: ~$8.40

**With 100€ budget, you can comfortably generate full programs for 40+ roles.** More than enough.

---

## Success Criteria

By Wednesday 10:00 AM:
- ✅ User uploads AMLR PDF
- ✅ System generates outline for KYC Analyst
- ✅ User approves outline
- ✅ User clicks "Generate Full Program"
- ✅ System generates lesson text, quizzes, scenarios in background
- ✅ User downloads SCORM ZIP
- ✅ Unzip, open module_1.html in browser → see polished course material
- ✅ Judges see: "This is an actual, deployable training program."

---

## Summary

Phase 6 is **three days of work** (Mon 6h + Tue 5h + Wed 2h) and transforms Mimir from "outline generator" to "full training course generator." 

The outline demonstrates **understanding of risk and competency linkage.** The full program demonstrates **automation at scale and real business value.**

For judges evaluating "Automation Degree" (15%) and "Business Relevance" (5%), this is where those criteria really shine.

Ready to start Phase 6?
