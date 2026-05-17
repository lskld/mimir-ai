using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public class ScormPackageService(ILogger<ScormPackageService> logger) : IScormPackageService
{
    private static readonly JsonSerializerOptions QuizJsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<byte[]> PackageAsScormAsync(FullTrainingProgramResponse program)
    {
        if (program is null)
            throw new ArgumentNullException(nameof(program));

        if (program.Modules.Count == 0)
            throw new InvalidOperationException(
                $"Training program for role '{program.RoleName}' has no modules and cannot be packaged.");

        logger.LogInformation(
            "Building SCORM package for role {RoleName}: {ModuleCount} modules, {ObjectiveCount} objectives",
            program.RoleName,
            program.Modules.Count,
            program.Modules.Sum(m => m.Objectives.Count));

        return await Task.Run(() => BuildZip(program));
    }

    private byte[] BuildZip(FullTrainingProgramResponse program)
    {
        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddTextEntry(zip, "imsmanifest.xml", GenerateManifest(program));
            logger.LogInformation("Added imsmanifest.xml");

            for (var i = 0; i < program.Modules.Count; i++)
            {
                var path = $"content/module_{i + 1}.html";
                AddTextEntry(zip, path, GenerateModuleHtml(i + 1, program.Modules[i], program.Modules.Count, program.RoleName));
                logger.LogInformation("Added {Path}", path);
            }

            AddTextEntry(zip, "data/quiz_data.json", GenerateQuizDataJson(program));
            logger.LogInformation("Added data/quiz_data.json");
        }

        return stream.ToArray();
    }

    // ─── Manifest ────────────────────────────────────────────────────────────

    private static string GenerateManifest(FullTrainingProgramResponse program)
    {
        var safeId = SanitizeIdentifier(program.RoleName);
        var timestamp = program.GeneratedAt.ToString("yyyyMMddHHmmss");
        var title = $"{EscapeXml(program.RoleName)} — AMLR 2024/1624 Training";

        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.AppendLine("<manifest");
        sb.AppendLine("  xmlns=\"http://www.imsproject.org/xsd/imscp_v1p1\"");
        sb.AppendLine("  xmlns:adlcp=\"http://www.adlnet.org/xsd/adlcp_v1p2\"");
        sb.AppendLine($"  identifier=\"mimir-training-{safeId}-{timestamp}\"");
        sb.AppendLine("  version=\"1.0\">");

        sb.AppendLine("  <metadata>");
        sb.AppendLine("    <schema>ADL SCORM</schema>");
        sb.AppendLine("    <schemaversion>1.2</schemaversion>");
        sb.AppendLine($"    <title>{title}</title>");
        sb.AppendLine("  </metadata>");

        sb.AppendLine("  <organizations default=\"Org1\">");
        sb.AppendLine("    <organization identifier=\"Org1\">");
        sb.AppendLine($"      <title>{EscapeXml(program.RoleName)} Training Course</title>");
        for (var i = 0; i < program.Modules.Count; i++)
        {
            sb.AppendLine($"      <item identifier=\"module_{i + 1}\" identifierref=\"Resource_{i + 1}\">");
            sb.AppendLine($"        <title>Module {i + 1}: {EscapeXml(program.Modules[i].ModuleTitle)}</title>");
            sb.AppendLine("      </item>");
        }
        sb.AppendLine("    </organization>");
        sb.AppendLine("  </organizations>");

        sb.AppendLine("  <resources>");
        for (var i = 0; i < program.Modules.Count; i++)
        {
            sb.AppendLine($"    <resource identifier=\"Resource_{i + 1}\" type=\"webcontent\" href=\"content/module_{i + 1}.html\">");
            sb.AppendLine($"      <file href=\"content/module_{i + 1}.html\"/>");
            sb.AppendLine("    </resource>");
        }
        sb.AppendLine("  </resources>");

        sb.AppendLine("</manifest>");
        return sb.ToString();
    }

    // ─── Module HTML ─────────────────────────────────────────────────────────

    private static string GenerateModuleHtml(
        int moduleIndex,
        FullTrainingModuleResponse module,
        int totalModules,
        string roleName)
    {
        var sb = new StringBuilder();
        var prevHref = moduleIndex > 1 ? $"module_{moduleIndex - 1}.html" : null;
        var nextHref = moduleIndex < totalModules ? $"module_{moduleIndex + 1}.html" : null;

        // Build per-module quiz data for embedded JavaScript
        var moduleQuizJson = BuildModuleQuizJson(moduleIndex, module);

        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html lang=\"en\">");
        sb.AppendLine("<head>");
        sb.AppendLine("  <meta charset=\"UTF-8\">");
        sb.AppendLine("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        sb.AppendLine($"  <title>Module {moduleIndex}: {EscapeHtml(module.ModuleTitle)}</title>");
        AppendCss(sb);
        sb.AppendLine("</head>");
        sb.AppendLine("<body>");

        // ── Header
        sb.AppendLine("<header>");
        sb.AppendLine("  <div class=\"container\">");
        sb.AppendLine($"    <div class=\"course-label\">{EscapeHtml(roleName)} — AMLR 2024/1624 Training</div>");
        sb.AppendLine($"    <h1>Module {moduleIndex}: {EscapeHtml(module.ModuleTitle)}</h1>");
        if (!string.IsNullOrWhiteSpace(module.AmlrArticle))
            sb.AppendLine($"    <div class=\"amlr-badge\">AMLR Article {EscapeHtml(module.AmlrArticle)}</div>");
        sb.AppendLine("  </div>");
        sb.AppendLine("</header>");

        sb.AppendLine("<div class=\"container\">");

        // ── Top navigation
        AppendNav(sb, moduleIndex, totalModules, prevHref, nextHref);

        // ── Module overview
        if (!string.IsNullOrWhiteSpace(module.Description))
        {
            sb.AppendLine("  <div class=\"section-card\">");
            sb.AppendLine("    <div class=\"section-label\">Overview</div>");
            sb.AppendLine($"    <p>{EscapeHtml(module.Description)}</p>");
            sb.AppendLine("  </div>");
        }

        // ── Learning objectives summary
        if (module.Objectives.Count > 0)
        {
            sb.AppendLine("  <div class=\"section-card\">");
            sb.AppendLine("    <div class=\"section-label\">Learning Objectives</div>");
            sb.AppendLine("    <ul class=\"objectives-list\">");
            foreach (var obj in module.Objectives)
                sb.AppendLine($"      <li>{EscapeHtml(obj.Objective)}</li>");
            sb.AppendLine("    </ul>");
            sb.AppendLine("  </div>");
        }

        // ── Objectives: lesson content + quiz
        var globalQuestionIndex = 0;
        for (var oi = 0; oi < module.Objectives.Count; oi++)
        {
            var obj = module.Objectives[oi];
            sb.AppendLine("  <div class=\"section-card\">");
            sb.AppendLine($"    <div class=\"section-label\">Objective {oi + 1}</div>");
            sb.AppendLine($"    <h2>{EscapeHtml(obj.Objective)}</h2>");

            if (!string.IsNullOrWhiteSpace(obj.LessonContent))
            {
                sb.AppendLine($"    <div class=\"lesson-content\">{EscapeHtml(obj.LessonContent)}</div>");
            }

            if (obj.QuizQuestions.Count > 0)
            {
                sb.AppendLine("    <h3 class=\"quiz-heading\">Knowledge Check</h3>");
                for (var qi = 0; qi < obj.QuizQuestions.Count; qi++)
                {
                    var q = obj.QuizQuestions[qi];
                    var qId = $"q_{moduleIndex}_{oi + 1}_{qi + 1}";
                    var qIndex = globalQuestionIndex;

                    sb.AppendLine("    <div class=\"quiz-question\">");
                    sb.AppendLine($"      <p class=\"question-text\">{qi + 1}. {EscapeHtml(q.Text)}</p>");

                    foreach (var kvp in q.Options.OrderBy(o => o.Key))
                    {
                        sb.AppendLine($"      <label class=\"option-label\">");
                        sb.AppendLine($"        <input type=\"radio\" name=\"{qId}\" value=\"{EscapeHtml(kvp.Key)}\">");
                        sb.AppendLine($"        <span><strong>{EscapeHtml(kvp.Key)}.</strong> {EscapeHtml(kvp.Value)}</span>");
                        sb.AppendLine("      </label>");
                    }

                    sb.AppendLine($"      <button id=\"btn_{qIndex}\" class=\"submit-btn\" onclick=\"checkAnswer({qIndex})\">Submit Answer</button>");
                    sb.AppendLine($"      <div id=\"feedback_{qIndex}\" class=\"feedback\"></div>");
                    sb.AppendLine("    </div>");

                    globalQuestionIndex++;
                }
            }

            sb.AppendLine("  </div>");
        }

        // ── Scenarios
        if (module.Scenarios.Count > 0)
        {
            sb.AppendLine("  <div class=\"section-card\">");
            sb.AppendLine("    <div class=\"section-label\">Case Studies</div>");
            sb.AppendLine($"    <p class=\"scenarios-intro\">The following scenarios are designed for group discussion. Consider each situation in the context of your role as {EscapeHtml(roleName)}.</p>");

            foreach (var scenario in module.Scenarios)
            {
                sb.AppendLine("    <div class=\"scenario-card\">");
                sb.AppendLine($"      <div class=\"scenario-title\">{EscapeHtml(scenario.Title)}</div>");
                sb.AppendLine("      <div class=\"scenario-section-label\">Situation</div>");
                sb.AppendLine($"      <p>{EscapeHtml(scenario.Description)}</p>");
                sb.AppendLine("      <div class=\"scenario-section-label\">Complication</div>");
                sb.AppendLine($"      <p>{EscapeHtml(scenario.Complication)}</p>");

                if (scenario.DiscussionQuestions.Count > 0)
                {
                    sb.AppendLine("      <div class=\"scenario-section-label\">Discussion Questions</div>");
                    sb.AppendLine("      <ul class=\"discussion-questions\">");
                    foreach (var dq in scenario.DiscussionQuestions)
                        sb.AppendLine($"        <li>{EscapeHtml(dq)}</li>");
                    sb.AppendLine("      </ul>");
                }

                sb.AppendLine("    </div>");
            }

            sb.AppendLine("  </div>");
        }

        // ── Bottom navigation
        AppendNav(sb, moduleIndex, totalModules, prevHref, nextHref);

        sb.AppendLine("</div>"); // container

        // ── Footer
        sb.AppendLine("<footer>");
        sb.AppendLine("  <div class=\"container\">");
        sb.AppendLine($"    <p>Generated by Mimir AI &mdash; {DateTime.UtcNow:MMMM d, yyyy}</p>");
        sb.AppendLine($"    <p>Module {moduleIndex} of {totalModules} &mdash; AMLR 2024/1624 Compliance Training</p>");
        sb.AppendLine("  </div>");
        sb.AppendLine("</footer>");

        // ── Embedded quiz script
        sb.AppendLine("<script>");
        sb.AppendLine($"  const quizData = {moduleQuizJson};");
        sb.AppendLine();
        sb.AppendLine("  function checkAnswer(index) {");
        sb.AppendLine("    const q = quizData[index];");
        sb.AppendLine("    const name = q.id;");
        sb.AppendLine("    const selected = document.querySelector('input[name=\"' + name + '\"]:checked');");
        sb.AppendLine("    if (!selected) { alert('Please select an answer before submitting.'); return; }");
        sb.AppendLine();
        sb.AppendLine("    const feedbackEl = document.getElementById('feedback_' + index);");
        sb.AppendLine("    const btn = document.getElementById('btn_' + index);");
        sb.AppendLine();
        sb.AppendLine("    if (selected.value === q.correctAnswer) {");
        sb.AppendLine("      feedbackEl.className = 'feedback correct';");
        sb.AppendLine("      feedbackEl.innerHTML = '&#10003; Correct! ' + escHtml(q.explanation);");
        sb.AppendLine("    } else {");
        sb.AppendLine("      feedbackEl.className = 'feedback incorrect';");
        sb.AppendLine("      feedbackEl.innerHTML = '&#10007; Incorrect. The correct answer is <strong>' + q.correctAnswer + '</strong>. ' + escHtml(q.explanation);");
        sb.AppendLine("    }");
        sb.AppendLine("    feedbackEl.style.display = 'block';");
        sb.AppendLine("    btn.disabled = true;");
        sb.AppendLine("    document.querySelectorAll('input[name=\"' + name + '\"]').forEach(r => r.disabled = true);");
        sb.AppendLine("  }");
        sb.AppendLine();
        sb.AppendLine("  function escHtml(str) {");
        sb.AppendLine("    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');");
        sb.AppendLine("  }");
        sb.AppendLine("</script>");

        sb.AppendLine("</body>");
        sb.AppendLine("</html>");
        return sb.ToString();
    }

    // ─── Quiz JSON ────────────────────────────────────────────────────────────

    private static string GenerateQuizDataJson(FullTrainingProgramResponse program)
    {
        var quizzes = program.Modules.Select((module, mi) => new
        {
            moduleId = $"module_{mi + 1}",
            questions = module.Objectives
                .SelectMany((obj, oi) => obj.QuizQuestions.Select((q, qi) => new
                {
                    id = $"q_{mi + 1}_{oi + 1}_{qi + 1}",
                    text = q.Text,
                    options = q.Options,
                    correctAnswer = q.CorrectAnswer,
                    explanation = q.Explanation
                }))
                .ToList()
        }).ToList();

        return JsonSerializer.Serialize(new { quizzes }, QuizJsonOptions);
    }

    // Builds the per-module flat question list used by the embedded JavaScript.
    // Each entry maps array index → question data including its radio-button name (q_{m}_{o}_{q}).
    private static string BuildModuleQuizJson(int moduleIndex, FullTrainingModuleResponse module)
    {
        var questions = module.Objectives
            .SelectMany((obj, oi) => obj.QuizQuestions.Select((q, qi) => new
            {
                id = $"q_{moduleIndex}_{oi + 1}_{qi + 1}",
                correctAnswer = q.CorrectAnswer,
                explanation = q.Explanation
            }))
            .ToList();

        return JsonSerializer.Serialize(questions, QuizJsonOptions);
    }

    // ─── Navigation ───────────────────────────────────────────────────────────

    private static void AppendNav(StringBuilder sb, int moduleIndex, int totalModules, string? prevHref, string? nextHref)
    {
        sb.AppendLine("  <nav class=\"module-nav\">");

        if (prevHref is not null)
            sb.AppendLine($"    <a href=\"{prevHref}\">&larr; Previous Module</a>");
        else
            sb.AppendLine("    <a class=\"disabled\">&larr; Previous Module</a>");

        sb.AppendLine($"    <span class=\"module-counter\">Module {moduleIndex} of {totalModules}</span>");

        if (nextHref is not null)
            sb.AppendLine($"    <a href=\"{nextHref}\">Next Module &rarr;</a>");
        else
            sb.AppendLine("    <a class=\"disabled\">Next Module &rarr;</a>");

        sb.AppendLine("  </nav>");
    }

    // ─── CSS ─────────────────────────────────────────────────────────────────

    private static void AppendCss(StringBuilder sb)
    {
        sb.AppendLine("  <style>");
        sb.AppendLine("    * { box-sizing: border-box; margin: 0; padding: 0; }");
        sb.AppendLine("    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f6f8; color: #2d3748; line-height: 1.7; }");
        sb.AppendLine("    .container { max-width: 960px; margin: 0 auto; padding: 0 24px 40px; }");
        sb.AppendLine("    header { background: #1a365d; color: white; padding: 28px 0; margin-bottom: 32px; }");
        sb.AppendLine("    header .container { padding-bottom: 0; }");
        sb.AppendLine("    .course-label { font-size: 0.78em; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.75; margin-bottom: 6px; }");
        sb.AppendLine("    header h1 { font-size: 1.55em; font-weight: 600; line-height: 1.3; }");
        sb.AppendLine("    .amlr-badge { display: inline-block; background: rgba(255,255,255,0.15); color: white; font-size: 0.75em; padding: 3px 10px; border-radius: 12px; margin-top: 10px; }");
        sb.AppendLine("    .section-card { background: white; border-radius: 8px; padding: 24px 28px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }");
        sb.AppendLine("    .section-label { font-size: 0.7em; text-transform: uppercase; letter-spacing: 1.5px; color: #718096; font-weight: 700; margin-bottom: 10px; }");
        sb.AppendLine("    h2 { font-size: 1.1em; color: #1a365d; margin-bottom: 14px; font-weight: 600; }");
        sb.AppendLine("    h3.quiz-heading { font-size: 0.95em; color: #2c5282; margin: 20px 0 10px; padding-top: 16px; border-top: 1px solid #e2e8f0; }");
        sb.AppendLine("    .objectives-list { list-style: none; padding: 0; }");
        sb.AppendLine("    .objectives-list li { padding: 6px 0 6px 24px; position: relative; color: #4a5568; }");
        sb.AppendLine("    .objectives-list li::before { content: '\\2713'; position: absolute; left: 0; color: #48bb78; font-weight: 700; }");
        sb.AppendLine("    .lesson-content { color: #4a5568; white-space: pre-wrap; font-size: 0.95em; }");
        sb.AppendLine("    .quiz-question { border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; margin: 14px 0; }");
        sb.AppendLine("    .quiz-question .question-text { font-weight: 600; color: #2d3748; margin-bottom: 14px; font-size: 0.95em; }");
        sb.AppendLine("    .option-label { display: flex; align-items: flex-start; padding: 9px 10px; border-radius: 5px; cursor: pointer; margin: 3px 0; transition: background 0.15s; }");
        sb.AppendLine("    .option-label:hover { background: #f7fafc; }");
        sb.AppendLine("    .option-label input[type=radio] { margin-right: 10px; margin-top: 4px; flex-shrink: 0; cursor: pointer; }");
        sb.AppendLine("    .option-label span { font-size: 0.92em; color: #4a5568; }");
        sb.AppendLine("    .submit-btn { background: #2b6cb0; color: white; border: none; padding: 8px 22px; border-radius: 5px; cursor: pointer; font-size: 0.88em; margin-top: 14px; transition: background 0.15s; }");
        sb.AppendLine("    .submit-btn:hover:not(:disabled) { background: #2c5282; }");
        sb.AppendLine("    .submit-btn:disabled { background: #a0aec0; cursor: default; }");
        sb.AppendLine("    .feedback { display: none; padding: 12px 16px; border-radius: 5px; margin-top: 12px; font-size: 0.9em; line-height: 1.5; }");
        sb.AppendLine("    .feedback.correct { background: #f0fff4; border: 1px solid #68d391; color: #22543d; }");
        sb.AppendLine("    .feedback.incorrect { background: #fff5f5; border: 1px solid #fc8181; color: #742a2a; }");
        sb.AppendLine("    .scenarios-intro { color: #718096; font-size: 0.9em; margin-bottom: 16px; font-style: italic; }");
        sb.AppendLine("    .scenario-card { border-left: 4px solid #ed8936; padding: 18px 20px; background: #fffaf0; border-radius: 0 8px 8px 0; margin: 14px 0; }");
        sb.AppendLine("    .scenario-title { font-weight: 700; color: #c05621; font-size: 1em; margin-bottom: 12px; }");
        sb.AppendLine("    .scenario-section-label { font-size: 0.75em; text-transform: uppercase; letter-spacing: 1px; color: #9c4221; font-weight: 700; margin: 12px 0 5px; }");
        sb.AppendLine("    .scenario-card p { color: #4a5568; font-size: 0.93em; }");
        sb.AppendLine("    .discussion-questions { list-style: none; padding: 0; margin: 6px 0 0; }");
        sb.AppendLine("    .discussion-questions li { padding: 5px 0 5px 22px; position: relative; color: #4a5568; font-size: 0.9em; font-style: italic; }");
        sb.AppendLine("    .discussion-questions li::before { content: '?'; position: absolute; left: 0; color: #ed8936; font-weight: 800; }");
        sb.AppendLine("    nav.module-nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; margin: 8px 0; }");
        sb.AppendLine("    nav.module-nav a { color: #2b6cb0; text-decoration: none; padding: 8px 18px; border: 1px solid #bee3f8; border-radius: 5px; font-size: 0.88em; background: #ebf8ff; transition: all 0.15s; }");
        sb.AppendLine("    nav.module-nav a:hover { background: #2b6cb0; color: white; border-color: #2b6cb0; }");
        sb.AppendLine("    nav.module-nav a.disabled { color: #cbd5e0; border-color: #e2e8f0; background: white; pointer-events: none; }");
        sb.AppendLine("    .module-counter { color: #718096; font-size: 0.88em; }");
        sb.AppendLine("    footer { text-align: center; color: #a0aec0; font-size: 0.8em; padding: 20px 0 48px; line-height: 2; }");
        sb.AppendLine("  </style>");
    }

    // ─── Utilities ────────────────────────────────────────────────────────────

    private static void AddTextEntry(ZipArchive zip, string entryPath, string content)
    {
        var entry = zip.CreateEntry(entryPath);
        using var writer = new StreamWriter(entry.Open(), Encoding.UTF8, leaveOpen: false);
        writer.Write(content);
    }

    private static string SanitizeIdentifier(string name) =>
        Regex.Replace(name.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');

    private static string EscapeXml(string? text) =>
        (text ?? string.Empty)
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;");

    private static string EscapeHtml(string? text) =>
        (text ?? string.Empty)
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;");
}
