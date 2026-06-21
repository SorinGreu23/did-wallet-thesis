namespace DID.Accreditation.Application.Auth;

public class AuthOptions
{
    public const string SectionName = "Auth";
    public string JwtSecret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "did-accreditation";
    public string Audience { get; set; } = "did-accreditation";
    public int TokenExpiryMinutes { get; set; } = 120;
    public int ChallengeExpiryMinutes { get; set; } = 5;
}
