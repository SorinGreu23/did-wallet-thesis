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
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme, LIGHT_COLORS, DARK_COLORS } from "../context/ThemeContext";
import authService from "../services/authService";

const { width: SCREEN_W } = Dimensions.get("window");

type Step = "landing" | "register";

interface WelcomeScreenProps {
  onAuthenticated: () => void;
}

export default function WelcomeScreen({ onAuthenticated }: WelcomeScreenProps) {
  const { colors, themeAnim } = useTheme();
  const [step, setStep] = useState<Step>("landing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  // Registration fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    authService.hasWallet().then(setHasWallet);
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

  const animateToRegister = () => {
    setStep("register");
    formFade.setValue(0);
    formSlide.setValue(30);
    Animated.parallel([
      Animated.timing(formFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(formSlide, {
        toValue: 0,
        damping: 18,
        stiffness: 140,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleRegister = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast) {
      setError("First and last name are required");
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authService.saveProfile({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: trimmedEmail,
      });
      await authService.createWallet();
      await authService.setSessionActive();
      onAuthenticated();
    } catch (e: any) {
      setError(e.message || "Failed to create wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
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

      {step === "landing" ? (
        <LandingView
          colors={colors}
          fadeAnim={fadeAnim}
          slideAnim={slideAnim}
          cardScale={cardScale}
          error={error}
          loading={loading}
          hasWallet={hasWallet}
          onGetStarted={animateToRegister}
          onUnlock={handleBiometricUnlock}
        />
      ) : (
        <RegisterView
          colors={colors}
          formFade={formFade}
          formSlide={formSlide}
          firstName={firstName}
          lastName={lastName}
          email={email}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onEmailChange={setEmail}
          error={error}
          loading={loading}
          onSubmit={handleRegister}
          onBack={() => { setStep("landing"); setError(null); }}
        />
      )}
    </Animated.View>
  );
}

/* ─── Landing View ─── */

function LandingView({
  colors,
  fadeAnim,
  slideAnim,
  cardScale,
  error,
  loading,
  hasWallet,
  onGetStarted,
  onUnlock,
}: {
  colors: typeof LIGHT_COLORS;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  cardScale: Animated.Value;
  error: string | null;
  loading: boolean;
  hasWallet: boolean | null;
  onGetStarted: () => void;
  onUnlock: () => void;
}) {
  return (
    <>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeStar}>★</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          EU Identity Wallet
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Decentralised digital identity{"\n"}powered by blockchain
        </Text>

        <Animated.View
          style={[
            styles.previewCard,
            { backgroundColor: colors.primary, transform: [{ scale: cardScale }] },
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

        <View style={styles.features}>
          <Feature icon="shield" text="Secure key storage" colors={colors} />
          <Feature icon="link" text="Blockchain-verified" colors={colors} />
          <Feature icon="lock" text="Biometric protection" colors={colors} />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </Animated.View>

      <Animated.View style={[styles.bottom, { opacity: fadeAnim }]}>
        {hasWallet === null ? null : hasWallet ? (
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
                <Text style={styles.buttonText}>Unlock with Face ID</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={onGetStarted}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Feather name="arrow-right" size={18} color="#fff" />
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </>
  );
}

/* ─── Registration View ─── */

function RegisterView({
  colors,
  formFade,
  formSlide,
  firstName,
  lastName,
  email,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  error,
  loading,
  onSubmit,
  onBack,
}: {
  colors: typeof LIGHT_COLORS;
  formFade: Animated.Value;
  formSlide: Animated.Value;
  firstName: string;
  lastName: string;
  email: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  error: string | null;
  loading: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.registerScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.registerContent,
            { opacity: formFade, transform: [{ translateY: formSlide }] },
          ]}
        >
          {/* Back button */}
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={[styles.registerBadge, { backgroundColor: colors.primaryLight }]}>
            <Feather name="user-plus" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.registerTitle, { color: colors.text }]}>
            Create your account
          </Text>
          <Text style={[styles.registerSubtitle, { color: colors.textSecondary }]}>
            Your identity wallet will be created{"\n"}securely on this device
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  First name *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={firstName}
                  onChangeText={onFirstNameChange}
                  placeholder="John"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Last name *
                </Text>
                <TextInput
                  ref={lastNameRef}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={lastName}
                  onChangeText={onLastNameChange}
                  placeholder="Doe"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Email
              </Text>
              <TextInput
                ref={emailRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={email}
                onChangeText={onEmailChange}
                placeholder="john.doe@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={canSubmit ? onSubmit : undefined}
              />
            </View>
          </View>

          {/* Security note */}
          <View style={[styles.securityNote, { backgroundColor: colors.primaryLight }]}>
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              Your data is stored locally on this device and protected by biometric authentication.
              No data is sent to any server.
            </Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
        </Animated.View>
      </ScrollView>

      {/* Submit button */}
      <Animated.View style={[styles.bottom, { opacity: formFade }]}>
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: canSubmit ? colors.primary : colors.border,
            },
          ]}
          onPress={onSubmit}
          disabled={loading || !canSubmit}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.buttonText}>Create Wallet</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

/* ─── Shared Components ─── */

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

/* ─── Styles ─── */

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

  /* ─── Register step ─── */
  registerScroll: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 20 : 60,
    paddingBottom: 16,
  },
  registerContent: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  registerBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  registerTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  registerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
  },

  form: {
    gap: 16,
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  nameField: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },

  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
