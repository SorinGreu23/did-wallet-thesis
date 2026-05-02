import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';

const KEYS = {
  pinSalt: 'pin.salt',
  pinHash: 'pin.hash',
  pinFailures: 'pin.failures',
  pinLockedUntil: 'pin.lockedUntil',
} as const;

const PBKDF2_ITERATIONS = 100_000;
const MAX_FAILURES_BEFORE_COOLDOWN = 5;
const MAX_FAILURES_BEFORE_WIPE_OFFER = 10;
const COOLDOWN_MS = 30_000;

/** Converts a Uint8Array to a hex string. */
function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Converts a hex string to a Uint8Array. */
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

/** Derive a 32-byte key from a PIN using PBKDF2-SHA256 via Web Crypto. */
async function deriveKey(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const pinBuffer = enc.encode(pin);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  return new Uint8Array(derivedBits);
}

export interface PinStatus {
  hasPin: boolean;
  isLocked: boolean;
  lockedUntil: number | null;
  failures: number;
  offerWipe: boolean;
}

class PinService {
  /** Returns true if a PIN has been set up. */
  async hasPin(): Promise<boolean> {
    const hash = await SecureStore.getItemAsync(KEYS.pinHash);
    return hash !== null;
  }

  /** Set up a new PIN. Stores a PBKDF2-derived hash with a random salt. */
  async setupPin(pin: string): Promise<void> {
    const salt = getRandomBytes(16);
    const derived = await deriveKey(pin, salt);
    await SecureStore.setItemAsync(KEYS.pinSalt, toHex(salt));
    await SecureStore.setItemAsync(KEYS.pinHash, toHex(derived));
    await SecureStore.setItemAsync(KEYS.pinFailures, '0');
  }

  /**
   * Verify the PIN. Returns true if correct.
   * Manages the failure counter and lockout.
   */
  async verifyPin(pin: string): Promise<boolean> {
    const status = await this.getStatus();
    if (status.isLocked) {
      throw new Error('PIN is temporarily locked. Try again later.');
    }

    const saltHex = await SecureStore.getItemAsync(KEYS.pinSalt);
    const storedHash = await SecureStore.getItemAsync(KEYS.pinHash);
    if (!saltHex || !storedHash) throw new Error('PIN not configured.');

    const salt = fromHex(saltHex);
    const derived = await deriveKey(pin, salt);
    const correct = toHex(derived) === storedHash;

    if (correct) {
      await SecureStore.setItemAsync(KEYS.pinFailures, '0');
    } else {
      const failures = status.failures + 1;
      await SecureStore.setItemAsync(KEYS.pinFailures, String(failures));
      if (failures >= MAX_FAILURES_BEFORE_COOLDOWN && failures < MAX_FAILURES_BEFORE_WIPE_OFFER) {
        await SecureStore.setItemAsync(
          KEYS.pinLockedUntil,
          String(Date.now() + COOLDOWN_MS),
        );
      }
    }

    return correct;
  }

  async getStatus(): Promise<PinStatus> {
    const hasPin = await this.hasPin();
    const failuresStr = await SecureStore.getItemAsync(KEYS.pinFailures);
    const lockedUntilStr = await SecureStore.getItemAsync(KEYS.pinLockedUntil);
    const failures = parseInt(failuresStr ?? '0', 10);
    const lockedUntil = lockedUntilStr ? parseInt(lockedUntilStr, 10) : null;
    const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

    return {
      hasPin,
      isLocked,
      lockedUntil: isLocked ? lockedUntil : null,
      failures,
      offerWipe: failures >= MAX_FAILURES_BEFORE_WIPE_OFFER,
    };
  }

  async clearPin(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.pinSalt);
    await SecureStore.deleteItemAsync(KEYS.pinHash);
    await SecureStore.deleteItemAsync(KEYS.pinFailures);
    await SecureStore.deleteItemAsync(KEYS.pinLockedUntil);
  }
}

export default new PinService();
