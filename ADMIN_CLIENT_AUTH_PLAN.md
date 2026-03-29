# Admin Client — Authentication & Security Development Plan

> Scope: EU Decentralized Digital Identity Accreditation Platform
> Stack: Angular 21 · .NET 10 FastEndpoints · Ethereum (Hardhat/Sepolia) · DID:ethr
> Principle: **Blockchain is the source of truth — not microservices.**

---

## Table of Contents

1. [Current State & Gap Analysis](#1-current-state--gap-analysis)
2. [Design Principles](#2-design-principles)
3. [Authentication Architecture](#3-authentication-architecture)
4. [Client-Side Signing (Eliminate Private Key Transport)](#4-client-side-signing-eliminate-private-key-transport)
5. [Angular Implementation Plan](#5-angular-implementation-plan)
6. [Backend (.NET) Implementation Plan](#6-backend-net-implementation-plan)
7. [Role-Based Access via On-Chain Accreditation](#7-role-based-access-via-on-chain-accreditation)
8. [Security Hardening](#8-security-hardening)
9. [Implementation Phases](#9-implementation-phases)
10. [Out of Scope (Thesis Boundaries)](#10-out-of-scope-thesis-boundaries)

---

## 1. Current State & Gap Analysis

### What exists

| Component | Status |
|-----------|--------|
| Angular 21 admin client with hierarchy navigation | Working |
| Member State / Ministry / University CRUD via HTTP | Working |
| Diploma issuance and revocation | Working |
| Proxy config routing to 3 microservices | Configured |
| Trust chain visualization and verification | Working |

### Critical gaps

| Gap | Risk | Severity |
|-----|------|----------|
| **No authentication** — any user can access all admin routes | Unauthorized accreditation issuance | Critical |
| **Private keys sent in HTTP request bodies** (`issuerPrivateKey` field in `IssueAccreditationRequest`, `IssueCredentialRequest`) | Key interception via logs, proxies, or MITM | Critical |
| **No route guards** — all routes are publicly accessible | Unauthorized navigation to admin functions | High |
| **No HTTP interceptor** — no auth headers on API calls | Backend cannot identify callers | High |
| **No session management** — no login, logout, or expiry | No accountability trail | High |
| **No RBAC** — a Ministry operator can invoke EU Root actions | Privilege escalation | Medium |
| **No CSRF protection** on state-changing endpoints | Cross-site request forgery | Medium |
| **No audit trail** for admin actions | Non-repudiation gap | Medium |

---

## 2. Design Principles

These principles derive from the thesis claim that blockchain replaces centralized authorization.

1. **DID-Auth, not OAuth.** Users authenticate by proving control of a DID private key via challenge–response. No centralized identity provider, no passwords, no session cookies managed by a third party. This is consistent with the self-sovereign identity model.

2. **Client-side signing only.** Private keys never leave the browser. Transactions and authentication challenges are signed locally using `ethers.js`. The backend receives signed payloads, never raw keys.

3. **On-chain RBAC.** The admin client does not hardcode roles. Instead, it queries `AccreditationRegistry.sol` to determine what scope (MemberState, Ministry, Institution) a DID is accredited for, and restricts the UI accordingly. The smart contract is the authorizer.

4. **Backend verifies, never decides.** Microservices verify the DID-Auth signature and check the caller's on-chain accreditation status before forwarding transactions. They do not maintain their own role tables.

5. **Defense in depth.** Even though the smart contract rejects unauthorized transactions, the admin client and backend must still enforce access control to prevent wasted gas, improve UX, and provide audit logs.

---

## 3. Authentication Architecture

### 3.1 DID-Auth Challenge–Response Flow

```
┌─────────────┐                 ┌───────────────────┐              ┌──────────────┐
│ Admin Client │                 │ Accreditation API  │              │  Blockchain  │
│  (Angular)   │                 │     (.NET 10)      │              │  (Hardhat)   │
└──────┬───────┘                 └────────┬───────────┘              └──────┬───────┘
       │                                  │                                 │
       │  1. POST /api/auth/challenge     │                                 │
       │  { did: "did:ethr:sepolia:0x…" } │                                 │
       │ ───────────────────────────────► │                                 │
       │                                  │                                 │
       │  2. { nonce, expiresAt }         │                                 │
       │ ◄─────────────────────────────── │                                 │
       │                                  │                                 │
       │  3. Sign nonce with ethers.js    │                                 │
       │     (key never leaves browser)   │                                 │
       │                                  │                                 │
       │  4. POST /api/auth/verify        │                                 │
       │  { did, nonce, signature }       │                                 │
       │ ───────────────────────────────► │                                 │
       │                                  │  5. Recover signer address      │
       │                                  │     from signature              │
       │                                  │                                 │
       │                                  │  6. Verify address matches DID  │
       │                                  │ ──────────────────────────────► │
       │                                  │                                 │
       │                                  │  7. Query accreditation scope   │
       │                                  │ ──────────────────────────────► │
       │                                  │                                 │
       │  8. { token (JWT), scope,        │                                 │
       │       accreditationId, expiresAt }│                                │
       │ ◄─────────────────────────────── │                                 │
       │                                  │                                 │
       │  9. Subsequent requests include  │                                 │
       │     Authorization: Bearer <token>│                                 │
       │ ───────────────────────────────► │                                 │
```

### 3.2 JWT Token Structure

The JWT issued by the backend is a **short-lived session token** (not a long-lived API key). It contains claims derived from the blockchain at authentication time:

```json
{
  "sub": "did:ethr:sepolia:0xABC…",
  "eth_address": "0xABC…",
  "scope": "Ministry",
  "accreditation_id": "0x7f3a…",
  "parent_accreditation_id": "0x1b2c…",
  "iat": 1711700000,
  "exp": 1711703600
}
```

- **`scope`** — Highest accreditation level the DID holds (EURoot, MemberState, Ministry, Institution). Drives UI visibility and backend authorization.
- **`accreditation_id`** — The specific accreditation backing this session. If revoked on-chain during the session, the backend rejects further requests.
- **Expiry** — 1 hour. No refresh tokens for thesis scope; user re-authenticates with a new challenge.

### 3.3 Why Not MetaMask / WalletConnect?

For thesis scope, the admin client uses a **paste-your-private-key-to-sign-in-memory** approach (key held in a JavaScript variable for the session duration, never persisted, never transmitted). This avoids:

- External browser extension dependency (MetaMask)
- WalletConnect relay server infrastructure
- Complex cross-origin communication

The same signing flow would work with MetaMask in production — only the `ethers.Signer` source changes. The plan notes this as a future extension.

---

## 4. Client-Side Signing (Eliminate Private Key Transport)

### 4.1 Current Problem

```typescript
// CURRENT — private key sent over HTTP (critical vulnerability)
this.accreditationService.issue({
  issuerDID: '...',
  subjectDID: '...',
  scope: 'Ministry',
  issuerPrivateKey: '0xdeadbeef…',  // <-- in the request body
});
```

### 4.2 Target Architecture

```typescript
// TARGET — transaction signed in the browser, only the signature is transmitted
const tx = await this.signerService.signAccreditationTx(subjectDID, scope, parentId);
this.accreditationService.issue({
  issuerDID: '...',
  subjectDID: '...',
  scope: 'Ministry',
  signedTransaction: tx,  // pre-signed, backend just relays to blockchain
});
```

### 4.3 Two Viable Approaches

| Approach | Description | Thesis fit |
|----------|-------------|------------|
| **A. Backend relays signed tx** | Client signs a raw Ethereum transaction with `ethers.js`, backend sends it via `eth_sendRawTransaction`. Private key never leaves the browser. | Best for thesis — demonstrates true decentralization |
| **B. Backend signs with provided key** | Current approach, but key is held only in browser memory and used via a local signer — never sent to the backend. Backend uses its own configured key for relay. | Simpler, but breaks "no authority" principle for non-root actors |

**Recommendation:** Approach A for Ministry/Institution operations (each entity signs with their own key). The EU Root operations can remain server-signed since the root key is a multi-sig governance key managed by the deployment infrastructure.

---

## 5. Angular Implementation Plan

### 5.1 New Files

```
src/app/
├── core/
│   ├── auth/
│   │   ├── auth.service.ts            # DID-Auth challenge/verify, JWT storage
│   │   ├── signer.service.ts          # ethers.js Wallet, in-memory key, tx signing
│   │   ├── auth.guard.ts              # canActivate — redirects to /login if no session
│   │   ├── scope.guard.ts             # canActivate — checks minimum accreditation scope
│   │   ├── auth.interceptor.ts        # Attaches Authorization header to all /api calls
│   │   └── auth.models.ts             # AuthChallenge, AuthSession, AuthState interfaces
│   └── services/
│       └── (existing services unchanged)
├── features/
│   ├── login/
│   │   ├── login.component.ts         # DID-Auth login screen
│   │   └── login.component.html
│   └── (existing features unchanged)
└── app.routes.ts                       # Updated with guards
```

### 5.2 `AuthService`

Responsibilities:
- Request a nonce from `POST /api/auth/challenge`
- Delegate signing to `SignerService`
- Submit signature to `POST /api/auth/verify`
- Store the JWT in memory (not localStorage — prevents XSS exfiltration)
- Expose reactive `session` signal with: `did`, `scope`, `accreditationId`, `expiresAt`
- Provide `isAuthenticated()`, `hasScope(minimumScope)`, `logout()`

```
State machine:
  idle → challenging → signing → verifying → authenticated
                                           → error → idle
```

### 5.3 `SignerService`

Responsibilities:
- Accept a private key string and create an in-memory `ethers.Wallet`
- **Never persist the key** (no localStorage, no sessionStorage, no cookies)
- Sign DID-Auth challenge nonces
- Sign raw Ethereum transactions for accreditation/credential operations
- Expose `hasSigner()` signal
- Clear the signer on logout

```typescript
// Simplified interface
class SignerService {
  private wallet: ethers.Wallet | null = null;

  /** Called during login — key stays in JS heap only */
  initialize(privateKey: string): string; // returns derived Ethereum address

  /** Sign a DID-Auth challenge nonce */
  signChallenge(nonce: string): Promise<string>;

  /** Sign a contract transaction without broadcasting */
  signTransaction(populatedTx: ethers.TransactionRequest): Promise<string>;

  /** Wipe key from memory on logout */
  clear(): void;
}
```

### 5.4 `AuthGuard` and `ScopeGuard`

```typescript
// auth.guard.ts — protects all admin routes
canActivate(): boolean {
  if (!this.authService.isAuthenticated()) {
    this.router.navigate(['/login']);
    return false;
  }
  return true;
}

// scope.guard.ts — parameterized per route
// Usage: canActivate: [scopeGuard('MemberState')]
canActivate(route): boolean {
  const requiredScope = route.data['minimumScope'];
  return this.authService.hasScope(requiredScope);
}
```

### 5.5 `AuthInterceptor`

```typescript
intercept(req, next): Observable<HttpEvent<any>> {
  const token = this.authService.getToken();
  if (token && req.url.startsWith('/api')) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  return next.handle(req).pipe(
    catchError(err => {
      if (err.status === 401) this.authService.logout();
      return throwError(() => err);
    })
  );
}
```

### 5.6 Login Screen

A single-page login flow:

1. **Enter private key** — masked input field. The key is passed to `SignerService.initialize()` which derives the Ethereum address and DID.
2. **Display derived DID** — show `did:ethr:sepolia:0x…` so the user confirms they're using the right key.
3. **Sign challenge** — the login component calls `AuthService.login(did)`, which fetches a nonce, signs it via `SignerService`, and submits to `/api/auth/verify`.
4. **Redirect** — on success, navigate to the appropriate landing page based on scope (EU Root → `/member-states`, Ministry → `/ministries`, etc.).

### 5.7 Updated Routes

```typescript
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component')
      .then(m => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'member-states', pathMatch: 'full' },
      {
        path: 'member-states',
        loadComponent: () => import('./features/member-states/member-states.component')
          .then(m => m.MemberStatesComponent),
        data: { minimumScope: 'EURoot' },
        canActivate: [ScopeGuard],
      },
      {
        path: 'ministries',
        loadComponent: () => import('./features/ministries/ministries.component')
          .then(m => m.MinistriesComponent),
        data: { minimumScope: 'MemberState' },
        canActivate: [ScopeGuard],
      },
      {
        path: 'universities',
        loadComponent: () => import('./features/universities/universities.component')
          .then(m => m.UniversitiesComponent),
        data: { minimumScope: 'Ministry' },
        canActivate: [ScopeGuard],
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
```

---

## 6. Backend (.NET) Implementation Plan

### 6.1 New Endpoints (Accreditation Service)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/challenge` | Accept `{ did }`, return `{ nonce, expiresAt }` |
| `POST` | `/api/auth/verify` | Accept `{ did, nonce, signature }`, verify signature, check on-chain accreditation, return JWT |

### 6.2 Auth Flow in .NET

```
POST /api/auth/challenge
  ├── Validate DID format (did:ethr:sepolia:0x…)
  ├── Generate 32-byte random nonce
  ├── Store { nonce, did, expiresAt: now+5min } in memory cache
  └── Return { nonce, expiresAt }

POST /api/auth/verify
  ├── Lookup nonce in cache, check not expired
  ├── Recover Ethereum address from signature (Nethereum's EthECKey.RecoverFromSignature)
  ├── Verify recovered address matches DID address component
  ├── Query AccreditationRegistry: find highest-scope active accreditation for this DID
  │   ├── Check isMemberState(address) via EURootAuthority
  │   ├── Check accreditations where subjectDID matches
  │   └── For each, call validateTrustChain(accreditationId) on-chain
  ├── If no valid accreditation AND not the EU Root deployer → 403
  ├── Build JWT with { sub, eth_address, scope, accreditation_id }
  ├── Sign JWT with server-side HMAC secret (from environment variable, not hardcoded)
  └── Return { token, scope, accreditationId, expiresAt }
```

### 6.3 JWT Middleware

Add ASP.NET Core JWT Bearer authentication:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ValidateIssuer = false,     // Single-service issuer
            ValidateAudience = false,   // Thesis scope
            ClockSkew = TimeSpan.Zero,
        };
    });
```

### 6.4 Endpoint Authorization

Every existing endpoint gets an `[Authorize]` attribute. Scope-specific endpoints use a custom policy:

```csharp
// Policy registration
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("EURoot",       p => p.RequireClaim("scope", "EURoot"))
    .AddPolicy("MemberState",  p => p.RequireClaim("scope", "EURoot", "MemberState"))
    .AddPolicy("Ministry",     p => p.RequireClaim("scope", "EURoot", "MemberState", "Ministry"))
    .AddPolicy("Institution",  p => p.RequireClaim("scope", "EURoot", "MemberState", "Ministry", "Institution"));

// Endpoint usage
app.MapPost("/api/accreditations", IssueAccreditationEndpoint)
   .RequireAuthorization("MemberState");
```

### 6.5 Remove `issuerPrivateKey` from Request DTOs

After client-side signing is implemented:

1. Remove `issuerPrivateKey` from `IssueAccreditationRequest` and `IssueCredentialRequest`
2. Add `signedTransaction` field (hex-encoded raw tx)
3. Backend relays via `eth_sendRawTransaction` instead of signing server-side
4. EU Root operations remain server-signed (root key in environment config)

---

## 7. Role-Based Access via On-Chain Accreditation

### 7.1 Scope Hierarchy & Permitted Actions

```
EURoot (deployer address)
  ├── Can issue MemberState accreditations
  ├── Can view/verify/revoke all accreditations
  └── Can access all admin routes

MemberState (accredited by EU Root)
  ├── Can issue Ministry accreditations under their state
  ├── Can view/verify accreditations in their subtree
  └── Can access /ministries and /universities (own subtree only)

Ministry (accredited by a MemberState)
  ├── Can issue Institution accreditations under their ministry
  ├── Can view/verify accreditations in their subtree
  └── Can access /universities (own subtree only)

Institution (accredited by a Ministry)
  ├── Can issue credentials (diplomas) for their institution
  ├── Can view/verify/revoke credentials they issued
  └── Can access credential management only
```

### 7.2 UI Adaptation by Scope

The admin client adapts its UI based on the authenticated user's scope:

| UI Element | EURoot | MemberState | Ministry | Institution |
|------------|--------|-------------|----------|-------------|
| Member States page | Full CRUD | Read-only (own) | Hidden | Hidden |
| Ministries page | Full CRUD | Full CRUD (own children) | Read-only (own) | Hidden |
| Universities page | Full CRUD | Full CRUD (subtree) | Full CRUD (own children) | Read-only (own) |
| Diploma issuance | All | Subtree | Subtree | Own only |
| Revocation | All | Own subtree | Own subtree | Own credentials |

### 7.3 On-Chain Re-Verification

During the JWT lifetime, the authenticated DID's accreditation could be revoked on-chain. Two strategies:

- **Lazy:** Re-check on-chain accreditation status on every write operation (issue, revoke). Fails gracefully with a "your accreditation has been revoked" error.
- **Eager:** Use the `BlockchainSync` service's RabbitMQ events. If an `AccreditationRevokedEvent` matches the session's `accreditationId`, invalidate the JWT server-side.

**Recommendation:** Lazy check for thesis scope (simpler), with a note that eager invalidation via WebSocket/SSE would be the production approach.

---

## 8. Security Hardening

### 8.1 Transport Security

| Measure | Implementation | Priority |
|---------|---------------|----------|
| HTTPS only | Enforce via `UseHttpsRedirection()` in .NET, Angular SSR reverse proxy | High |
| CORS | Restrict to admin client origin only (`http://localhost:4200` in dev) | High |
| HSTS | `UseHsts()` with 1-year max-age | Medium |

### 8.2 Input Validation

| Target | Validation | Where |
|--------|------------|-------|
| DID format | Regex: `^did:ethr:sepolia:0x[0-9a-fA-F]{40}$` | Client + Backend |
| Ethereum address | Checksum validation via ethers.js / Nethereum | Client + Backend |
| Accreditation ID | Bytes32 hex: `^0x[0-9a-fA-F]{64}$` | Client + Backend |
| Private key (login only) | 64 hex chars, derived address matches expected DID | Client only (never sent) |
| JWT | Standard validation (signature, expiry, required claims) | Backend middleware |

### 8.3 Anti-Abuse

| Measure | Implementation |
|---------|---------------|
| Rate limiting on `/api/auth/*` | ASP.NET `RateLimiter` middleware — 5 challenges/min per IP |
| Nonce expiry | 5-minute TTL, single-use (deleted after verification attempt) |
| JWT expiry | 1 hour, no refresh token (re-authenticate) |
| Request size limit | 16KB max body on auth endpoints |

### 8.4 Key Handling Summary

| Key | Where it lives | How it's used |
|-----|----------------|---------------|
| User's private key | Browser JS heap (in-memory only, cleared on logout/close) | Signs challenges and transactions |
| EU Root private key | Backend environment variable (`BLOCKCHAIN__PRIVATEKEY`) | Signs root-level operations server-side |
| JWT signing secret | Backend environment variable (`JWT__SECRET`) | HMAC-SHA256 for session tokens |
| Nonce | Backend memory cache (IMemoryCache) | One-time-use challenge for DID-Auth |

---

## 9. Implementation Phases

### Phase 1: Foundation (Core Auth Plumbing)

**Angular:**
- [ ] `SignerService` — in-memory ethers.js Wallet, sign challenges, clear on logout
- [ ] `AuthService` — challenge/verify flow, JWT storage in memory, `session` signal
- [ ] `AuthInterceptor` — attach Bearer token, handle 401
- [ ] `LoginComponent` — private key input, DID derivation, sign-in flow

**Backend (.NET):**
- [ ] `POST /api/auth/challenge` and `POST /api/auth/verify` endpoints
- [ ] Signature recovery via Nethereum
- [ ] JWT issuance with scope claim from on-chain accreditation lookup
- [ ] JWT validation middleware on all existing endpoints

### Phase 2: Access Control (Guards & RBAC)

**Angular:**
- [ ] `AuthGuard` — redirect to `/login` if unauthenticated
- [ ] `ScopeGuard` — check `minimumScope` route data against session scope
- [ ] Update `app.routes.ts` with guards and scope requirements
- [ ] Adapt `ShellComponent` sidebar/navigation to show only permitted routes
- [ ] Show current session info (DID, scope badge) in the shell header

**Backend (.NET):**
- [ ] Authorization policies per scope (`EURoot`, `MemberState`, `Ministry`, `Institution`)
- [ ] Apply `RequireAuthorization` to all FastEndpoints
- [ ] Scope-filtered data queries (e.g., Ministry user only sees own subtree)

### Phase 3: Client-Side Signing (Remove Private Key Transport)

**Angular:**
- [ ] `SignerService.signTransaction()` — sign populated transactions client-side
- [ ] Update `AccreditationService.issue()` to send `signedTransaction` instead of `issuerPrivateKey`
- [ ] Update `CredentialService.issue()` and `revoke()` similarly
- [ ] Remove all `issuerPrivateKey` fields from request models

**Backend (.NET):**
- [ ] New `POST /api/accreditations/relay` endpoint accepting signed raw tx
- [ ] `eth_sendRawTransaction` relay via Nethereum
- [ ] Remove `issuerPrivateKey` from all request DTOs
- [ ] Keep server-side signing only for EU Root operations

### Phase 4: Hardening & Polish

- [ ] Rate limiting on auth endpoints
- [ ] CORS configuration (restrict to admin client origin)
- [ ] Input validation (DID format, address checksum, accreditationId bytes32)
- [ ] Logout button in shell header, session expiry countdown
- [ ] Error screens for 401 (session expired) and 403 (insufficient scope)
- [ ] On-chain re-verification on write operations (lazy check)

---

## 10. Out of Scope (Thesis Boundaries)

These items are **noted as future work** in the thesis but are not implemented:

| Item | Reason |
|------|--------|
| **MetaMask / WalletConnect integration** | Requires browser extension or relay infrastructure. The in-memory signer proves the same DID-Auth concept. |
| **Multi-sig governance for EU Root** | `EURootAuthority.sol` supports it, but the admin UI for multi-sig proposal/voting is a separate effort. |
| **Token refresh mechanism** | 1-hour JWT with re-authentication is sufficient for demo. Production would use refresh tokens with rotation. |
| **SSE/WebSocket session revocation** | Lazy on-chain re-check on writes is sufficient. Eager push-based revocation is a production optimization. |
| **Audit log UI** | The `Audit` microservice is planned but not yet implemented. Admin actions are traceable via blockchain transactions. |
| **OpenID4VP for admin auth** | Would replace the custom DID-Auth with a standardized protocol. Noted as alignment with eIDAS 2.0. |
| **HSM / hardware key storage** | The in-memory signer is a thesis simplification. Production admin clients would use hardware security modules. |
| **Per-field ABAC (Attribute-Based Access Control)** | Scope-based RBAC is sufficient for the four-level hierarchy. |
