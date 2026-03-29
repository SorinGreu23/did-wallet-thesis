import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import authService from "../services/authService";

type AuthState = "loading" | "unauthenticated" | "authenticated";

interface AuthContextValue {
  state: AuthState;
  /** True if the device already has a wallet (returning user). */
  hasWallet: boolean;
  /** Called after successful wallet creation or biometric unlock. */
  onAuthenticated: () => void;
  /** Sign out — clears the session but keeps the wallet. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  state: "loading",
  hasWallet: false,
  onAuthenticated: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>("loading");
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    (async () => {
      const walletExists = await authService.hasWallet();
      setHasWallet(walletExists);

      if (walletExists) {
        const sessionActive = await authService.isSessionActive();
        setState(sessionActive ? "authenticated" : "unauthenticated");
      } else {
        setState("unauthenticated");
      }
    })();
  }, []);

  const onAuthenticated = useCallback(() => {
    setHasWallet(true);
    setState("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    await authService.clearSession();
    setState("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ state, hasWallet, onAuthenticated, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
