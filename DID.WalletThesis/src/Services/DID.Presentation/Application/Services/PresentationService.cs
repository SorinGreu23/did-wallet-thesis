using System.Collections.Concurrent;
using System.Security.Cryptography;
using DID.Presentation.Application.DTOs;

namespace DID.Presentation.Application.Services;

/// <summary>
/// In-memory presentation session store and orchestration service.
///
/// Flow:
///   1. Verifier calls CreateChallenge → gets a SessionId + nonce (encoded in a QR code).
///   2. Wallet scans the QR code, retrieves the session, then calls Submit with a VP.
///   3. All credential verification happens on-device (mobile wallet); this service
///      stores the submitted data and marks the session complete.
///   4. Verifier polls GetSession for the outcome.
///
/// Sessions expire after a configurable TTL (default 5 minutes).
/// No database — stateless across restarts (acceptable for thesis demo).
/// </summary>
public class PresentationService(ILogger<PresentationService> logger)
{
    private static readonly TimeSpan SessionTtl = TimeSpan.FromMinutes(5);
    private readonly ConcurrentDictionary<string, PresentationSession> _sessions = new();

    // ── Challenge creation ────────────────────────────────────────────────────

    public PresentationChallengeDto CreateChallenge(CreatePresentationRequestDto request)
    {
        var sessionId = Guid.NewGuid().ToString();
        var nonce = GenerateNonce();
        var now = DateTime.UtcNow;
        var expiresAt = now.Add(SessionTtl);

        _sessions[sessionId] = new PresentationSession(
            SessionId: sessionId,
            VerifierDid: request.VerifierDid,
            RequiredCredentialTypes: request.RequiredCredentialTypes,
            ZkpRequired: request.ZkpRequired,
            Nonce: nonce,
            Status: SessionStatus.Pending,
            CreatedAt: now,
            ExpiresAt: expiresAt);

        logger.LogInformation(
            "Presentation session {SessionId} created by verifier {VerifierDid}",
            sessionId, request.VerifierDid);

        return new PresentationChallengeDto(
            sessionId,
            request.VerifierDid,
            request.RequiredCredentialTypes,
            request.ZkpRequired,
            nonce,
            expiresAt);
    }

    // ── Presentation submission ───────────────────────────────────────────────

    public Task<PresentationSessionDto> SubmitAsync(
        SubmitPresentationDto submission,
        CancellationToken ct = default)
    {
        if (!_sessions.TryGetValue(submission.SessionId, out var session))
            throw new KeyNotFoundException($"Session {submission.SessionId} not found");

        if (session.Status == SessionStatus.Expired || DateTime.UtcNow > session.ExpiresAt)
        {
            _sessions[submission.SessionId] = session with { Status = SessionStatus.Expired };
            throw new InvalidOperationException($"Session {submission.SessionId} has expired");
        }

        if (session.Status == SessionStatus.Completed)
            throw new InvalidOperationException($"Session {submission.SessionId} is already completed");

        // Verification is on-device; we accept the wallet's assertion and store the result.
        var completed = session with
        {
            Status = SessionStatus.Completed,
            OverallValid = submission.OverallValid,
            SubmittedCredentialIds = submission.CredentialIds,
            CompletedAt = DateTime.UtcNow,
        };
        _sessions[submission.SessionId] = completed;

        logger.LogInformation(
            "Presentation session {SessionId} completed: overallValid={Valid}",
            submission.SessionId, submission.OverallValid);

        return Task.FromResult(ToDto(completed));
    }

    // ── Session query ─────────────────────────────────────────────────────────

    public PresentationSessionDto? GetSession(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
            return null;

        if (session.Status == SessionStatus.Pending && DateTime.UtcNow > session.ExpiresAt)
        {
            session = session with { Status = SessionStatus.Expired };
            _sessions[sessionId] = session;
        }

        return ToDto(session);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static string GenerateNonce()
        => Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

    private static PresentationSessionDto ToDto(PresentationSession s) =>
        new(s.SessionId,
            s.VerifierDid,
            s.Status,
            s.OverallValid,
            null,
            s.CreatedAt,
            s.ExpiresAt,
            s.CompletedAt);

    // ── Internal session record ───────────────────────────────────────────────

    private sealed record PresentationSession(
        string SessionId,
        string VerifierDid,
        string[] RequiredCredentialTypes,
        bool ZkpRequired,
        string Nonce,
        SessionStatus Status,
        DateTime CreatedAt,
        DateTime ExpiresAt,
        bool? OverallValid = null,
        string[]? SubmittedCredentialIds = null,
        DateTime? CompletedAt = null);
}
