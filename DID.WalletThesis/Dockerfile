# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG SERVICE_NAME
WORKDIR /src

# Copy solution manifest and all source projects so dotnet restore can
# resolve the full dependency graph (including shared projects).
COPY DID.WalletThesis.sln .
COPY src/ src/

RUN dotnet restore "src/Services/${SERVICE_NAME}/${SERVICE_NAME}.csproj"

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

# Bake the DLL name into an env var so the shell-form ENTRYPOINT can expand it.
ENV SERVICE_DLL="${SERVICE_NAME}.dll"

WORKDIR /app
COPY --from=build /app/publish .

# Use shell form so $SERVICE_DLL is expanded at container start time.
ENTRYPOINT ["sh", "-c", "dotnet $SERVICE_DLL"]
