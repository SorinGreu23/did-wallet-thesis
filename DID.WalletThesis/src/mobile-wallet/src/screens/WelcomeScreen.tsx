import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DARK_COLORS, LIGHT_COLORS, useTheme } from '../context/ThemeContext';
import { RegistrationProvider } from '../context/RegistrationContext';
import AccountTypeChooserScreen from './AccountTypeChooserScreen';
import RegistrationWizardScreen from './RegistrationWizardScreen';
import { AccountType } from '../types/wallet';

const { width: SCREEN_W } = Dimensions.get('window');

type Stage = 'splash' | 'chooser' | 'wizard';

interface WelcomeScreenProps {
  onAuthenticated: () => void;
}

export default function WelcomeScreen({ onAuthenticated }: WelcomeScreenProps) {
  return (
    <RegistrationProvider>
      <WelcomeFlow onAuthenticated={onAuthenticated} />
    </RegistrationProvider>
  );
}

function WelcomeFlow({ onAuthenticated }: WelcomeScreenProps) {
  const { colors, themeAnim } = useTheme();
  const [stage, setStage] = useState<Stage>('splash');
  const [accountType, setAccountType] = useState<AccountType>('personal');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 140, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  const bgColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LIGHT_COLORS.background, DARK_COLORS.background],
  });

  if (stage === 'chooser') {
    return (
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}>
        <AccountTypeChooserScreen
          onChoose={(type) => {
            setAccountType(type);
            setStage('wizard');
          }}
          onBack={() => setStage('splash')}
        />
      </Animated.View>
    );
  }

  if (stage === 'wizard') {
    return (
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}>
        <RegistrationWizardScreen
          accountType={accountType}
          onComplete={onAuthenticated}
          onBack={() => setStage('chooser')}
        />
      </Animated.View>
    );
  }

  // ── Splash ────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={colors.text === '#111827' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeStar}>★</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>EU Identity Wallet</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Decentralised digital identity{'\n'}powered by blockchain
        </Text>

        <Animated.View
          style={[styles.previewCard, { backgroundColor: colors.primary, transform: [{ scale: cardScale }] }]}
        >
          <View style={styles.previewCircle1} />
          <View style={styles.previewCircle2} />
          <View style={styles.previewHeader}>
            <Text style={styles.previewLabel}>DIGITAL IDENTITY CARD</Text>
            <Text style={styles.previewStars}>★★★★★★★★★★★★</Text>
          </View>
          <View style={styles.previewLines}>
            <View style={styles.previewLine} />
            <View style={[styles.previewLine, { width: '60%' }]} />
          </View>
          <View style={styles.previewFooter}>
            <View>
              <Text style={styles.previewFooterLabel}>METHOD</Text>
              <Text style={styles.previewFooterValue}>did:ethr</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.previewFooterLabel}>NETWORK</Text>
              <Text style={styles.previewFooterValue}>Sepolia</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.features}>
          {[
            { icon: 'shield', text: 'Secure key storage' },
            { icon: 'link', text: 'Blockchain-verified' },
            { icon: 'lock', text: 'PIN & biometric protection' },
          ].map(({ icon, text }) => (
            <View key={text} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primaryLight }]}>
                <Feather name={icon as any} size={14} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>{text}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[styles.bottom, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => setStage('chooser')}
          activeOpacity={0.85}
        >
          <Feather name="arrow-right" size={18} color="#fff" />
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 40 : 80,
  },
  badge: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  badgeStar: { color: '#FFD700', fontSize: 22, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  previewCard: {
    width: SCREEN_W - 64,
    borderRadius: 18, padding: 22, minHeight: 150,
    overflow: 'hidden', justifyContent: 'space-between', marginBottom: 32,
    shadowColor: '#003399', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  previewCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -50,
  },
  previewCircle2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  previewLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1 },
  previewStars: { fontSize: 8, color: '#FFD700', letterSpacing: 2 },
  previewLines: { marginVertical: 20, gap: 8 },
  previewLine: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)', width: '80%' },
  previewFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  previewFooterLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  previewFooterValue: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  features: { alignSelf: 'stretch', gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, fontWeight: '500' },
  bottom: { paddingHorizontal: 32, paddingBottom: Platform.OS === 'ios' ? 48 : 32 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 54, borderRadius: 14,
    shadowColor: '#003399', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
});
