using System;
using System.Linq;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;

namespace TheSolution.PAPortal.Data;

public static class PasswordUtility
{
    private const int IterationCount = 100000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public static string CreateHash(string password, string saltSeed)
    {
        byte[] salt = CreateDeterministicSalt(saltSeed);
        byte[] hash = KeyDerivation.Pbkdf2(
            password,
            salt,
            KeyDerivationPrf.HMACSHA256,
            IterationCount,
            HashSize);

        return $"PBKDF2${IterationCount}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string saltSeed, string storedHash)
    {
        string[] parts = storedHash.Split('$');
        if (parts.Length != 4 || !parts[0].Equals("PBKDF2", StringComparison.Ordinal))
        {
            return false;
        }

        if (!int.TryParse(parts[1], out int iterations))
        {
            return false;
        }

        byte[] saltFromHash;
        byte[] expectedHash;

        try
        {
            saltFromHash = Convert.FromBase64String(parts[2]);
            expectedHash = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        byte[] deterministicSalt = CreateDeterministicSalt(saltSeed);
        if (!CryptographicOperations.FixedTimeEquals(saltFromHash, deterministicSalt))
        {
            return false;
        }

        byte[] actualHash = KeyDerivation.Pbkdf2(
            password,
            saltFromHash,
            KeyDerivationPrf.HMACSHA256,
            iterations,
            expectedHash.Length);

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private static byte[] CreateDeterministicSalt(string seed)
    {
        byte[] seedBytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(seed));
        return seedBytes.Take(SaltSize).ToArray();
    }
}
