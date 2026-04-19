# DID Identity Service

Manages DID document generation and secp256k1 key pair storage for the EU DID Wallet system.

**DID format:** `did:ethr:sepolia:{ethereumAddress}`

---

## Responsibilities

- Generate `did:ethr:sepolia` identifiers from an Ethereum controller address
- Generate and store secp256k1 key pairs (public key stored in plaintext, private key AES-256 encrypted)
- Serve W3C-compatible DID documents

> **Authorization note:** This service does NOT gatekeep DID creation. Any Ethereum address can register a DID. Authorization happens at the accreditation level via smart contracts.

---

## Tech Stack

| Concern | Library |
|---|---|
| API | FastEndpoints 8.0.1 |
| ORM | EF Core 10 + Npgsql |
| Messaging | MassTransit 8.3.5 + RabbitMQ |
| Key generation | Nethereum 5.8.0 (`EthECKey`) |
| Encryption | AES-256 (built-in `System.Security.Cryptography`) |
| Docs | FastEndpoints.Swagger (NSwag) |
| Logging | Serilog |

---

## Prerequisites

Docker containers must be running:

```bash
docker-compose up -d
```

Verify:
- PostgreSQL: `localhost:5432`
- RabbitMQ: `localhost:5672` (management UI: `http://localhost:15672`)

---

## Configuration (`appsettings.json`)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=did_identity;Username=did_user;Password=did_password"
  },
  "RabbitMQ": {
    "Host": "localhost",
    "Username": "did_user",
    "Password": "did_password"
  },
  "Encryption": {
    "Key": "<base64-encoded 32-byte AES key>"
  }
}
```

### Generate encryption key (PowerShell)

```powershell
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

For local dev only, you can use the zero key:
```
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
```

---

## Running

```bash
cd DID.WalletThesis/src/Services/DID.Identity

# First run — create migration
dotnet ef migrations add InitialCreate --output-dir Migrations

# Start service (applies migrations automatically on startup)
dotnet run
```

Service starts at `http://localhost:5259`.
Swagger UI: `http://localhost:5259/swagger`

---

## API Endpoints

### `POST /api/dids`
Create a new DID for an Ethereum address.

**Request body:**
```json
{
  "controllerAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

**Response 201:**
```json
{
  "id": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "controller": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "verificationMethod": [
    {
      "id": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266#keys-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "publicKeyHex": "04a1b2c3..."
    }
  ],
  "authentication": ["did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266#keys-1"],
  "assertionMethod": ["did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266#keys-1"],
  "created": "2026-03-02T07:13:00Z"
}
```

**Response 409** — DID already exists for that address.

---

### `GET /api/dids/{did}`
Resolve a DID document.

> URL-encode the DID: colons become `%3A`
> Example: `did%3Aethr%3Asepolia%3A0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

**Response 200** — DID document (same shape as POST response)
**Response 404** — DID not found

---

### `GET /api/dids/{did}/keys`
List public keys for a DID.

**Response 200:**
```json
[
  {
    "id": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266#keys-1",
    "type": "EcdsaSecp256k1VerificationKey2019",
    "controller": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "publicKey": "04a1b2c3...",
    "purpose": "authentication,assertionMethod"
  }
]
```

**Response 404** — DID not found

---

## Database Schema

```sql
CREATE TABLE dids (
    id UUID PRIMARY KEY,
    did VARCHAR(200) UNIQUE NOT NULL,
    controller_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP
);

CREATE TABLE key_pairs (
    id UUID PRIMARY KEY,
    did_id UUID NOT NULL REFERENCES dids(id) ON DELETE CASCADE,
    key_type VARCHAR(50) NOT NULL,
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    purpose VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP
);
```

---

## Project Structure

```
DID.Identity/
├── Domain/
│   ├── Entities/
│   │   ├── DecentralizedIdentifier.cs
│   │   └── KeyPair.cs
│   └── Interfaces/
│       └── IDIDRepository.cs
├── Application/
│   ├── DTOs/
│   │   └── DIDDocumentDto.cs
│   └── Services/
│       └── DIDService.cs
├── Infrastructure/
│   ├── Cryptography/
│   │   └── KeyGenerator.cs
│   └── Persistence/
│       ├── IdentityDbContext.cs
│       └── DIDRepository.cs
├── Endpoints/
│   ├── CreateDIDEndpoint.cs
│   ├── ResolveDIDEndpoint.cs
│   └── GetDIDKeysEndpoint.cs
├── Migrations/
├── Program.cs
└── appsettings.json
```
