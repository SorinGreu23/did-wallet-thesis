using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Blockchain;
using DID.Shared.Infrastructure.Options;
using DID.Verification.Application.Services;
using FastEndpoints;
using FastEndpoints.Swagger;
using MassTransit;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSerilog((_, lc) => lc
    .ReadFrom.Configuration(builder.Configuration)
    .WriteTo.Console());

builder.Services.Configure<BlockchainOptions>(
    builder.Configuration.GetSection(BlockchainOptions.SectionName));
builder.Services.AddSingleton<IBlockchainService, BlockchainService>();

builder.Services.AddHttpClient<ZkpServiceClient>(client =>
    client.BaseAddress = new Uri(
        builder.Configuration["ZkpService:BaseUrl"] ?? "http://localhost:3000"));

builder.Services.AddScoped<VerificationService>();

builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"], h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"]!);
            h.Password(builder.Configuration["RabbitMQ:Password"]!);
        });

        cfg.ConfigureEndpoints(ctx);
    });
});

builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument(o =>
{
    o.DocumentSettings = s =>
    {
        s.Title = "DID Verification Service";
        s.Version = "v1";
        s.Description = "On-chain credential verification with optional ZKP proof delegation";
    };
});

var app = builder.Build();

app.UseSwaggerGen();
app.UseHttpsRedirection();
app.UseFastEndpoints();
await app.RunAsync();
