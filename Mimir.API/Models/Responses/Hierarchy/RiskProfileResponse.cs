namespace Mimir.API.Models.Responses.Hierarchy;

public record RiskProfileResponse(
    Guid RoleId,
    string RoleName,
    string AmlRisk,
    string SanctionsRisk,
    string FraudRisk,
    string DocumentationRisk,
    string OperationalRisk
);
