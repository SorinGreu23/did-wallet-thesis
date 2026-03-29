namespace DID.Accreditation.Application.Auth;

public record ChallengeRequest(string Did);
public record ChallengeResponse(string Nonce, DateTime ExpiresAt);
public record VerifyRequest(string Did, string Nonce, string Signature);
public record VerifyResponse(string Token, string Scope, string? AccreditationId, DateTime ExpiresAt);
