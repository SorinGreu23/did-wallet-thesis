import AsyncStorage from '@react-native-async-storage/async-storage';
import { PresentationResponse, PresentationPurpose } from '../types/presentation';

const STORAGE_KEY = 'vp_history';

export interface StoredPresentation {
  id: string;
  purpose: PresentationPurpose | string;
  verifierDid: string;
  response: PresentationResponse;
  submittedAt: string;
}

async function list(): Promise<StoredPresentation[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredPresentation[];
  } catch {
    return [];
  }
}

async function save(entry: StoredPresentation): Promise<void> {
  const existing = await list();
  // newest first
  const updated = [entry, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

async function clear(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export default { list, save, clear };
