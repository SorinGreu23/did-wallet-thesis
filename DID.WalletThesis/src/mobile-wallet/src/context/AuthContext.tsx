import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";
import {AppState, AppStateStatus} from "react-native";
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
    onAuthenticated: () => {
    },
    signOut: async () => {
    },
});

export function AuthProvider({children}: { children: React.ReactNode }) {
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
            const walletExists = await authService.hasWallet();
            setHasWallet(walletExists);
            setState("unauthenticated");
        })();
    }, []);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", async (nextAppState) => {
            const previousAppState = appState.current;
            appState.current = nextAppState;

            const leavingApp =
                previousAppState === "active" &&
                (nextAppState === "inactive" || nextAppState === "background");

            if (!leavingApp) return;
            if (!hasWalletRef.current) return;
            if (stateRef.current !== "authenticated") return;

            await authService.clearSession();
            setState("unauthenticated");
        });

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
        <AuthContext.Provider value={{state, hasWallet, onAuthenticated, signOut}}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);