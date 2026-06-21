using DID.BlockchainSync.Application.Handlers;
using DID.BlockchainSync.Application.Services;
using DID.BlockchainSync.Domain.Interfaces;
using DID.BlockchainSync.Infrastructure.Blockchain;
using DID.BlockchainSync.Infrastructure.Persistence;
using DID.BlockchainSync.Workers;
using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Blockchain;
using DID.Shared.Infrastructure.EventBus;
using DID.Shared.Infrastructure.Options;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = Host.CreateApplicationBuilder(args);

// Serilog
builder.Services.AddSerilog((_, lc) => lc
    .ReadFrom.Configuration(builder.Configuration)
    .WriteTo.Console());

// Blockchain options + service (singleton — holds Web3 connection)
builder.Services.Configure<BlockchainOptions>(
    builder.Configuration.GetSection(BlockchainOptions.SectionName));
builder.Services.AddSingleton<IBlockchainService, BlockchainService>();
builder.Services.AddSingleton<IBlockchainRpcClient>(sp => sp.GetRequiredService<IBlockchainService>());

// Database
builder.Services.AddDbContext<SyncDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Repository (scoped — wraps DbContext)
builder.Services.AddScoped<ISyncRepository, SyncRepository>();

// MassTransit + RabbitMQ
builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((_, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"], h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"]!);
            h.Password(builder.Configuration["RabbitMQ:Password"]!);
        });
    });
});

// Event bus (scoped — wraps IPublishEndpoint)
builder.Services.AddScoped<IEventBus, RabbitMQEventBus>();

// Application (all scoped — depend on scoped services)
builder.Services.AddScoped<AccreditationEventHandler>();
builder.Services.AddScoped<CredentialEventHandler>();
builder.Services.AddScoped<EventListener>();
builder.Services.AddScoped<EventProcessingService>();

// Worker
builder.Services.AddHostedService<BlockchainSyncWorker>();

var host = builder.Build();

// Apply DB migrations on startup
using (var scope = host.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SyncDbContext>();
    await db.Database.MigrateAsync();
}

await host.RunAsync();
