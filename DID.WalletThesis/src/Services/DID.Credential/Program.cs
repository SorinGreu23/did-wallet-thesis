using DID.Credential.Application.Services;
using DID.Credential.Domain.Interfaces;
using DID.Credential.Infrastructure.Consumers;
using DID.Credential.Infrastructure.Persistence;
using DID.Shared.Application.Interfaces;
using DID.Shared.Infrastructure.Blockchain;
using DID.Shared.Infrastructure.Options;
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

builder.Services.AddDbContext<CredentialDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.Configure<BlockchainOptions>(
    builder.Configuration.GetSection(BlockchainOptions.SectionName));
builder.Services.AddSingleton<IBlockchainService, BlockchainService>();

builder.Services.AddScoped<ICredentialRepository, CredentialRepository>();
builder.Services.AddScoped<CredentialService>();

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<CredentialIssuedConsumer>();
    x.AddConsumer<CredentialRevokedConsumer>();
    x.AddConsumer<CredentialSuspendedConsumer>();

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
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddFastEndpoints();

var jwtSecret = builder.Configuration["Auth:JwtSecret"] ?? "THIS_IS_A_DEV_SECRET_CHANGE_IN_PRODUCTION_MIN_32_CHARS!!";
var keyBytes = System.Text.Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero,
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("EURoot", p => p.RequireClaim("scope", "EURoot"))
    .AddPolicy("MemberState", p => p.RequireClaim("scope", "EURoot", "MemberState"))
    .AddPolicy("Ministry", p => p.RequireClaim("scope", "EURoot", "MemberState", "Ministry"))
    .AddPolicy("Institution", p => p.RequireClaim("scope", "EURoot", "MemberState", "Ministry", "Institution"));

builder.Services.SwaggerDocument(o =>
{
    o.DocumentSettings = s =>
    {
        s.Title = "DID Credential Service";
        s.Version = "v1";
        s.Description = "Credential lifecycle management and verification";
    };
});

var app = builder.Build();

app.UseSwaggerGen();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CredentialDbContext>();
    await db.Database.MigrateAsync();
}

app.UseCors();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.UseFastEndpoints();
await app.RunAsync();
