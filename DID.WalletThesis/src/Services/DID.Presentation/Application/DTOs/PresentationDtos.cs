using System.Text.Json;

namespace DID.Presentation.Application.DTOs;

// ── Verifier creates a presentation request ─────────────────────────────────

public record CreatePresentationRequestDto(
    /// <summary>DID of the verifier issuing the challenge.</summary>
    string VerifierDid,
    /// <summary>Credential types the verifier requires, e.g. "UniversityDegree".</summary>
    string[] RequiredCredentialTypes,
    /// <summary>Whether the holder must include a ZKP proof alongside the presentation.</summary>
    bool ZkpRequired = false);

public record PresentationChallengeDto(
    string SessionId,
    string VerifierDid,
    string[] RequiredCredentialTypes,
    bool ZkpRequired,
    string Nonce,
    DateTime ExpiresAt);

// ── Holder submits a verifiable presentation ────────────────────────────────

public record SubmitPresentationDto(
    string SessionId,
    /// <summary>
    /// The on-chain credential ID(s) being presented.
    /// Used to perform on-chain status checks via DID.Verification.
    /// </summary>
    string[] CredentialIds,
    /// <summary>Optional ZKP proof accompanying the presentation.</summary>
    ZkpProofDto? ZkpProof = null);

public record ZkpProofDto(
    string CircuitName,
    JsonElement Proof,
    string[] PublicSignals);

// ── Verification result forwarded from DID.Verification ─────────────────────

public record CredentialVerificationResultDto(
    string CredentialId,
    bool IsValid,
    bool CredentialActive,
    bool TrustChainValid,
    bool? ZkpValid,
    string Status,
    string? Reason);

// ── Final session outcome ────────────────────────────────────────────────────

public enum SessionStatus { Pending, Completed, Expired }

public record PresentationSessionDto(
    string SessionId,
    string VerifierDid,
    SessionStatus Status,
    bool? OverallValid,
    CredentialVerificationResultDto[]? CredentialResults,
    DateTime CreatedAt,
    DateTime ExpiresAt,
    DateTime? CompletedAt);
