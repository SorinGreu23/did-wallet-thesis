using DID.Presentation.Application.Services;
using FastEndpoints;
using FastEndpoints.Swagger;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSerilog((_, lc) => lc
    .ReadFrom.Configuration(builder.Configuration)
    .WriteTo.Console());

builder.Services.AddHttpClient<VerificationServiceClient>(client =>
    client.BaseAddress = new Uri(
        builder.Configuration["VerificationService:BaseUrl"] ?? "http://localhost:5002"));

builder.Services.AddSingleton<PresentationService>();

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument(o =>
{
    o.DocumentSettings = s =>
    {
        s.Title = "DID Presentation Service";
        s.Version = "v1";
        s.Description = "Presentation challenge/response protocol. Verifiers create challenges; wallets submit presentations; each credential is verified on-chain via DID.Verification.";
    };
});

var app = builder.Build();

app.UseSwaggerGen();
app.UseCors();
app.UseHttpsRedirection();
app.UseFastEndpoints();
await app.RunAsync();
