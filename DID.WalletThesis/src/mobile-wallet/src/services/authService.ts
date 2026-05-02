import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { WalletProfile, AccountType } from "../types/wallet";

const KEYS = {
  secretKey: "wallet.secretKey",
  walletCreated: "wallet.created",
  sessionActive: "wallet.sessionActive",
  walletProfile: "wallet.profile",
} as const;

/**
 * Manages wallet authentication state and secret key storage.
 *
 * The SECRET_KEY (used by Veramo's SecretBox to encrypt private keys at rest)
 * is generated once during wallet creation and stored in the OS keychain
 * via expo-secure-store — never hardcoded in source.
 */
class AuthService {
  /**
   * Returns the 64-char hex secret key from secure storage.
   * Returns null if no wallet has been created yet.
   */
  async getSecretKey(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.secretKey);
  }

  /**
   * Generates a cryptographically random 32-byte (64 hex char) secret key,
   * stores it in the OS keychain, and marks the wallet as created.
   */
  async createWallet(): Promise<string> {
    const existing = await SecureStore.getItemAsync(KEYS.secretKey);
    if (existing) return existing;

    // Generate 32 random bytes as hex (64 chars) for SecretBox
    const uuid1 = randomUUID().replace(/-/g, ""); // 32 hex chars
    const uuid2 = randomUUID().replace(/-/g, ""); // 32 hex chars
    const secretKey = (uuid1 + uuid2).slice(0, 64);

    await SecureStore.setItemAsync(KEYS.secretKey, secretKey);
    await SecureStore.setItemAsync(KEYS.walletCreated, "true");
    await SecureStore.setItemAsync(KEYS.sessionActive, "true");

    return secretKey;
  }

  /** Returns true if a wallet has been created on this device. */
  async hasWallet(): Promise<boolean> {
    const created = await SecureStore.getItemAsync(KEYS.walletCreated);
    return created === "true";
  }

  /** Returns true if the user has an active session (already logged in). */
  async isSessionActive(): Promise<boolean> {
    const session = await SecureStore.getItemAsync(KEYS.sessionActive);
    return session === "true";
  }

  /** Mark the session as active after successful biometric/login. */
  async setSessionActive(): Promise<void> {
    await SecureStore.setItemAsync(KEYS.sessionActive, "true");
  }

  /** Clear the session (user logs out). */
  async clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.sessionActive);
  }

  /** Save the full WalletProfile (written after the registration wizard completes). */
  async saveWalletProfile(profile: WalletProfile): Promise<void> {
    await AsyncStorage.setItem(KEYS.walletProfile, JSON.stringify(profile));
  }

  /** Retrieve the full WalletProfile. Returns null if not yet set. */
  async getWalletProfile(): Promise<WalletProfile | null> {
    const raw = await AsyncStorage.getItem(KEYS.walletProfile);
    if (!raw) return null;
    return JSON.parse(raw) as WalletProfile;
  }

  /** Returns the accountType for the stored wallet, or null. */
  async getAccountType(): Promise<AccountType | null> {
    const profile = await this.getWalletProfile();
    return profile?.accountType ?? null;
  }
}

export default new AuthService();
