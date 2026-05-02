import React, { createContext, useContext, useState } from 'react';
import { AccountType, WalletProfile } from '../types/wallet';

// ─── Registration state shape ─────────────────────────────────────────────────

export interface RegistrationState {
  accountType: AccountType | null;
  // Personal
  firstName: string;
  lastName: string;
  // University / Enterprise
  legalName: string;
  fiscalCode: string;
  // Common
  email: string;
  country: string;
  county: string;
  city: string;
  address: string;
  // PIN
  pin: string;
  // Consents
  consentTerms: boolean;
  consentGdpr: boolean;
  consentPrivacy: boolean;
}

const INITIAL_STATE: RegistrationState = {
  accountType: null,
  firstName: '',
  lastName: '',
  legalName: '',
  fiscalCode: '',
  email: '',
  country: '',
  county: '',
  city: '',
  address: '',
  pin: '',
  consentTerms: false,
  consentGdpr: false,
  consentPrivacy: false,
};

// ─── Context ─────────────────────────────────────────────────────────────────

interface RegistrationContextValue {
  state: RegistrationState;
  update: (patch: Partial<RegistrationState>) => void;
  reset: () => void;
  /** DID + walletAddress set after the DID is created during the wizard. */
  did: string;
  walletAddress: string;
  setIdentity: (did: string, walletAddress: string) => void;
  /** accreditationId resolved from the chain for university/enterprise. */
  accreditationId: string;
  setAccreditationId: (id: string) => void;
}

const RegistrationContext = createContext<RegistrationContextValue>({
  state: INITIAL_STATE,
  update: () => {},
  reset: () => {},
  did: '',
  walletAddress: '',
  setIdentity: () => {},
  accreditationId: '',
  setAccreditationId: () => {},
});

export function RegistrationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RegistrationState>(INITIAL_STATE);
  const [did, setDid] = useState('');
  const [walletAddress, setWalletAddressState] = useState('');
  const [accreditationId, setAccreditationIdState] = useState('');

  const update = (patch: Partial<RegistrationState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const reset = () => {
    setState(INITIAL_STATE);
    setDid('');
    setWalletAddressState('');
    setAccreditationIdState('');
  };

  const setIdentity = (newDid: string, newAddress: string) => {
    setDid(newDid);
    setWalletAddressState(newAddress);
  };

  return (
    <RegistrationContext.Provider
      value={{
        state,
        update,
        reset,
        did,
        walletAddress,
        setIdentity,
        accreditationId,
        setAccreditationId: setAccreditationIdState,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
}

export const useRegistration = () => useContext(RegistrationContext);
