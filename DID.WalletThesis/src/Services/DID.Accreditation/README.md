# DID Accreditation Service

Manages the lifecycle of accreditations between DIDs in the EU DID Wallet system. Accreditations form a trust hierarchy (MemberState → Ministry → Institution → Department) that authorises DIDs to issue credentials.

---

## Responsibilities

- Store and expose accreditations recorded from blockchain events (via RabbitMQ from BlockchainSync)
- Allow manual issuance and revocation during development/demo
- Verify whether an accreditation is currently active or revoked
- Consume `AccreditationIssuedEvent` and `AccreditationRevokedEvent` messages

---

## Tech Stack

| Concern | Library |
|---|---|
| API | FastEndpoints 8.0.1 |
| ORM | EF Core 10 + Npgsql |
| Messaging | MassTransit 8.3.5 + RabbitMQ |
| Docs | FastEndpoints.Swagger (NSwag) |
| Logging | Serilog |

---

## Prerequisites

Docker containers must be running:

```bash
docker-compose up postgres rabbitmq -d
```

Verify:
- PostgreSQL: `localhost:5432`
- RabbitMQ: `localhost:5672` (management UI: `http://localhost:15672`)

---

## Configuration (`appsettings.json`)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=did_accreditation;Username=did_user;Password=did_password"
  },
  "RabbitMQ": {
    "Host": "localhost",
    "Username": "did_user",
    "Password": "did_password"
  }
}
```

---

## Running

```bash
cd DID.WalletThesis/src/Services/DID.Accreditation

# First run — create migration
dotnet ef migrations add InitialCreate --context AccreditationDbContext

# Start service (applies migrations automatically on startup)
dotnet run
```

Service starts at `http://localhost:5211`.
Swagger UI: `http://localhost:5211/swagger`

---

## API Endpoints

### `POST /api/accreditations`
Issue a new accreditation (direct, for demo/testing — in production data arrives via blockchain events).

**Request body:**
```json
{
  "issuerDID": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "subjectDID": "did:ethr:sepolia:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "scope": "Institution",
  "parentAccreditationId": null
}
```

Valid `scope` values: `MemberState`, `Ministry`, `Institution`, `Department`

**Response 201:**
```json
{
  "accreditationId": "0x9b1deb4d3b7d4bad9bdd2b96a7d62194",
  "issuerDID": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "subjectDID": "did:ethr:sepolia:0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "parentAccreditationId": null,
  "scope": "Institution",
  "status": "Active",
  "blockNumber": 0,
  "transactionHash": "",
  "issuedAt": "2026-03-02T10:00:00Z",
  "revokedAt": null,
  "revokedByDID": null
}
```

---

### `GET /api/accreditations`
List all accreditations, optionally filtered.

| Query param | Description |
|---|---|
| `issuerDid` | Filter by issuer DID |
| `subjectDid` | Filter by subject DID |

**Response 200** — array of accreditation objects.

---

### `GET /api/accreditations/{accreditationId}`
Resolve a single accreditation by its ID.

**Response 200** — accreditation object
**Response 404** — not found

---

### `GET /api/accreditations/{accreditationId}/verify`
Check whether an accreditation is currently valid.

**Response 200 (active):**
```json
{
  "accreditationId": "0x9b1deb4d3b7d4bad9bdd2b96a7d62194",
  "isValid": true,
  "status": "Active",
  "reason": null
}
```

**Response 200 (revoked):**
```json
{
  "accreditationId": "0x9b1deb4d3b7d4bad9bdd2b96a7d62194",
  "isValid": false,
  "status": "Revoked",
  "reason": "Revoked at 2026-03-02T11:00:00Z by did:ethr:sepolia:0xf39..."
}
```

**Response 200 (not found):**
```json
{
  "isValid": false,
  "status": "NotFound",
  "reason": "Accreditation does not exist"
}
```

---

### `DELETE /api/accreditations/{accreditationId}`
Revoke an accreditation.

**Request body:**
```json
{
  "revokedByDID": "did:ethr:sepolia:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

**Response 204** — revoked successfully
**Response 404** — accreditation not found

---

## Events Consumed

| Event | Source | Effect |
|---|---|---|
| `AccreditationIssuedEvent` | BlockchainSync | Stores new accreditation with `Active` status |
| `AccreditationRevokedEvent` | BlockchainSync | Updates existing accreditation to `Revoked` status |

---

## Database Schema

```sql
CREATE TABLE accreditations (
    id UUID PRIMARY KEY,
    accreditation_id VARCHAR(200) UNIQUE NOT NULL,
    issuer_did VARCHAR(200) NOT NULL,
    subject_did VARCHAR(200) NOT NULL,
    parent_accreditation_id VARCHAR(200),
    scope VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_hash VARCHAR(200),
    issued_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revoked_by_did VARCHAR(200),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP
);
```

---

## Trust Hierarchy

```
MemberState  (e.g. Romania)
    └── Ministry  (e.g. Ministry of Education)
            └── Institution  (e.g. University)
                    └── Department  (e.g. Faculty of CS)
```

Each level accredits the next. `parentAccreditationId` links a child accreditation to its parent in the chain.

---

## Project Structure

```
DID.Accreditation/
├── Domain/
│   ├── Accreditation.cs
│   └── Interfaces/
│       └── IAccreditationRepository.cs
├── Application/
│   ├── DTOs/
│   │   └── AccreditationDto.cs
│   └── Services/
│       └── AccreditationService.cs
├── Infrastructure/
│   ├── Consumers/
│   │   ├── AccreditationIssuedConsumer.cs
│   │   └── AccreditationRevokedConsumer.cs
│   └── Persistence/
│       ├── AccreditationDbContext.cs
│       └── AccreditationRepository.cs
├── Endpoints/
│   ├── IssueAccreditationEndpoint.cs
│   ├── ResolveAccreditationEndpoint.cs
│   ├── ListAccreditationsEndpoint.cs
│   ├── VerifyAccreditationEndpoint.cs
│   └── RevokeAccreditationEndpoint.cs
├── Migrations/
├── Program.cs
└── appsettings.json
```
