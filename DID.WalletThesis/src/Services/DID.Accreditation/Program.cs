using DID.Accreditation.Application.Services;
using DID.Accreditation.Domain.Interfaces;
using DID.Accreditation.Infrastructure.Consumers;
using DID.Accreditation.Infrastructure.Persistence;
using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Blockchain;
using DID.Shared.Infrastructure.Options;
using FastEndpoints;
using FastEndpoints.Swagger;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSerilog((_, lc) => lc
    .ReadFrom.Configuration(builder.Configuration)
    .WriteTo.Console());

builder.Services.AddDbContext<AccreditationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.Configure<BlockchainOptions>(
    builder.Configuration.GetSection(BlockchainOptions.SectionName));
builder.Services.AddSingleton<IBlockchainService, BlockchainService>();

builder.Services.AddScoped<IAccreditationRepository, AccreditationRepository>();
builder.Services.AddScoped<AccreditationService>();

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<AccreditationIssuedConsumer>();
    x.AddConsumer<AccreditationRevokedConsumer>();

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

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument(o =>
{
    o.DocumentSettings = s =>
    {
        s.Title = "DID Accreditation Service";
        s.Version = "v1";
        s.Description = "Accreditation lifecycle management and verification";
    };
});

var app = builder.Build();

app.UseSwaggerGen();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AccreditationDbContext>();
    await db.Database.MigrateAsync();
}

app.UseCors();
app.UseHttpsRedirection();
app.UseFastEndpoints();
await app.RunAsync();
