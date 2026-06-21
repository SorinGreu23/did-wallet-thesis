import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID, getRandomBytesAsync, digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import { gcm } from "@noble/ciphers/aes";
import { WalletProfile, AccountType } from "../types/wallet";

const KEYS = {
  secretKey: "wallet.secretKey",
  walletCreated: "wallet.created",
  sessionActive: "wallet.sessionActive",
  walletProfile: "wallet.profile",
} as const;

// ── Profile encryption (AES-256-GCM) ─────────────────────────────────────────
// The profile is encrypted with a key derived from the wallet secret key so
// that reading AsyncStorage on a rooted device reveals only ciphertext.

async function deriveProfileKey(secretKey: string): Promise<Uint8Array> {
  const hex = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    `profile-encryption-key:${secretKey}`,
    { encoding: 'hex' },
  );
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

async function encryptProfile(plaintext: string, secretKey: string): Promise<string> {
  const key = await deriveProfileKey(secretKey);
  const iv = await getRandomBytesAsync(12);
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(new TextEncoder().encode(plaintext));
  // Store as base64(iv) + '.' + base64(ciphertext)
  return `${Buffer.from(iv).toString('base64')}.${Buffer.from(ciphertext).toString('base64')}`;
}

async function decryptProfile(blob: string, secretKey: string): Promise<string> {
  const [ivB64, ctB64] = blob.split('.');
  const key = await deriveProfileKey(secretKey);
  const iv = Uint8Array.from(Buffer.from(ivB64, 'base64'));
  const ciphertext = Uint8Array.from(Buffer.from(ctB64, 'base64'));
  const cipher = gcm(key, iv);
  const plaintext = cipher.decrypt(ciphertext);
  return new TextDecoder().decode(plaintext);
}

class AuthService {
  async getSecretKey(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.secretKey);
  }

  async createWallet(): Promise<string> {
    const existing = await SecureStore.getItemAsync(KEYS.secretKey);
    if (existing) return existing;

    const uuid1 = randomUUID().replace(/-/g, "");
    const uuid2 = randomUUID().replace(/-/g, "");
    const secretKey = (uuid1 + uuid2).slice(0, 64);

    await SecureStore.setItemAsync(KEYS.secretKey, secretKey);
    await SecureStore.setItemAsync(KEYS.walletCreated, "true");
    await SecureStore.setItemAsync(KEYS.sessionActive, "true");

    return secretKey;
  }

  async hasWallet(): Promise<boolean> {
    const created = await SecureStore.getItemAsync(KEYS.walletCreated);
    return created === "true";
  }

  async isSessionActive(): Promise<boolean> {
    const session = await SecureStore.getItemAsync(KEYS.sessionActive);
    return session === "true";
  }

  async setSessionActive(): Promise<void> {
    await SecureStore.setItemAsync(KEYS.sessionActive, "true");
  }

  async clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.sessionActive);
  }

  async saveWalletProfile(profile: WalletProfile): Promise<void> {
    const secretKey = await this.getSecretKey();
    if (!secretKey) throw new Error("Wallet not initialised — cannot save profile");
    const encrypted = await encryptProfile(JSON.stringify(profile), secretKey);
    await AsyncStorage.setItem(KEYS.walletProfile, encrypted);
  }

  async getWalletProfile(): Promise<WalletProfile | null> {
    const raw = await AsyncStorage.getItem(KEYS.walletProfile);
    if (!raw) return null;
    const secretKey = await this.getSecretKey();
    if (!secretKey) return null;
    try {
      // Handle plaintext blobs written by older app versions (no '.' separator).
      const plaintext = raw.includes('.')
        ? await decryptProfile(raw, secretKey)
        : raw;
      return JSON.parse(plaintext) as WalletProfile;
    } catch {
      return null;
    }
  }

  async updateWalletProfile(patch: Partial<WalletProfile>): Promise<void> {
    const existing = await this.getWalletProfile();
    if (!existing) return;
    await this.saveWalletProfile({ ...existing, ...patch } as WalletProfile);
  }

  async getAccountType(): Promise<AccountType | null> {
    const profile = await this.getWalletProfile();
    return profile?.accountType ?? null;
  }
}

export default new AuthService();
