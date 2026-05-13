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
builder.Services.AddScoped<IRoleTrainingService, RoleTrainingService>();
builder.Services.AddScoped<IDocumentPipeline, DocumentPipeline>();

// 3. OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Mimir API", Version = "v1" });
});

// 4. CORS
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

// 5. Swagger (development only)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 6. Ensure upload directory exists
Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "Uploads"));

// 7. Middleware
app.UseCors();

// 8. Endpoints
app.MapDocumentEndpoints();
app.MapAnalysisEndpoints();
app.MapHierarchyEndpoints();
app.MapVaultEndpoints();

// 8. TODO: validate Groq:ApiKey on startup — throw if empty so misconfiguration is caught early

app.Run();
