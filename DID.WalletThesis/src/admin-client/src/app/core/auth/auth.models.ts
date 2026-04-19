export interface AuthSession {
  token: string;
  did: string;
  ethAddress: string;
  scope: 'EURoot' | 'MemberState' | 'Ministry' | 'Institution';
  accreditationId: string | null;
  expiresAt: Date;
}

export type AuthState =
  | 'idle'
  | 'challenging'
  | 'signing'
  | 'verifying'
  | 'authenticated'
  | 'error';

export const SCOPE_HIERARCHY: Record<string, number> = {
  EURoot: 4,
  MemberState: 3,
  Ministry: 2,
  Institution: 1,
};
