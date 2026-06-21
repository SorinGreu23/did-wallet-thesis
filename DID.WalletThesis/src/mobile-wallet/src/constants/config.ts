import Constants from 'expo-constants';

function getDevelopmentHost(): string {
  const configuredHost = process.env.EXPO_PUBLIC_DEV_HOST?.trim();
  if (configuredHost) return configuredHost;

  // Expo supplies the Metro host at runtime. Unlike a shell environment
  // variable, this remains correct after Fast Refresh and app relaunches.
  const runtimeHost = Constants.expoConfig?.hostUri
    ?.replace(/^[a-z]+:\/\//i, '')
    .split(':')[0]
    .trim();

  return runtimeHost || 'localhost';
}

const HOST = getDevelopmentHost();

export const CONFIG = {
  DID_METHOD: 'did:ethr',
  STORAGE_KEY: 'did-wallet-data',
  APP_NAME: 'EU Identity Wallet',
  ANVIL_RPC_URL: `http://${HOST}:8545`,
  ANVIL_CHAIN_ID: 31337,
  IDENTITY_SERVICE_URL: `http://${HOST}:5259`,
  CREDENTIAL_SERVICE_URL: `http://${HOST}:5214`,
  ACCREDITATION_SERVICE_URL: `http://${HOST}:5211`,
};

export const COLORS = {
  primary: '#003399',
  primaryDark: '#002277',
  primaryLight: '#e8edfa',
  background: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  success: '#059669',
  successLight: '#d1fae5',
};
