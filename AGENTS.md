# Repository Guidelines

## Project Structure & Module Organization

- `DID.WalletThesis/src/Services/` contains the .NET 10 microservices. Keep domain, application, infrastructure, and endpoint code inside its service.
- `DID.WalletThesis/src/Shared/` holds reusable libraries; `src/Contracts/` contains shared message contracts.
- `DID.WalletThesis/src/admin-client/` is the Angular 21 administration UI. Features live under `src/app/features/`; cross-cutting code belongs in `core/` or `shared/`.
- `DID.WalletThesis/src/mobile-wallet/` is the Expo/React Native wallet; ZKP artifacts are in `assets/circuits/`.
- `blockchain/` contains Solidity contracts, Foundry deployment scripts, tests, exported ABIs, and deployment metadata.
- `docs/`, `chapters/`, `audits/`, and root `.drawio` files contain documentation and diagrams.

## Build, Test, and Development Commands

- `docker compose -f docker-compose.infra.yml up -d` starts PostgreSQL, RabbitMQ, and Anvil.
- `docker compose -f docker-compose.services.yml up -d --build` builds and starts the application stack.
- `dotnet build DID.WalletThesis/DID.WalletThesis.sln` validates all .NET projects.
- `cd blockchain && forge test` runs Solidity unit tests.
- In `DID.WalletThesis/src/admin-client`, run `npm install`, `npm start`, `npm test`, or `npm run build`.
- `cd DID.WalletThesis/src/mobile-wallet && npm install && npm run ios` builds the iOS app. Expo Go is unsupported because native modules are required.

## Coding Style & Naming Conventions

Use four-space indentation and standard .NET naming: PascalCase for public types and members, camelCase for locals and parameters, and `I` prefixes for interfaces. Preserve the existing Domain/Application/Infrastructure separation.

Angular follows its `.editorconfig`: two spaces, UTF-8, final newlines, and single quotes in TypeScript. Name Angular tests `*.spec.ts`; use PascalCase for React components and camelCase for hooks, services, and utilities. Run Prettier on touched frontend files. Solidity tests end in `.t.sol`.

## Testing Guidelines

Add Foundry tests beside existing tests in `blockchain/test/`; the blockchain documentation targets greater than 90% coverage. Add Angular unit tests near the implementation. There are currently no dedicated .NET test projects or mobile test script, so manually verify affected service/API and wallet flows using `docs/TESTING_GUIDE.md`. Always run the relevant build and tests before submitting.

## Commit & Pull Request Guidelines

History uses short, imperative summaries such as `Update README`, but also contains oversized messages. Prefer one focused change per commit with a concise subject, optionally scoped (for example, `wallet: validate proof inputs`). Pull requests should explain changes, list verification commands, link issues, and include screenshots for UI work. Call out migrations, configuration changes, contract redeployments, and regenerated ABIs. Never commit secrets; update `.env.example` instead.
