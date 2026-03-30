import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { DARK_COLORS, LIGHT_COLORS, useTheme } from "../context/ThemeContext";
import authService, { UserProfile } from "../services/authService";

interface UnlockSplashScreenProps {
  onAuthenticated: () => void;
}

export default function UnlockSplashScreen({ onAuthenticated }: UnlockSplashScreenProps) {
  const { colors, themeAnim } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [biometricLabel, setBiometricLabel] = useState("Face ID");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(28)).current;
  const haloAnim = useRef(new Animated.Value(0.92)).current;
  const didAutoPrompt = useRef(false);

  useEffect(() => {
    void loadProfile();
    void detectBiometricLabel();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.spring(translateAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 150,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(haloAnim, {
            toValue: 1.04,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(haloAnim, {
            toValue: 0.92,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();

    const timeout = setTimeout(() => {
      if (!didAutoPrompt.current) {
        didAutoPrompt.current = true;
        void handleUnlock();
      }
    }, 480);

    return () => clearTimeout(timeout);
  }, []);

  const loadProfile = async () => {
    const storedProfile = await authService.getProfile();
    setProfile(storedProfile);
  };

  const detectBiometricLabel = async () => {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel("Face ID");
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel("Touch ID");
      } else if (types.length > 0) {
        setBiometricLabel("biometrics");
      } else {
        setBiometricLabel("device passcode");
      }
    } catch {
      setBiometricLabel("device passcode");
    }
  };

  const handleUnlock = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock your EU Identity Wallet",
          subtitle: "Verify your identity to continue",
          fallbackLabel: "Use passcode",
          cancelLabel: "Not now",
          disableDeviceFallback: false,
        });

        if (!result.success) {
          if (result.error && result.error !== "user_cancel" && result.error !== "system_cancel") {
            setError("Authentication did not complete. Try again.");
          }
          return;
        }
      }

      await authService.setSessionActive();
      onAuthenticated();
    } catch (e: any) {
      setError(e?.message || "Failed to unlock wallet");
    } finally {
      setLoading(false);
    }
  };

  const backgroundColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LIGHT_COLORS.background, DARK_COLORS.background],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}> 
      <StatusBar
        barStyle={colors.text === "#111827" ? "dark-content" : "light-content"}
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.backdrop} pointerEvents="none">
        <View style={[styles.backdropOrb, styles.backdropOrbPrimary, { backgroundColor: colors.primaryLight }]} />
        <View style={[styles.backdropOrb, styles.backdropOrbSecondary, { backgroundColor: colors.primary }]} />
      </View>

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: translateAnim }] },
        ]}
      >
        <Animated.View style={[styles.halo, { backgroundColor: colors.primaryLight, transform: [{ scale: haloAnim }] }]}>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Feather name="shield" size={32} color="#ffffff" />
          </View>
        </Animated.View>

        <Text style={[styles.eyebrow, { color: colors.primary }]}>SECURE ACCESS</Text>
        <Text style={[styles.title, { color: colors.text }]}>Welcome back{profile?.firstName ? `, ${profile.firstName}` : ""}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Use {biometricLabel} to continue to your EU Identity Wallet.</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}>
              <Feather name="smartphone" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Wallet protected</Text>
              <Text style={[styles.cardBody, { color: colors.textSecondary }]}>Your keys stay on this device and remain locked until the biometric check passes.</Text>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.primaryLight }]}> 
              <Feather name="alert-circle" size={16} color={colors.primary} />
              <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => void handleUnlock()}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Feather
                  name={biometricLabel === "Touch ID" ? "fingerprint" : "shield"}
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.buttonText}>Continue with {biometricLabel}</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.hint, { color: colors.textMuted }]}>If biometrics are unavailable, the device passcode fallback will be used automatically.</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  backdropOrb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.16,
  },
  backdropOrbPrimary: {
    width: 280,
    height: 280,
    top: -40,
    right: -70,
  },
  backdropOrbSecondary: {
    width: 220,
    height: 220,
    bottom: 40,
    left: -80,
  },
  content: {
    alignItems: "center",
  },
  halo: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.7,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 28,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 18,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    minHeight: 54,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});