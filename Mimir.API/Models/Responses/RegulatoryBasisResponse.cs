using System.Text.Json;
using System.Text.Json.Serialization;

namespace Mimir.API.Models.Responses;

public class RegulatoryBasisResponse
{
    [JsonConverter(typeof(AmlrArticleConverter))]
    public string AmlrArticle { get; set; } = "";
    public required string ArticleTitle { get; set; }
}

/// <summary>
/// Tolerates the three shapes Gemini uses for amlrArticle:
///   integer  →  6            serialised as "6"
///   string   →  "Preamble"   serialised as-is
///   array    →  [6, 25, 26]  serialised as "6, 25, 26"
/// </summary>
public class AmlrArticleConverter : JsonConverter<string>
{
    public override string Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.Number => reader.GetInt32().ToString(),
            JsonTokenType.String => reader.GetString() ?? "",
            JsonTokenType.StartArray => ReadArray(ref reader),
            _ => ""
        };
    }

    private static string ReadArray(ref Utf8JsonReader reader)
    {
        var values = new List<string>();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            if (reader.TokenType == JsonTokenType.Number)
                values.Add(reader.GetInt32().ToString());
            else if (reader.TokenType == JsonTokenType.String)
                values.Add(reader.GetString() ?? "");
        }
        return string.Join(", ", values);
    }

    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options)
        => writer.WriteStringValue(value);
}
