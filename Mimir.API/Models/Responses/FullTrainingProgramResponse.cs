namespace Mimir.API.Models.Responses;

public class FullTrainingProgramResponse
{
    public Guid RoleId { get; set; }
    public required string RoleName { get; set; }
    public string RegulationType { get; set; } = "AMLR 2024/1624";
    public Dictionary<string, string>? RiskProfile { get; set; }
    public List<FullTrainingModuleResponse> Modules { get; set; } = [];
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
