using Microsoft.Extensions.Configuration;
using Mimir.API.Data.Repositories;
using Mimir.API.Models.Responses;

namespace Mimir.API.Services;

public class AnalysisService(
    IDocumentRepository documentRepository,
    IOutlineRepository outlineRepository,
    ICitationService citationService,
    IConfiguration configuration,
    ILogger<AnalysisService> logger) : IAnalysisService
{
    public async Task<TrainingOutlineResponse> AnalyzeDocumentAsync(Guid documentId, string regulationType)
    {
        _ = (documentRepository, outlineRepository, citationService, configuration, logger);
        // TODO: load chunks via documentRepository.GetChunksAsync(documentId)
        // TODO: read prompt from Prompts/ExtractRequirements.txt
        // TODO: inject chunk content into the prompt as context
        // TODO: call Groq via OpenAI SDK — override BaseUrl from configuration["Groq:BaseUrl"]
        //       and use ApiKey from configuration["Groq:ApiKey"] and Model from configuration["Groq:Model"]
        // TODO: parse JSON response into a list of requirement strings
        // TODO: call GenerateOutlineAsync(requirements, documentId, regulationType)
        // TODO: serialize outline to JSON and save via outlineRepository.SaveOutlineAsync()
        await Task.CompletedTask;
        throw new NotImplementedException();
    }

    public async Task<TrainingOutlineResponse> GenerateOutlineAsync(List<string> requirements, Guid documentId, string regulationType)
    {
        // TODO: read prompt from Prompts/GenerateOutline.txt
        // TODO: inject requirements into the prompt
        // TODO: call Groq API (same client as AnalyzeDocumentAsync)
        // TODO: parse JSON response into TrainingOutlineResponse shape
        // TODO: for each citation claim in the response, call citationService.MatchClaimToChunk()
        //       and citationService.BuildCitation() to populate CitationResponse objects
        await Task.CompletedTask;
        throw new NotImplementedException();
    }
}
