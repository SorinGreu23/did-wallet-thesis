namespace DID.Shared.Application.Constants;

/// <summary>
/// Centralised registry of smart-contract names and function/event identifiers.
/// Using constants prevents typo-induced runtime failures that the compiler cannot catch.
/// </summary>
public static class SmartContractConstants
{
    // ── Contract names (must match keys in BlockchainOptions:Contracts) ──────────
    public static class Contracts
    {
        public const string CredentialRegistry     = "CredentialRegistry";
        public const string AccreditationRegistry  = "AccreditationRegistry";
        public const string EURootAuthority        = "EURootAuthority";
    }

    // ── CredentialRegistry functions ─────────────────────────────────────────────
    public static class CredentialFunctions
    {
        public const string RecordCredential        = "recordCredential";
        public const string RevokeCredential        = "revokeCredential";
        public const string SuspendCredential       = "suspendCredential";
        public const string VerifyCredential        = "verifyCredential";
        public const string Credentials             = "credentials";
        public const string GetCredentialsByHolder  = "getCredentialsByHolder";
    }

    // ── AccreditationRegistry functions ──────────────────────────────────────────
    public static class AccreditationFunctions
    {
        public const string IssueAccreditation          = "issueAccreditation";
        public const string RevokeAccreditation         = "revokeAccreditation";
        public const string ValidateTrustChain          = "validateTrustChain";
        public const string Accreditations              = "accreditations";
        public const string GetAccreditationsBySubject  = "getAccreditationsBySubject";
        public const string GetAccreditation            = "getAccreditation";
    }

    // ── EURootAuthority functions ─────────────────────────────────────────────────
    public static class EURootFunctions
    {
        public const string IsMemberState = "isMemberState";
    }

    // ── Event names ──────────────────────────────────────────────────────────────
    public static class Events
    {
        public const string AccreditationIssued = "AccreditationIssued";
        public const string CredentialIssued    = "CredentialIssued";
    }

    // ── DID prefix ───────────────────────────────────────────────────────────────
    public const string DidPrefix = "did:ethr:sepolia:";
}
