using Microsoft.EntityFrameworkCore;
using Mimir.API.Data;
using Mimir.API.Data.Repositories;
using Mimir.API.Endpoints;
using Mimir.API.Pipeline;
using Mimir.API.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. Repositories and services
builder.Services.AddScoped<IDocumentRepository, DocumentRepository>();
builder.Services.AddScoped<IOutlineRepository, OutlineRepository>();
builder.Services.AddScoped<IHierarchyRepository, HierarchyRepository>();
builder.Services.AddScoped<IDocumentVaultRepository, DocumentVaultRepository>();

builder.Services.AddScoped<IDocumentService, DocumentService>();
builder.Services.AddScoped<IParsingService, ParsingService>();
builder.Services.AddScoped<IAnalysisService, AnalysisService>();
builder.Services.AddScoped<ICitationService, CitationService>();
builder.Services.AddScoped<IHierarchyService, HierarchyService>();
builder.Services.AddScoped<IDocumentVaultService, DocumentVaultService>();
builder.Services.AddScoped<IDocumentPipeline, DocumentPipeline>();

// 3. CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// 5. Ensure upload directory exists
Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "Uploads"));

// 6. Middleware
app.UseCors();

// 7. Endpoints
app.MapDocumentEndpoints();
app.MapAnalysisEndpoints();
app.MapHierarchyEndpoints();
app.MapVaultEndpoints();

// 8. TODO: validate Groq:ApiKey on startup — throw if empty so misconfiguration is caught early

app.Run();
