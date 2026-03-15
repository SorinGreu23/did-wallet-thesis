import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
	activeDid: 'wallet.activeDid',
} as const;

class StorageService {
	async getActiveDid(): Promise<string | null> {
		return AsyncStorage.getItem(STORAGE_KEYS.activeDid);
	}

	async setActiveDid(did: string): Promise<void> {
		await AsyncStorage.setItem(STORAGE_KEYS.activeDid, did);
	}

	async clearActiveDid(): Promise<void> {
		await AsyncStorage.removeItem(STORAGE_KEYS.activeDid);
	}
}

export default new StorageService();
