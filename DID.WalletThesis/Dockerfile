# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG SERVICE_NAME
WORKDIR /src

# Copy only project manifests first so the restore layer is cached
# independently of source changes.
COPY DID.WalletThesis.sln .
COPY src/Services/Directory.Build.props src/Services/
COPY src/Services/DID.Identity/DID.Identity.csproj           src/Services/DID.Identity/
COPY src/Services/DID.Accreditation/DID.Accreditation.csproj src/Services/DID.Accreditation/
COPY src/Services/DID.BlockchainSync/DID.BlockchainSync.csproj src/Services/DID.BlockchainSync/
COPY src/Services/DID.Credential/DID.Credential.csproj       src/Services/DID.Credential/
COPY src/Services/DID.Presentation/DID.Presentation.csproj   src/Services/DID.Presentation/
COPY src/Services/DID.Notification/DID.Notification.csproj   src/Services/DID.Notification/
COPY src/Services/DID.Audit/DID.Audit.csproj                  src/Services/DID.Audit/
COPY src/Contracts/DID.Contracts/DID.Contracts.csproj                          src/Contracts/DID.Contracts/
COPY src/Shared/DID.Shared.Domain/DID.Shared.Domain.csproj                    src/Shared/DID.Shared.Domain/
COPY src/Shared/DID.Shared.Infrastructure/DID.Shared.Infrastructure.csproj    src/Shared/DID.Shared.Infrastructure/
COPY src/Shared/DID.Shared.Application/DID.Shared.Application.csproj          src/Shared/DID.Shared.Application/

RUN dotnet restore "src/Services/${SERVICE_NAME}/${SERVICE_NAME}.csproj"

# Now copy the full source — cache miss here does NOT re-run restore.
COPY src/ src/

RUN dotnet publish "src/Services/${SERVICE_NAME}/${SERVICE_NAME}.csproj" \
    -c Release -o /app/publish --no-restore

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
# aspnet:10.0 is a superset of runtime:10.0 and works for both web services
# and background Worker services.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
ARG SERVICE_NAME

# Nethereum's RPC/WebSocket client resolves GSSAPI at runtime on Linux.
# The aspnet:10.0 Ubuntu 24.04 base image is minimised and omits this library,
# causing "libgssapi_krb5.so.2: cannot open shared object file" on startup.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*

# aspnet:10.0 ships with a built-in non-root 'app' user — use it directly.
WORKDIR /app
COPY --from=build --chown=app:app /app/publish .

USER app

# Bake the DLL name into an env var; use exec so dotnet is PID 1 and
# receives SIGTERM directly on docker stop (graceful shutdown).
ENV SERVICE_DLL="${SERVICE_NAME}.dll"
ENTRYPOINT ["sh", "-c", "exec dotnet $SERVICE_DLL"]
