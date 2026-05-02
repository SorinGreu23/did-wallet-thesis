import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { StoredCredential } from '../services/credentialService';
import credentialService from '../services/credentialService';
import walletService from '../services/walletService';
import { useTheme } from '../context/ThemeContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const CARD_W = SCREEN_W - H_PAD * 2;
const CARD_H = 200;
const CARD_PEEK = 22;  // px of next card visible below the front card
const CARD_GAP = 14;   // gap between cards when expanded

/** Collapsed: card 0 sits at y=0, card i sits at y = i*PEEK (overlapping upward). */
const collapsedY = (i: number) => i * CARD_PEEK;
const collapsedScale = (i: number) => Math.max(0.90, 1 - i * 0.04);

/** Expanded: cards spaced out normally. */
const expandedY = (i: number) => i * (CARD_H + CARD_GAP);

// ─── Credential theme registry ───────────────────────────────────────────────

interface CredentialTheme {
  bg: string;
  bgDeep: string;
  icon: string;
}

const THEMES: { keywords: string[]; light: CredentialTheme; dark: CredentialTheme }[] = [
  {
    keywords: ['diploma', 'degree', 'education', 'graduation', 'academic', 'university'],
    light: { bg: '#003399', bgDeep: '#002277', icon: '🎓' },
    dark:  { bg: '#1a4dcc', bgDeep: '#1237a8', icon: '🎓' },
  },
  {
    keywords: ['identity', 'profile', 'person', 'passport', 'id'],
    light: { bg: '#0e4d7a', bgDeep: '#0a3d62', icon: '👤' },
    dark:  { bg: '#1a72b8', bgDeep: '#125d9e', icon: '👤' },
  },
  {
    keywords: ['accreditation', 'institution', 'authority', 'ministry', 'government'],
    light: { bg: '#1e3a5f', bgDeep: '#152e4d', icon: '🏛️' },
    dark:  { bg: '#2a5490', bgDeep: '#1e3f72', icon: '🏛️' },
  },
  {
    keywords: ['employment', 'work', 'job', 'professional', 'career'],
    light: { bg: '#1a4731', bgDeep: '#13351f', icon: '💼' },
    dark:  { bg: '#237048', bgDeep: '#1a5536', icon: '💼' },
  },
  {
    keywords: ['health', 'medical', 'vaccination', 'patient', 'hospital'],
    light: { bg: '#4a1942', bgDeep: '#3b1234', icon: '🏥' },
    dark:  { bg: '#7a2a6e', bgDeep: '#621f58', icon: '🏥' },
  },
  {
    keywords: ['driver', 'license', 'vehicle', 'driving'],
    light: { bg: '#3d2b1f', bgDeep: '#2e1f16', icon: '🚗' },
    dark:  { bg: '#6a4a32', bgDeep: '#573b27', icon: '🚗' },
  },
];

const DEFAULT_LIGHT: CredentialTheme = { bg: '#2d3748', bgDeep: '#1a202c', icon: '📄' };
const DEFAULT_DARK:  CredentialTheme = { bg: '#4a5568', bgDeep: '#374151', icon: '📄' };

function getCredentialTheme(types: string[], isDark: boolean): CredentialTheme {
  const combined = types.join(' ').toLowerCase();
  for (const entry of THEMES) {
    if (entry.keywords.some(k => combined.includes(k)))
      return isDark ? entry.dark : entry.light;
  }
  return isDark ? DEFAULT_DARK : DEFAULT_LIGHT;
}

// ─── Credential Card ─────────────────────────────────────────────────────────

interface CardProps {
  cred: StoredCredential;
  index: number;
  total: number;
  onPress: () => void;
}

function CredentialCard({ cred, index, total, onPress }: CardProps) {
  const { isDark } = useTheme();
  const vc = cred.verifiableCredential;
  const subject = vc.credentialSubject as Record<string, unknown>;
  const issuerRaw =
    typeof vc.issuer === 'string' ? vc.issuer : (vc.issuer as { id?: string })?.id ?? '';
  const issuerName = typeof subject.issuerName === 'string' && subject.issuerName
    ? subject.issuerName
    : null;
  const shortIssuer = issuerName ?? (
    issuerRaw.length > 34
      ? `${issuerRaw.slice(0, 18)}…${issuerRaw.slice(-10)}`
      : issuerRaw
  );

  const date = new Date(vc.issuanceDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const credHash = String(
    subject.credentialHash ?? subject.transactionHash ?? cred.hash ?? ''
  );
  const shortHash = credHash.length > 14
    ? `${credHash.slice(0, 10)}…${credHash.slice(-6)}`
    : credHash;

  // Derive a human-readable label from the credential type array
  const types = (Array.isArray(vc.type) ? vc.type : [vc.type]).filter(
    (t): t is string => !!t && t !== 'VerifiableCredential'
  );
  const primaryType = types[0] ?? 'VerifiableCredential';
  // Convert PascalCase like "DiplomaCredential" → "Diploma Credential"
  const typeLabel = primaryType.replace(/([a-z])([A-Z])/g, '$1 $2');

  const theme = getCredentialTheme(types, isDark);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      style={[styles.card, { backgroundColor: theme.bg, width: CARD_W }]}
    >
      {/* Decorative circles using theme accent */}
      <View style={[styles.cardCircle1, { backgroundColor: theme.bgDeep }]} />
      <View style={[styles.cardCircle2, { backgroundColor: theme.bgDeep }]} />

      {/* Background watermark icon */}
      <Text style={styles.cardWatermark} pointerEvents="none">
        {theme.icon}
      </Text>

      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.cardTypeSmall}>VERIFIABLE CREDENTIAL</Text>
          <Text style={styles.cardType} numberOfLines={1}>{typeLabel}</Text>
        </View>
        <View style={styles.cardEUBadge}>
          <Text style={styles.cardEUStar}>★</Text>
          <Text style={styles.cardEULabel}>EU</Text>
        </View>
      </View>

      {/* Credential hash / ID */}
      <Text style={styles.cardHash}>{shortHash}</Text>

      {/* Footer row */}
      <View style={styles.cardFooter}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.cardFooterLabel}>ISSUED BY</Text>
          <Text style={styles.cardFooterValue} numberOfLines={1}>
            {shortIssuer}
          </Text>
        </View>
        <View style={{ alignItems: 'center', marginRight: 8 }}>
          <Text style={styles.cardFooterLabel}>VALID FROM</Text>
          <Text style={styles.cardFooterValue}>{date}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <View style={styles.cardActivePill}>
            <View style={styles.cardActiveDot} />
            <Text style={styles.cardActiveText}>Active</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CredentialsScreen() {
  const { colors } = useTheme();
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // One Animated.Value per card for translateY, scale, and opacity
  const translateYAnims = useRef<Animated.Value[]>([]);
  const scaleAnims     = useRef<Animated.Value[]>([]);
  const opacityAnims   = useRef<Animated.Value[]>([]);

  const initAnims = useCallback((count: number) => {
    const ENTRANCE_OFFSET = 48;

    translateYAnims.current = Array.from(
      { length: count },
      (_, i) => new Animated.Value(collapsedY(i) + ENTRANCE_OFFSET)
    );
    scaleAnims.current = Array.from(
      { length: count },
      () => new Animated.Value(0.88)
    );
    opacityAnims.current = Array.from(
      { length: count },
      () => new Animated.Value(0)
    );

    // Staggered entrance: each card springs up and fades in
    const entranceAnims = Array.from({ length: count }, (_, i) =>
      Animated.sequence([
        Animated.delay(i * 100),
        Animated.parallel([
          Animated.spring(translateYAnims.current[i], {
            toValue: collapsedY(i),
            damping: 16,
            stiffness: 115,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnims.current[i], {
            toValue: collapsedScale(i),
            damping: 16,
            stiffness: 115,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnims.current[i], {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    Animated.parallel(entranceAnims).start();
  }, []);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const creds = await walletService.listCredentials();
      const active = creds.filter((c) => {
        const status = (c.verifiableCredential.credentialSubject as Record<string, unknown>)?.status;
        return !status || status === 'Active';
      });
      setCredentials(active);
      setExpanded(false);
      initAnims(active.length);
    } catch (err) {
      console.error('Load credentials error:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncFromBackend = async () => {
    setSyncing(true);
    try {
      const identity = await walletService.getIdentity();
      const holderDid = `did:ethr:sepolia:${identity.ethereumAddress}`;
      await credentialService.fetchFromBackend(holderDid);
      await load();
    } catch (error: unknown) {
      console.error('Sync error:', error instanceof Error ? error.message : error);
    } finally {
      setSyncing(false);
    }
  };

  const n = credentials.length;

  /** Height of the absolute-positioned card stack container. */
  const containerH = expanded
    ? n * CARD_H + Math.max(0, n - 1) * CARD_GAP
    : CARD_H + Math.min(Math.max(0, n - 1), 2) * CARD_PEEK;

  const toggleExpand = () => {
    if (n <= 1) return;
    const toExpanded = !expanded;

    // Animate the container height via LayoutAnimation (works natively on both platforms)
    LayoutAnimation.configureNext({
      duration: 380,
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.72,
      },
    });
    setExpanded(toExpanded);

    // Animate each card's position, scale, and opacity with spring physics
    const animations = credentials.flatMap((_, i) => [
      Animated.spring(translateYAnims.current[i], {
        toValue: toExpanded ? expandedY(i) : collapsedY(i),
        damping: 18,
        stiffness: 130,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims.current[i], {
        toValue: toExpanded ? 1 : collapsedScale(i),
        damping: 18,
        stiffness: 130,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnims.current[i], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]);

    Animated.parallel(animations).start();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Credentials</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {n === 0
              ? 'No credentials yet'
              : `${n} active credential${n !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.syncBtn, { backgroundColor: colors.primary, shadowColor: colors.primary },
            syncing && styles.syncBtnActive]}
          onPress={syncFromBackend}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.syncBtnText}>↻  Sync</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading credentials…</Text>
        </View>
      ) : n === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.emptyIconText}>🎓</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Credentials Yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Tap Sync to fetch your diplomas{'\n'}from the accreditation platform.
          </Text>
          <TouchableOpacity
            style={[styles.emptySync, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            onPress={syncFromBackend}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.emptySyncText}>Sync Now</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={expanded}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Card stack ── */}
          <View style={[styles.stackContainer, { height: containerH }]}>
            {credentials.map((cred, i) => (
              <Animated.View
                key={cred.hash}
                style={[
                  styles.cardAbsolute,
                  {
                    zIndex: n - i,
                    opacity: opacityAnims.current[i] ?? 1,
                    transform: [
                      { translateY: translateYAnims.current[i] ?? new Animated.Value(collapsedY(i)) },
                      { scale: scaleAnims.current[i] ?? new Animated.Value(collapsedScale(i)) },
                    ],
                  },
                ]}
              >
                <CredentialCard
                  cred={cred}
                  index={i}
                  total={n}
                  onPress={toggleExpand}
                />
              </Animated.View>
            ))}
          </View>

          {/* ── Expand / collapse hint ── */}
          {n > 1 && (
            <TouchableOpacity style={styles.hint} onPress={toggleExpand}>
              <View style={[styles.hintPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.hintText, { color: colors.primary }]}>
                  {expanded ? '↑  Collapse' : `↓  Show all documents`}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    marginTop: 2,
  },
  syncBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  syncBtnActive: {
    opacity: 0.75,
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIconText: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  emptySync: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptySyncText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Scroll / stack
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 4,
    paddingBottom: 48,
  },
  stackContainer: {
    position: 'relative',
    width: CARD_W,
  },
  cardAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
  },

  // Card
  card: {
    height: CARD_H,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
    // Card shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  cardCircle1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -80,
    right: -60,
  },
  cardCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -50,
    left: -30,
  },
  cardWatermark: {
    position: 'absolute',
    fontSize: 130,
    bottom: -18,
    right: -10,
    opacity: 0.25,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTypeSmall: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  cardType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  cardEUBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cardEUStar: {
    fontSize: 10,
    color: '#FFD700',
    lineHeight: 12,
  },
  cardEULabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
    marginTop: 2,
  },
  cardHash: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  cardFooterLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  cardFooterValue: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  cardActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  cardActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  cardActiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
  },
  cardStackCount: {
    position: 'absolute',
    top: 16,
    right: 52,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
  },

  // Hint
  hint: {
    alignItems: 'center',
    marginTop: 16,
  },
  hintPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
