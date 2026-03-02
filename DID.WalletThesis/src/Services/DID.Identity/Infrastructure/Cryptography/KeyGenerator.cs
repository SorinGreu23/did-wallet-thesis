using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Signer;
using System.Security.Cryptography;

namespace DID.Identity.Infrastructure.Cryptography;

public record KeyPairResult(string PublicKey, string EncryptedPrivateKey);

public interface IKeyGenerator
{
    KeyPairResult GenerateSecp256k1KeyPair();
}

public class KeyGenerator : IKeyGenerator
{
    private readonly byte[] _encryptionKey;

    public KeyGenerator(IConfiguration configuration)
    {
        var keyBase64 = configuration["Encryption:Key"]
            ?? throw new InvalidOperationException("Encryption:Key not configured");
        _encryptionKey = Convert.FromBase64String(keyBase64);
    }

    public KeyPairResult GenerateSecp256k1KeyPair()
    {
        var ecKey = EthECKey.GenerateKey();
        var publicKeyHex = ecKey.GetPubKey(false).ToHex();
        var privateKeyHex = ecKey.GetPrivateKey();

        return new KeyPairResult(publicKeyHex, Encrypt(privateKeyHex));
    }

    private string Encrypt(string plaintext)
    {
        using var aes = Aes.Create();
        aes.Key = _encryptionKey;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var bytes = System.Text.Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = encryptor.TransformFinalBlock(bytes, 0, bytes.Length);

        var result = new byte[aes.IV.Length + ciphertext.Length];
        aes.IV.CopyTo(result, 0);
        ciphertext.CopyTo(result, aes.IV.Length);

        return Convert.ToBase64String(result);
    }
}
