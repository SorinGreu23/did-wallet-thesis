# DID Wallet - Mobile Application

A Decentralized Identity (DID) wallet built with React Native, Expo, and Veramo Framework for managing DIDs and Verifiable Credentials.

**Bachelor's Thesis Project**  
Computer Science, Alexandru Ioan Cuza University, Iași  
Expected Graduation: July 2026

---

## 📱 Features

### ✅ Current Features (v0.2)

**DID Management:**
- Create decentralized identifiers using `did:key` method
- Ed25519 cryptographic key generation and storage
- DID Document resolution (W3C DID Core compliant)
- Persistent storage in SQLite
- View complete DID details including keys and metadata
- Copy-to-clipboard functionality for DIDs and keys

**Verifiable Credentials:**
- Issue W3C Verifiable Credentials (VC-JWT format)
- Self-issued credentials for demo/testing
- Store credentials persistently
- Cryptographic signature verification
- Display credential details with type tags
- Verify credential integrity

**User Interface:**
- Tab navigation (DIDs / Credentials)
- Professional, clean UI design
- Detail views for DIDs
- Credential cards with verification buttons
- Loading states and error handling
- Native iOS experience

---

## 🏗️ Architecture

```
mobile-wallet/
├── src/
│   ├── agents/
│   │   └── veramoAgent.ts          # Veramo agent configuration
│   ├── services/
│   │   ├── didService.ts           # DID operations (CRUD)
│   │   └── credentialService.ts    # Credential operations
│   ├── screens/
│   │   ├── HomeScreen.tsx          # Main screen with tabs
│   │   ├── DIDDetailScreen.tsx     # DID details view
│   │   └── CredentialsScreen.tsx   # Credentials list & management
│   ├── constants/
│   │   └── config.ts               # App configuration
│   └── types/
│       └── index.ts                # TypeScript interfaces
├── App.tsx
└── package.json
```

### Technology Stack

**Core:**
- React Native (via Expo)
- TypeScript
- SQLite (expo-sqlite)

**Identity & Credentials:**
- Veramo Framework
  - `@veramo/core` - Core agent functionality
  - `@veramo/did-manager` - DID management
  - `@veramo/did-provider-key` - did:key method
  - `@veramo/key-manager` - Cryptographic key management
  - `@veramo/kms-local` - Local key management system
  - `@veramo/credential-w3c` - W3C VC support
  - `@veramo/data-store` - Persistent storage
  - `@veramo/did-resolver` - DID resolution

**Utilities:**
- expo-clipboard - Copy to clipboard
- react-native-get-random-values - Crypto polyfill
- @ethersproject/shims - Ethereum shims for React Native

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- iOS device or simulator (Android support TBD)
- Expo Go app installed on device

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd did-wallet-thesis/mobile-wallet

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Device

1. Install **Expo Go** from the App Store
2. Scan the QR code from terminal with your iPhone
3. App will load automatically

### Development

```bash
# Start with cache clearing
npx expo start -c

# iOS simulator (requires Xcode)
npx expo start --ios

# Web version (limited functionality)
npx expo start --web
```

---

## 📖 Usage Guide

### Creating Your First DID

1. Open the app
2. Navigate to "DIDs" tab
3. Tap "Create New DID"
4. Your DID will be generated with cryptographic keys
5. Tap on the DID card to view full details

### Issuing a Credential

1. Navigate to "Credentials" tab
2. Ensure you have at least one DID created
3. Tap "Issue Sample Credential"
4. View your credential with personal information
5. Tap "Verify ✓" to cryptographically verify the signature

### Viewing DID Details

- Tap any DID card to see:
  - Full DID string
  - Provider information
  - Cryptographic keys (public keys in hex)
  - W3C DID Document (JSON format)
- Tap any field to copy to clipboard

---

## 📚 Standards & Compliance

### Implemented Standards
- **W3C DID Core 1.0** - Decentralized Identifiers
- **W3C Verifiable Credentials Data Model 1.1** - Credential format
- **did:key Method Specification** - DID method

### Planned Standards (EU ARF Compliance)
- **OpenID4VP** - Verifiable Presentation protocol
- **OpenID4VCI** - Credential issuance protocol
- **SD-JWT** - Selective Disclosure for JWT
- **ISO/IEC 18013-5** - Mobile driving license (mdoc)
- **eIDAS 2.0** - EU Digital Identity Regulation

---

---

## 📄 License

This project is part of academic research for educational purposes.

---

## 👨‍💻 Author

**Academic Project**  
Alexandru Ioan Cuza University, Iași  
Faculty of Computer Science  
Expected Graduation: July 2026

---

## 📞 Resources

- **Veramo Documentation:** https://veramo.io/docs/
- **W3C DID Spec:** https://www.w3.org/TR/did-core/
- **W3C VC Spec:** https://www.w3.org/TR/vc-data-model/
- **EU ARF:** https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework

