import React, { useEffect, useRef, useState } from 'react';
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
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { DIDInfo } from '../services/didService';
import walletService from '../services/walletService';
import { useTheme, LIGHT_COLORS, DARK_COLORS } from '../context/ThemeContext';
import CredentialsScreen from './CredentialsScreen';

type Tab = 'credentials' | 'identity';

const SCREEN_W = Dimensions.get('window').width;
const TAB_W = SCREEN_W / 2;
const SECTION_COUNT = 4;

// ─── Animated dark-mode toggle ────────────────────────────────────────────────

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // spin + pop scale, then call toggle after half-spin
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 0.65,
          damping: 8,
          stiffness: 320,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 10,
          stiffness: 260,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => rotateAnim.setValue(0));

    toggleTheme();
  };

  const { colors } = useTheme();

  const rotate = rotateAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[styles.toggleBtn, { backgroundColor: colors.primaryLight }]}
    >
      <Animated.View style={{ transform: [{ rotate }, { scale: scaleAnim }] }}>
        <Feather
          name={isDark ? 'sun' : 'moon'}
          size={18}
          color={colors.primary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors, themeAnim } = useTheme();

  const [identity, setIdentity] = useState<DIDInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('credentials');
  const [identityUnlocked, setIdentityUnlocked] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentSlide   = useRef(new Animated.Value(0)).current;

  const sectionAnims = useRef(
    Array.from({ length: SECTION_COUNT }, () => ({
      opacity:    new Animated.Value(0),
      translateY: new Animated.Value(20),
    }))
  ).current;

  useEffect(() => { void loadIdentity(); }, []);

  const loadIdentity = async () => {
    setLoading(true);
    try {
      const id = await walletService.getIdentity();
      setIdentity(id);
    } catch (e) {
      console.error('Failed to load identity:', e);
    } finally {
      setLoading(false);
    }
  };

  const animateIndicator = (tab: Tab) => {
    Animated.spring(indicatorAnim, {
      toValue: tab === 'credentials' ? 0 : 1,
      damping: 22, stiffness: 200, useNativeDriver: true,
    }).start();
  };

  const animateContentSwitch = (after: () => void) => {
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(contentSlide,   { toValue: 12, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      after();
      contentSlide.setValue(-10);
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(contentSlide,   { toValue: 0, damping: 20, stiffness: 180, useNativeDriver: true }),
      ]).start();
    });
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

  const openCredentialsTab = () => {
    if (activeTab === 'credentials') return;
    animateIndicator('credentials');
    animateContentSwitch(() => { setActiveTab('credentials'); setIdentityUnlocked(false); });
  };

  const openIdentityTab = async () => {
    if (activeTab === 'identity') return;
    if (!identityUnlocked) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify your identity',
          fallbackLabel: 'Use passcode',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });
        if (!result.success) return;
      }
      setIdentityUnlocked(true);
    }
    animateIndicator('identity');
    animateContentSwitch(() => setActiveTab('identity'));
    setTimeout(runSectionEntrance, 180);
  };

  const copy = async (value: string, key: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [TAB_W * 0.2, TAB_W + TAB_W * 0.2],
  });

  // ── Animated background colors ──────────────────────────────────────────────
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
      <StatusBar barStyle={colors.text === '#111827' ? 'dark-content' : 'light-content'}
        backgroundColor="transparent" translucent />

      {/* Top bar */}
      <Animated.View style={[styles.topBar, { backgroundColor: surfaceColor, borderBottomColor: borderColor }]}>
        <View style={styles.topBarLeft}>
          <View style={[styles.topBarStarBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.topBarStar}>★</Text>
          </View>
          <View>
            <Text style={[styles.topBarTitle, { color: colors.text }]}>EU Identity Wallet</Text>
            <Text style={[styles.topBarSub, { color: colors.textMuted }]}>Decentralised · Verifiable</Text>
          </View>
        </View>
        <ThemeToggle />
      </Animated.View>

      {/* Tab bar with sliding indicator */}
      <Animated.View style={[styles.tabBar, { backgroundColor: surfaceColor, borderBottomColor: borderColor }]}>
        <TouchableOpacity style={styles.tabItem} onPress={openCredentialsTab}>
          <Text style={[styles.tabLabel, { color: colors.textSecondary },
            activeTab === 'credentials' && { color: colors.primary, fontWeight: '700' }]}>
            Credentials
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={openIdentityTab}>
          <Text style={[styles.tabLabel, { color: colors.textSecondary },
            activeTab === 'identity' && { color: colors.primary, fontWeight: '700' }]}>
            Identity
          </Text>
        </TouchableOpacity>
        <Animated.View
          style={[styles.tabIndicator, { backgroundColor: colors.primary, transform: [{ translateX: indicatorTranslateX }] }]}
        />
      </Animated.View>

      {/* Content with fade+slide transition */}
      <Animated.View
        style={[styles.contentWrapper, { opacity: contentOpacity, transform: [{ translateY: contentSlide }] }]}
      >
        {activeTab === 'identity' ? (
          loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : identity ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

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
                <InfoSection label="IDENTIFIER (DID)" value={identity.did}
                  onCopy={() => copy(identity.did, 'did')} copied={copied === 'did'} mono multiline colors={colors} />
              </Animated.View>

              {/* Section 2 — Address */}
              <Animated.View style={{ opacity: sectionAnims[2].opacity, transform: [{ translateY: sectionAnims[2].translateY }] }}>
                <InfoSection label="ETHEREUM ADDRESS" value={identity.ethereumAddress}
                  onCopy={() => copy(identity.ethereumAddress, 'addr')} copied={copied === 'addr'} mono colors={colors} />
              </Animated.View>

              {/* Section 3 — Keys */}
              <Animated.View style={{ opacity: sectionAnims[3].opacity, transform: [{ translateY: sectionAnims[3].translateY }] }}>
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CRYPTOGRAPHIC KEYS</Text>
                  <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {identity.keys.map((key, i) => (
                      <View key={key.kid} style={[styles.keyRow, i < identity.keys.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
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
          ) : null
        ) : (
          <CredentialsScreen />
        )}
      </Animated.View>
    </Animated.View>
  );
}

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
        <Text style={[styles.sectionValue, { color: colors.text }, mono && styles.sectionValueMono]}
          numberOfLines={multiline ? 3 : 1} selectable>
          {value}
        </Text>
        <TouchableOpacity
          style={[styles.copyBtn, { backgroundColor: colors.primaryLight, borderColor: 'rgba(0,51,153,0.15)' },
            copied && { backgroundColor: colors.successLight, borderColor: 'rgba(5,150,105,0.2)' }]}
          onPress={onCopy}
        >
          <Text style={[styles.copyBtnText, { color: colors.primary }]}>{copied ? '✓  Copied' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  // Top bar — extends behind status bar so surface color fills the whole top
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
  topBarStarBadge: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarStar: { color: '#FFD700', fontSize: 18, fontWeight: '700' },
  topBarTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  topBarSub:   { fontSize: 12, marginTop: 3 },

  // Dark mode toggle button
  toggleBtn: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  tabLabel: { fontSize: 15, fontWeight: '500' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: 0,
    width: TAB_W * 0.6, height: 2.5, borderRadius: 2,
  },

  contentWrapper: { flex: 1 },
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
  idCardTypeLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1 },
  idCardEU: { alignItems: 'flex-end' },
  idCardEUStar: { fontSize: 8, color: '#FFD700', letterSpacing: 2 },
  idCardAddress: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 13, color: '#fff', fontWeight: '600', letterSpacing: 0.5,
    marginTop: 20, marginBottom: 20,
  },
  idCardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  idCardFooterLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
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
