namespace DID.Accreditation.Application.Auth;

public class AuthOptions
{
    public const string SectionName = "Auth";
    public string JwtSecret { get; set; } = string.Empty;
    public int TokenExpiryMinutes { get; set; } = 60;
    public int ChallengeExpiryMinutes { get; set; } = 5;
}
