namespace Mimir.API.Models.Responses;

public class RegulatoryBasisResponse
{
    public int AmlrArticle { get; set; }
    public required string ArticleTitle { get; set; }
}
