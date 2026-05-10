import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { DIDInfo } from '../services/didService';
import walletService from '../services/walletService';
import pinService from '../services/pinService';
import { useTheme, LIGHT_COLORS, DARK_COLORS } from '../context/ThemeContext';

const SECTION_COUNT = 4;

// ─── Lock screen ──────────────────────────────────────────────────────────────

interface LockScreenProps {
  onUnlock: () => void;
  colors: typeof LIGHT_COLORS;
}

function LockScreen({ onUnlock, colors }: LockScreenProps) {
  const [mode, setMode] = useState<'checking' | 'biometric' | 'pin'>('checking');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => { void detect(); }, []);

  const detect = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      setMode('biometric');
      void tryBiometric();
    } else {
      setMode('pin');
    }
  };

  const tryBiometric = async () => {
    setError(null);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to view your wallet',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (result.success) {
      onUnlock();
    } else {
      setError('Authentication failed. Try again.');
    }
  };

  const pressDigit = async (digit: string) => {
    if (locked) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === 6) {
      try {
        const ok = await pinService.verifyPin(next);
        if (ok) {
          onUnlock();
        } else {
          const status = await pinService.getStatus();
          if (status.isLocked) {
            setLocked(true);
            const secs = Math.ceil(((status.lockedUntil ?? 0) - Date.now()) / 1000);
            setError(`Too many attempts. Try again in ${secs}s.`);
            setTimeout(() => { setLocked(false); setPin(''); setError(null); },
              (status.lockedUntil ?? 0) - Date.now());
          } else {
            setError('Incorrect PIN. Try again.');
          }
          setPin('');
        }
      } catch (e: any) {
        if (e?.message === 'PIN_ALGO_MISMATCH') {
          await pinService.clearPin();
          setError('Security upgrade required. Please re-register your PIN.');
        } else {
          setError(e?.message ?? 'PIN error.');
        }
        setPin('');
      }
    }
  };

  const pressBack = () => { if (pin.length > 0) setPin(p => p.slice(0, -1)); };

  if (mode === 'checking') {
    return (
      <View style={[lockStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (mode === 'biometric') {
    return (
      <View style={[lockStyles.container, { backgroundColor: colors.background }]}>
        <View style={[lockStyles.iconWrap, { backgroundColor: colors.primaryLight }]}>
          <Feather name="lock" size={36} color={colors.primary} />
        </View>
        <Text style={[lockStyles.title, { color: colors.text }]}>Wallet</Text>
        <Text style={[lockStyles.subtitle, { color: colors.textSecondary }]}>
          Authentication required to view your identity details.
        </Text>
        {error && <Text style={[lockStyles.errorText, { color: '#dc2626' }]}>{error}</Text>}
        <TouchableOpacity
          style={[lockStyles.btn, { backgroundColor: colors.primary }]}
          onPress={tryBiometric}
          activeOpacity={0.85}
        >
          <Feather name="shield" size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={lockStyles.btnText}>Authenticate</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // PIN mode
  const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <View style={[lockStyles.container, { backgroundColor: colors.background }]}>
      <View style={[lockStyles.iconWrap, { backgroundColor: colors.primaryLight }]}>
        <Feather name="lock" size={32} color={colors.primary} />
      </View>
      <Text style={[lockStyles.title, { color: colors.text }]}>Enter PIN</Text>
      <Text style={[lockStyles.subtitle, { color: colors.textSecondary }]}>
        Enter your 6-digit PIN to access your wallet.
      </Text>

      {/* Dots */}
      <View style={lockStyles.dotsRow}>
        {[0,1,2,3,4,5].map(i => (
          <View
            key={i}
            style={[
              lockStyles.dot,
              { borderColor: colors.primary },
              i < pin.length && { backgroundColor: colors.primary },
            ]}
          />
        ))}
      </View>

      {error && <Text style={[lockStyles.errorText, { color: '#dc2626' }]}>{error}</Text>}

      {/* Numpad */}
      <View style={lockStyles.numpad}>
        {DIGITS.map((d, i) => (
          d === '' ? <View key={i} style={lockStyles.numpadCell} /> :
          <TouchableOpacity
            key={i}
            style={[lockStyles.numpadCell, lockStyles.numpadBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={d === '⌫' ? pressBack : () => pin.length < 6 && pressDigit(d)}
            activeOpacity={0.7}
            disabled={locked}
          >
            <Text style={[lockStyles.numpadBtnText, { color: colors.text }]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const lockStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  iconWrap: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 10 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  errorText: { fontSize: 13, marginBottom: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 14, marginVertical: 20 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, backgroundColor: 'transparent' },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: 264, marginTop: 8, gap: 12 },
  numpadCell: { width: 80, height: 58, alignItems: 'center', justifyContent: 'center' },
  numpadBtn: { borderRadius: 12, borderWidth: 1 },
  numpadBtnText: { fontSize: 20, fontWeight: '600' },
});

// ─── Info section ─────────────────────────────────────────────────────────────

function InfoSection({
  label, value, onCopy, copied, mono, multiline, colors,
}: {
  label: string; value: string; onCopy: () => void; copied: boolean;
  mono?: boolean; multiline?: boolean; colors: typeof LIGHT_COLORS;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text
          style={[styles.sectionValue, { color: colors.text }, mono && styles.sectionValueMono]}
          numberOfLines={multiline ? 3 : 1}
          selectable
        >
          {value}
        </Text>
        <TouchableOpacity
          style={[
            styles.copyBtn,
            { backgroundColor: colors.primaryLight, borderColor: 'rgba(0,51,153,0.15)' },
            copied && { backgroundColor: colors.successLight, borderColor: 'rgba(5,150,105,0.2)' },
          ]}
          onPress={onCopy}
        >
          <Text style={[styles.copyBtnText, { color: colors.primary }]}>{copied ? '✓  Copied' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Wallet screen ────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const { colors, themeAnim } = useTheme();

  const [unlocked, setUnlocked] = useState(false);
  const [identity, setIdentity] = useState<DIDInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Re-lock every time the screen is focused so auth is always required
  useFocusEffect(
    useCallback(() => {
      setUnlocked(false);
      setIdentity(null);
    }, [])
  );

  const sectionAnims = useRef(
    Array.from({ length: SECTION_COUNT }, () => ({
      opacity:    new Animated.Value(0),
      translateY: new Animated.Value(20),
    }))
  ).current;

  useEffect(() => {
    if (unlocked) {
      void loadIdentity();
    }
  }, [unlocked]);

  const loadIdentity = async () => {
    setLoading(true);
    try {
      const id = await walletService.getIdentity();
      setIdentity(id);
    } catch (e) {
      console.error('Failed to load identity:', e);
    } finally {
      setLoading(false);
      runSectionEntrance();
    }
  };

  const runSectionEntrance = () => {
    sectionAnims.forEach(a => { a.opacity.setValue(0); a.translateY.setValue(20); });
    const anims = sectionAnims.map((a, i) =>
      Animated.sequence([
        Animated.delay(i * 90),
        Animated.parallel([
          Animated.timing(a.opacity,    { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.spring(a.translateY, { toValue: 0, damping: 18, stiffness: 160, useNativeDriver: true }),
        ]),
      ])
    );
    Animated.parallel(anims).start();
  };

  const copy = async (value: string, key: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const bgColor = themeAnim.interpolate({
    inputRange: [0, 1], outputRange: [LIGHT_COLORS.background, DARK_COLORS.background],
  });
  const surfaceColor = themeAnim.interpolate({
    inputRange: [0, 1], outputRange: [LIGHT_COLORS.surface, DARK_COLORS.surface],
  });
  const borderColor = themeAnim.interpolate({
    inputRange: [0, 1], outputRange: [LIGHT_COLORS.border, DARK_COLORS.border],
  });

  return (
    <Animated.View style={[styles.safe, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={colors.text === '#111827' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* Top bar */}
      <Animated.View
        style={[styles.topBar, { backgroundColor: surfaceColor, borderBottomColor: borderColor }]}
      >
        <View style={styles.topBarLeft}>
          <View style={[styles.topBarIconWrap, { backgroundColor: colors.primary }]}>
            <Feather name="credit-card" size={20} color="#fff" />
          </View>
          <View>
            <Text style={[styles.topBarTitle, { color: colors.text }]}>Wallet</Text>
            <Text style={[styles.topBarSub, { color: colors.textMuted }]}>Your digital identity</Text>
          </View>
        </View>
        {unlocked && (
          <TouchableOpacity
            onPress={() => setUnlocked(false)}
            style={[styles.lockBtn, { backgroundColor: colors.primaryLight }]}
            activeOpacity={0.8}
          >
            <Feather name="lock" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Content */}
      {!unlocked ? (
        <LockScreen onUnlock={() => setUnlocked(true)} colors={colors} />
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : identity ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 0 — Digital ID card */}
          <Animated.View style={{ opacity: sectionAnims[0].opacity, transform: [{ translateY: sectionAnims[0].translateY }] }}>
            <View style={[styles.idCard, { backgroundColor: colors.primary }]}>
              <View style={styles.idCardCircle1} />
              <View style={styles.idCardCircle2} />
              <View style={styles.idCardHeader}>
                <Text style={styles.idCardTypeLabel}>Digital Identity Card</Text>
                <View style={styles.idCardEU}>
                  <Text style={styles.idCardEUStar}>★★★★★★★★★★★★</Text>
                </View>
              </View>
              <Text style={styles.idCardAddress} numberOfLines={1}>{identity.ethereumAddress}</Text>
              <View style={styles.idCardFooter}>
                <View>
                  <Text style={styles.idCardFooterLabel}>METHOD</Text>
                  <Text style={styles.idCardFooterValue}>did:ethr</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.idCardFooterLabel}>NETWORK</Text>
                  <Text style={styles.idCardFooterValue}>Sepolia</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Section 1 — DID */}
          <Animated.View style={{ opacity: sectionAnims[1].opacity, transform: [{ translateY: sectionAnims[1].translateY }] }}>
            <InfoSection
              label="IDENTIFIER (DID)"
              value={identity.did}
              onCopy={() => copy(identity.did, 'did')}
              copied={copied === 'did'}
              mono multiline
              colors={colors}
            />
          </Animated.View>

          {/* Section 2 — Address */}
          <Animated.View style={{ opacity: sectionAnims[2].opacity, transform: [{ translateY: sectionAnims[2].translateY }] }}>
            <InfoSection
              label="ETHEREUM ADDRESS"
              value={identity.ethereumAddress}
              onCopy={() => copy(identity.ethereumAddress, 'addr')}
              copied={copied === 'addr'}
              mono
              colors={colors}
            />
          </Animated.View>

          {/* Section 3 — Keys */}
          <Animated.View style={{ opacity: sectionAnims[3].opacity, transform: [{ translateY: sectionAnims[3].translateY }] }}>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CRYPTOGRAPHIC KEYS</Text>
              <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {identity.keys.map((key, i) => (
                  <View
                    key={key.kid}
                    style={[
                      styles.keyRow,
                      i < identity.keys.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={[styles.keyTypePill, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.keyTypePillText, { color: colors.primary }]}>
                        {key.type.includes('Secp256k1') ? 'EC' : 'ED'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.keyTypeName, { color: colors.text }]}>{key.type}</Text>
                      <Text style={[styles.keyHex, { color: colors.textMuted }]} numberOfLines={1}>
                        {key.publicKeyHex.slice(0, 20)}…{key.publicKeyHex.slice(-8)}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => copy(key.publicKeyHex, key.kid)}>
                      <Text style={[styles.copySmall, { color: copied === key.kid ? colors.success : colors.primary }]}>
                        {copied === key.kid ? '✓' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      ) : null}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? ((StatusBar.currentHeight ?? 0) + 12) : 68,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topBarIconWrap: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  topBarSub:   { fontSize: 12, marginTop: 3 },

  lockBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Identity card
  idCard: {
    borderRadius: 18, padding: 22, marginBottom: 24,
    minHeight: 180, overflow: 'hidden', justifyContent: 'space-between',
    shadowColor: '#003399',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  idCardCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -50,
  },
  idCardCircle2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: -30, left: -20,
  },
  idCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  idCardTypeLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  idCardEU: { alignItems: 'flex-end' },
  idCardEUStar: { fontSize: 8, color: '#FFD700', letterSpacing: 2 },
  idCardAddress: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 13, color: '#fff', fontWeight: '600', letterSpacing: 0.5,
    marginTop: 20, marginBottom: 20,
  },
  idCardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  idCardFooterLabel: {
    fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
  },
  idCardFooterValue: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  // Info sections
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 },
  sectionBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  sectionValue: { fontSize: 14, marginBottom: 10 },
  sectionValueMono: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 12 },
  copyBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  copyBtnText: { fontSize: 12, fontWeight: '600' },

  // Keys
  keyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  keyTypePill: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  keyTypePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  keyTypeName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  keyHex: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  copySmall: { fontSize: 12, fontWeight: '600', paddingHorizontal: 6 },
});
