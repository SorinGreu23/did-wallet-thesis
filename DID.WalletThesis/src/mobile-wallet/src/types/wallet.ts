export type AccountType = 'personal' | 'university' | 'enterprise';

export interface WalletProfileBase {
  accountType: AccountType;
  did: string;
  walletAddress: string;
  country: string;
  county: string;
  city: string;
  address: string;
  email: string;
}

export interface PersonalWalletProfile extends WalletProfileBase {
  accountType: 'personal';
  firstName: string;
  lastName: string;
}

export interface UniversityWalletProfile extends WalletProfileBase {
  accountType: 'university';
  legalName: string;
  accreditationId: string;
}

export interface EnterpriseWalletProfile extends WalletProfileBase {
  accountType: 'enterprise';
  legalName: string;
  fiscalCode: string;
  accreditationId: string;
}

export type WalletProfile =
  | PersonalWalletProfile
  | UniversityWalletProfile
  | EnterpriseWalletProfile;

export interface EnterpriseRegistrationRequest {
  id?: string;
  legalName: string;
  fiscalCode: string;
  country: string;
  walletAddress: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  accreditationId?: string;
}
