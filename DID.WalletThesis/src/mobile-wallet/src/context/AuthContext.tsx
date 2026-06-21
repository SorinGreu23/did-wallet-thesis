import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
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

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const stateRef = useRef<AuthState>("loading");
  const hasWalletRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    hasWalletRef.current = hasWallet;
  }, [hasWallet]);

  useEffect(() => {
    (async () => {
      if (__DEV__ && process.env.EXPO_PUBLIC_RESET_WALLET === "1") {
        await authService.resetDevelopmentData();
        console.log("[WalletReset] Local wallet state cleared.");
      }

      const walletExists = await authService.hasWallet();
      setHasWallet(walletExists);
      setState("unauthenticated");
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        appState.current = nextAppState;

        // iOS commonly transitions active → inactive → background when the
        // user switches apps or locks the screen. Lock on the background
        // state itself so both direct and intermediate transitions work.
        // Do not lock on "inactive", which is also used for system overlays
        // such as biometric prompts and Control Centre.
        if (nextAppState !== "background") return;
        if (!hasWalletRef.current) return;
        if (stateRef.current !== "authenticated") return;

        await authService.clearSession();
        setState("unauthenticated");
      },
    );

    return () => {
      subscription.remove();
    };
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
    <AuthContext.Provider
      value={{ state, hasWallet, onAuthenticated, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
