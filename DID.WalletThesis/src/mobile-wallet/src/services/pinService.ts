import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEYS = {
  pinAlgo: 'pin.algo',
  pinSalt: 'pin.salt',
  pinHash: 'pin.hash',
  pinFailures: 'pin.failures',
  pinLockedUntil: 'pin.lockedUntil',
} as const;

const MAX_FAILURES_BEFORE_COOLDOWN = 5;
const MAX_FAILURES_BEFORE_WIPE_OFFER = 10;
const COOLDOWN_MS = 30_000;

const CURRENT_ALGO = 'argon2id';
// Lower cost in dev so the feedback loop stays fast; security is unchanged.
const ARGON2_ITERATIONS = __DEV__ ? 1 : 3;

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
}

async function randomHex(byteLength: number): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return toHex(bytes);
}

async function derivePinHash(pin: string, saltHex: string): Promise<string> {
  const argon2 = (await import('react-native-argon2')).default;
  const result = await argon2(pin, saltHex, {
    iterations: ARGON2_ITERATIONS,
    memory: 65536,
    parallelism: 1,
    hashLength: 32,
    mode: 'argon2id',
    saltEncoding: 'hex',
  });
  return result.rawHash as string;
}

export interface PinStatus {
  hasPin: boolean;
  isLocked: boolean;
  lockedUntil: number | null;
  failures: number;
  offerWipe: boolean;
}

class PinService {
  async hasPin(): Promise<boolean> {
    const hash = await SecureStore.getItemAsync(KEYS.pinHash);
    return hash !== null;
  }

  // Returns true if a PIN exists but was stored with a different algorithm
  // (e.g. app was upgraded from Expo Go to native build). Callers should
  // clear the PIN and ask the user to re-enroll.
  async algMismatch(): Promise<boolean> {
    const storedAlgo = await SecureStore.getItemAsync(KEYS.pinAlgo);
    return storedAlgo !== null && storedAlgo !== CURRENT_ALGO;
  }

  async setupPin(pin: string): Promise<void> {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 digits.');
    }

    const saltHex = await randomHex(16);
    const hash = await derivePinHash(pin, saltHex);

    await SecureStore.setItemAsync(KEYS.pinAlgo, CURRENT_ALGO);
    await SecureStore.setItemAsync(KEYS.pinSalt, saltHex);
    await SecureStore.setItemAsync(KEYS.pinHash, hash);
    await SecureStore.setItemAsync(KEYS.pinFailures, '0');
    await SecureStore.deleteItemAsync(KEYS.pinLockedUntil);
  }

  async verifyPin(pin: string): Promise<boolean> {
    const status = await this.getStatus();

    if (status.isLocked) {
      throw new Error('PIN is temporarily locked. Try again later.');
    }

    const saltHex = await SecureStore.getItemAsync(KEYS.pinSalt);
    const storedHash = await SecureStore.getItemAsync(KEYS.pinHash);
    const storedAlgo = await SecureStore.getItemAsync(KEYS.pinAlgo);

    if (!saltHex || !storedHash) {
      throw new Error('PIN not configured.');
    }

    // If stored with a different algorithm, the hash will never match.
    if (storedAlgo && storedAlgo !== CURRENT_ALGO) {
      throw new Error('PIN_ALGO_MISMATCH');
    }

    const hash = await derivePinHash(pin, saltHex);
    const correct = hash === storedHash;

    if (correct) {
      await SecureStore.setItemAsync(KEYS.pinFailures, '0');
      await SecureStore.deleteItemAsync(KEYS.pinLockedUntil);
      return true;
    }

    const failures = status.failures + 1;
    await SecureStore.setItemAsync(KEYS.pinFailures, String(failures));

    if (
        failures >= MAX_FAILURES_BEFORE_COOLDOWN &&
        failures < MAX_FAILURES_BEFORE_WIPE_OFFER
    ) {
      await SecureStore.setItemAsync(
          KEYS.pinLockedUntil,
          String(Date.now() + COOLDOWN_MS),
      );
    }

    return false;
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
    await SecureStore.deleteItemAsync(KEYS.pinAlgo);
    await SecureStore.deleteItemAsync(KEYS.pinSalt);
    await SecureStore.deleteItemAsync(KEYS.pinHash);
    await SecureStore.deleteItemAsync(KEYS.pinFailures);
    await SecureStore.deleteItemAsync(KEYS.pinLockedUntil);
  }
}

export default new PinService();
