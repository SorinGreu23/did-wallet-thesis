using System.Threading.RateLimiting;
using DID.Accreditation.Application.Auth;
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
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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
builder.Services.AddSingleton<IBlockchainRpcClient>(sp => sp.GetRequiredService<IBlockchainService>());

builder.Services.AddScoped<IAccreditationRepository, AccreditationRepository>();
builder.Services.AddScoped<IAccreditationService, AccreditationService>();

builder.Services.AddScoped<IEnterpriseRegistrationRepository, EnterpriseRegistrationRepository>();
builder.Services.AddScoped<EnterpriseRegistrationService>();

builder.Services.AddMassTransit(x =>
{
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

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var allowedOriginsAccreditation = builder.Configuration["Cors:AllowedOrigins"]
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? ["http://localhost:4200"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOriginsAccreditation)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddMemoryCache();
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection(AuthOptions.SectionName));
builder.Services.AddSingleton<AuthService>();

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

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("EURoot", p => p.RequireClaim("scope", "EURoot"))
    .AddPolicy("MemberState", p => p.RequireClaim("scope", "EURoot", "MemberState"))
    .AddPolicy("Ministry", p => p.RequireClaim("scope", "EURoot", "MemberState", "Ministry"))
    .AddPolicy("Institution", p => p.RequireClaim("scope", "EURoot", "MemberState", "Ministry", "Institution"))
    .AddPolicy("BusinessRegistry", p => p.RequireClaim("scope", "EURoot", "MemberState", "BusinessRegistry"))
    .AddPolicy("ClientWalletIssuer", p => p.RequireClaim("scope", "EURoot", "MemberState", "Ministry", "Institution", "BusinessRegistry"));

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

builder.WebHost.ConfigureKestrel(k =>
    k.Limits.MaxRequestBodySize = 512 * 1024);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AccreditationDbContext>();
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
app.UseRateLimiter();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment()) app.UseSwaggerGen();
app.UseFastEndpoints();
await app.RunAsync();
