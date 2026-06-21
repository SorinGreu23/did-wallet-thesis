using DID.Shared.Application.Constants;

namespace DID.Shared.Application.Utils;

/// <summary>
/// Shared Ethereum address and DID utility methods.
/// Extracted from CredentialService and AccreditationService to eliminate verbatim duplication.
/// </summary>
public static class BlockchainAddressUtils
{
    /// <summary>Strips the DID prefix and returns the normalised (lowercase) hex address.</summary>
    public static string ExtractAddress(string didOrAddress)
    {
        if (string.IsNullOrWhiteSpace(didOrAddress))
            throw new ArgumentException("Value is required", nameof(didOrAddress));

        var candidate = didOrAddress.Trim();
        if (candidate.StartsWith(SmartContractConstants.DidPrefix, StringComparison.OrdinalIgnoreCase))
            candidate = candidate[SmartContractConstants.DidPrefix.Length..];

        return NormalizeAddress(candidate);
    }

    /// <summary>Validates and lowercases an Ethereum address (must be 0x + 40 hex chars).</summary>
    public static string NormalizeAddress(string address)
    {
        if (!address.StartsWith("0x", StringComparison.OrdinalIgnoreCase) || address.Length != 42)
            throw new ArgumentException($"Invalid Ethereum address: {address}", nameof(address));

        return address.ToLowerInvariant();
    }

    /// <summary>Converts a lowercase hex address to a fully-qualified DID string.</summary>
    public static string ToDid(string didOrAddress)
    {
        var address = ExtractAddress(didOrAddress);
        return $"{SmartContractConstants.DidPrefix}{address}";
    }

    /// <summary>Parses an optional 0x-prefixed 64-hex-char string to a 32-byte array.
    /// Returns a zero-filled 32-byte array when <paramref name="hex"/> is null or whitespace.</summary>
    public static byte[] HexToBytes32(string? hex)
    {
        if (string.IsNullOrWhiteSpace(hex))
            return new byte[32];

        var normalized = hex.StartsWith("0x", StringComparison.OrdinalIgnoreCase) ? hex[2..] : hex;
        if (normalized.Length != 64)
            throw new ArgumentException("Expected 32-byte hex value", nameof(hex));

        return Convert.FromHexString(normalized);
    }

    /// <summary>Converts a 32-byte array to a lowercase 0x-prefixed hex string.</summary>
    public static string Bytes32ToHex(byte[] bytes) =>
        "0x" + Convert.ToHexString(bytes).ToLowerInvariant();
}
