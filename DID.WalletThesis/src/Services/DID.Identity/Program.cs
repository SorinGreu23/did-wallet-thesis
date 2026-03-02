using DID.Identity.Application.Services;
using DID.Identity.Domain.Interfaces;
using DID.Identity.Infrastructure.Cryptography;
using DID.Identity.Infrastructure.Persistence;
using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.EventBus;
using FastEndpoints;
using FastEndpoints.Swagger;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSerilog((_, lc) => lc
    .ReadFrom.Configuration(builder.Configuration)
    .WriteTo.Console());

builder.Services.AddDbContext<IdentityDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<IDIDRepository, DIDRepository>();
builder.Services.AddSingleton<IKeyGenerator, KeyGenerator>();

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

builder.Services.AddScoped<DID.Shared.Application.Interfaces.IEventBus>(sp =>
    new RabbitMQEventBus(sp.GetRequiredService<IPublishEndpoint>()));
builder.Services.AddScoped<DIDService>();
builder.Services.AddFastEndpoints();
builder.Services.SwaggerDocument(o =>
{
    o.DocumentSettings = s =>
    {
        s.Title = "DID Identity Service";
        s.Version = "v1";
        s.Description = "DID document generation and key pair management";
    };
});

var app = builder.Build();

app.UseSwaggerGen();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    await db.Database.MigrateAsync();
}

app.UseHttpsRedirection();
app.UseFastEndpoints();
await app.RunAsync();
