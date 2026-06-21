using DID.Identity.Application.Services;
using DID.Identity.Domain.Interfaces;
using DID.Identity.Infrastructure.Cryptography;
using DID.Identity.Infrastructure.Persistence;
using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.EventBus;
using FastEndpoints;
using FastEndpoints.Swagger;
using MassTransit;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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

var jwtSecret = builder.Configuration["Auth:JwtSecret"] ?? throw new InvalidOperationException(
    "Auth:JwtSecret must be set via environment variable or secrets manager.");
var keyBytes = System.Text.Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Auth:Issuer"] ?? "did-accreditation",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Auth:Audience"] ?? "did-accreditation",
            ClockSkew = TimeSpan.Zero,
        };
    });

builder.Services.AddAuthorization();

var allowedOriginsIdentity = builder.Configuration["Cors:AllowedOrigins"]
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? ["http://localhost:4200"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOriginsIdentity)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

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

builder.WebHost.ConfigureKestrel(k =>
    k.Limits.MaxRequestBodySize = 512 * 1024);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    await db.Database.MigrateAsync();
}

app.UseDefaultExceptionHandler();
app.UseHttpsRedirection();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment()) app.UseSwaggerGen();
app.UseFastEndpoints();
await app.RunAsync();
