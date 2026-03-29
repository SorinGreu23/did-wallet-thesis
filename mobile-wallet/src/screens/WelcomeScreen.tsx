import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme, LIGHT_COLORS, DARK_COLORS } from "../context/ThemeContext";
import authService from "../services/authService";

const { width: SCREEN_W } = Dimensions.get("window");

interface WelcomeScreenProps {
  onAuthenticated: () => void;
}

export default function WelcomeScreen({ onAuthenticated }: WelcomeScreenProps) {
  const { colors, themeAnim } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 140,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 14,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleCreateWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      await authService.createWallet();
      await authService.setSessionActive();
      onAuthenticated();
    } catch (e: any) {
      setError(e.message || "Failed to create wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock your wallet",
          fallbackLabel: "Use passcode",
          cancelLabel: "Cancel",
          disableDeviceFallback: false,
        });
        if (!result.success) {
          setLoading(false);
          return;
        }
      }

      await authService.setSessionActive();
      onAuthenticated();
    } catch (e: any) {
      setError(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const bgColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LIGHT_COLORS.background, DARK_COLORS.background],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={colors.text === "#111827" ? "dark-content" : "light-content"}
        backgroundColor="transparent"
        translucent
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* EU Badge */}
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeStar}>★</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          EU Identity Wallet
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Decentralised digital identity{"\n"}powered by blockchain
        </Text>

        {/* Preview card */}
        <Animated.View
          style={[
            styles.previewCard,
            {
              backgroundColor: colors.primary,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <View style={styles.previewCircle1} />
          <View style={styles.previewCircle2} />
          <View style={styles.previewHeader}>
            <Text style={styles.previewLabel}>DIGITAL IDENTITY CARD</Text>
            <Text style={styles.previewStars}>★★★★★★★★★★★★</Text>
          </View>
          <View style={styles.previewLines}>
            <View style={styles.previewLine} />
            <View style={[styles.previewLine, { width: "60%" }]} />
          </View>
          <View style={styles.previewFooter}>
            <View>
              <Text style={styles.previewFooterLabel}>METHOD</Text>
              <Text style={styles.previewFooterValue}>did:ethr</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.previewFooterLabel}>NETWORK</Text>
              <Text style={styles.previewFooterValue}>Sepolia</Text>
            </View>
          </View>
        </Animated.View>

        {/* Features */}
        <View style={styles.features}>
          <Feature
            icon="shield"
            text="Secure key storage"
            colors={colors}
          />
          <Feature
            icon="link"
            text="Blockchain-verified"
            colors={colors}
          />
          <Feature
            icon="lock"
            text="Biometric protection"
            colors={colors}
          />
        </View>

        {error && (
          <Text style={styles.error}>{error}</Text>
        )}
      </Animated.View>

      {/* Action button */}
      <Animated.View style={[styles.bottom, { opacity: fadeAnim }]}>
        <WalletButton
          loading={loading}
          colors={colors}
          onCreateWallet={handleCreateWallet}
          onUnlock={handleUnlock}
        />
      </Animated.View>
    </Animated.View>
  );
}

function WalletButton({
  loading,
  colors,
  onCreateWallet,
  onUnlock,
}: {
  loading: boolean;
  colors: typeof LIGHT_COLORS;
  onCreateWallet: () => void;
  onUnlock: () => void;
}) {
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  React.useEffect(() => {
    authService.hasWallet().then(setHasWallet);
  }, []);

  if (hasWallet === null) return null;

  if (hasWallet) {
    return (
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onUnlock}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="unlock" size={18} color="#fff" />
            <Text style={styles.buttonText}>Unlock Wallet</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.primary }]}
      onPress={onCreateWallet}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Feather name="plus-circle" size={18} color="#fff" />
          <Text style={styles.buttonText}>Create Wallet</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function Feature({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  colors: typeof LIGHT_COLORS;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: colors.primaryLight }]}>
        <Feather name={icon} size={14} color={colors.primary} />
      </View>
      <Text style={[styles.featureText, { color: colors.textSecondary }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 40 : 80,
  },

  badge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  badgeStar: { color: "#FFD700", fontSize: 22, fontWeight: "700" },

  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
  },

  previewCard: {
    width: SCREEN_W - 64,
    borderRadius: 18,
    padding: 22,
    minHeight: 150,
    overflow: "hidden",
    justifyContent: "space-between",
    marginBottom: 32,
    shadowColor: "#003399",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  previewCircle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -60,
    right: -50,
  },
  previewCircle2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -30,
    left: -20,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  previewStars: {
    fontSize: 8,
    color: "#FFD700",
    letterSpacing: 2,
  },
  previewLines: {
    marginVertical: 20,
    gap: 8,
  },
  previewLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    width: "80%",
  },
  previewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewFooterLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  previewFooterValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },

  features: {
    alignSelf: "stretch",
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 14,
    fontWeight: "500",
  },

  error: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: 16,
    textAlign: "center",
  },

  bottom: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 14,
    shadowColor: "#003399",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
