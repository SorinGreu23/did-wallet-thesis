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
import presentationService, { StoredPresentation } from '../services/presentationService';
import { useTheme } from '../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const CARD_W = SCREEN_W - H_PAD * 2;
const CARD_H = 200;
const CARD_PEEK = 22;
const CARD_GAP = 14;

type WalletCard =
  | { kind: 'vc'; data: StoredCredential }
  | { kind: 'vp'; data: StoredPresentation };

const collapsedY = (i: number) => i * CARD_PEEK;
const collapsedScale = (i: number) => Math.max(0.90, 1 - i * 0.04);
const expandedY = (i: number) => i * (CARD_H + CARD_GAP);

// ─── Credential theme ────────────────────────────────────────────────────────

interface CredentialTheme { bg: string; bgDeep: string; icon: string }

const THEMES: { keywords: string[]; light: CredentialTheme; dark: CredentialTheme }[] = [
  { keywords: ['diploma','degree','education','graduation','academic','university'],
    light: { bg: '#003399', bgDeep: '#002277', icon: '🎓' },
    dark:  { bg: '#1a4dcc', bgDeep: '#1237a8', icon: '🎓' } },
  { keywords: ['identity','profile','person','passport','id'],
    light: { bg: '#0e4d7a', bgDeep: '#0a3d62', icon: '👤' },
    dark:  { bg: '#1a72b8', bgDeep: '#125d9e', icon: '👤' } },
  { keywords: ['accreditation','institution','authority','ministry','government'],
    light: { bg: '#1e3a5f', bgDeep: '#152e4d', icon: '🏛️' },
    dark:  { bg: '#2a5490', bgDeep: '#1e3f72', icon: '🏛️' } },
  { keywords: ['employment','work','job','professional','career'],
    light: { bg: '#1a4731', bgDeep: '#13351f', icon: '💼' },
    dark:  { bg: '#237048', bgDeep: '#1a5536', icon: '💼' } },
  { keywords: ['health','medical','vaccination','patient','hospital'],
    light: { bg: '#4a1942', bgDeep: '#3b1234', icon: '🏥' },
    dark:  { bg: '#7a2a6e', bgDeep: '#621f58', icon: '🏥' } },
  { keywords: ['driver','license','vehicle','driving'],
    light: { bg: '#3d2b1f', bgDeep: '#2e1f16', icon: '🚗' },
    dark:  { bg: '#6a4a32', bgDeep: '#573b27', icon: '🚗' } },
];
const DEFAULT_LIGHT: CredentialTheme = { bg: '#2d3748', bgDeep: '#1a202c', icon: '📄' };
const DEFAULT_DARK:  CredentialTheme = { bg: '#4a5568', bgDeep: '#374151', icon: '📄' };

function getCredentialTheme(types: string[], isDark: boolean): CredentialTheme {
  const combined = types.join(' ').toLowerCase();
  for (const entry of THEMES)
    if (entry.keywords.some(k => combined.includes(k)))
      return isDark ? entry.dark : entry.light;
  return isDark ? DEFAULT_DARK : DEFAULT_LIGHT;
}

// ─── VP color palette ────────────────────────────────────────────────────────

const VP_COLORS = [
  { bg: '#134e4a', bgDeep: '#0d3b37' },
  { bg: '#3b1f5e', bgDeep: '#2d1649' },
  { bg: '#1a3a2a', bgDeep: '#122a1e' },
  { bg: '#4a2010', bgDeep: '#361708' },
];

const PURPOSE_LABELS: Record<string, string> = {
  'master-application': "Master's Application",
  'foreign-id-card': 'Foreign ID Card',
  'job-application': 'Job Application',
};

// ─── Unified card renderer ───────────────────────────────────────────────────

function WalletCardView({ card, onPress, vpColorIndex }: {
  card: WalletCard;
  onPress: () => void;
  vpColorIndex: number;
}) {
  const { isDark } = useTheme();

  if (card.kind === 'vc') {
    const cred = card.data;
    const vc = cred.verifiableCredential;
    const subject = vc.credentialSubject as Record<string, unknown>;
    const issuerRaw = typeof vc.issuer === 'string' ? vc.issuer : (vc.issuer as { id?: string })?.id ?? '';
    const issuerName = typeof subject.issuerName === 'string' && subject.issuerName ? subject.issuerName : null;
    const shortIssuer = issuerName ?? (issuerRaw.length > 34 ? `${issuerRaw.slice(0, 18)}…${issuerRaw.slice(-10)}` : issuerRaw);
    const date = new Date(vc.issuanceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const credHash = String(subject.credentialHash ?? subject.transactionHash ?? cred.hash ?? '');
    const shortHash = credHash.length > 14 ? `${credHash.slice(0, 10)}…${credHash.slice(-6)}` : credHash;
    const types = (Array.isArray(vc.type) ? vc.type : [vc.type]).filter((t): t is string => !!t && t !== 'VerifiableCredential');
    const typeLabel = (types[0] ?? 'VerifiableCredential').replace(/([a-z])([A-Z])/g, '$1 $2');
    const theme = getCredentialTheme(types, isDark);

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.92}
        style={[styles.card, { backgroundColor: theme.bg, width: CARD_W }]}>
        <View style={[styles.cardCircle1, { backgroundColor: theme.bgDeep }]} />
        <View style={[styles.cardCircle2, { backgroundColor: theme.bgDeep }]} />
        <Text style={styles.cardWatermark} pointerEvents="none">{theme.icon}</Text>
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
        <Text style={styles.cardHash}>{shortHash}</Text>
        <View style={styles.cardFooter}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.cardFooterLabel}>ISSUED BY</Text>
            <Text style={styles.cardFooterValue} numberOfLines={1}>{shortIssuer}</Text>
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

  // VP card
  const vp = card.data;
  const color = VP_COLORS[vpColorIndex % VP_COLORS.length];
  const label = PURPOSE_LABELS[vp.purpose] ?? vp.purpose;
  const date = new Date(vp.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = new Date(vp.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const shortVerifier = vp.verifierDid.length > 30 ? `${vp.verifierDid.slice(0, 16)}…${vp.verifierDid.slice(-10)}` : vp.verifierDid;
  const proofCount = vp.response.proofs.length;
  const refCount = vp.response.credentialRefs.length + (vp.response.fullDisclosures?.length ?? 0);
  const sharedSummary = [
    proofCount > 0 && `${proofCount} ZK proof${proofCount > 1 ? 's' : ''}`,
    refCount > 0 && `${refCount} credential ref${refCount > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ') || 'No items';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92}
      style={[styles.card, { backgroundColor: color.bg, width: CARD_W }]}>
      <View style={[styles.cardCircle1, { backgroundColor: color.bgDeep }]} />
      <View style={[styles.cardCircle2, { backgroundColor: color.bgDeep }]} />
      <Text style={styles.cardWatermark} pointerEvents="none">🔏</Text>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.cardTypeSmall}>VERIFIABLE PRESENTATION</Text>
          <Text style={styles.cardType} numberOfLines={1}>{label}</Text>
        </View>
        <View style={styles.cardEUBadge}>
          <Text style={styles.cardEUStar}>★</Text>
          <Text style={styles.cardEULabel}>EU</Text>
        </View>
      </View>
      <Text style={styles.cardHash}>{sharedSummary}</Text>
      <View style={styles.cardFooter}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.cardFooterLabel}>SUBMITTED TO</Text>
          <Text style={styles.cardFooterValue} numberOfLines={1}>{shortVerifier}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardFooterLabel}>SUBMITTED AT</Text>
          <Text style={styles.cardFooterValue}>{date}</Text>
          <Text style={[styles.cardFooterValue, { opacity: 0.6, fontSize: 11 }]}>{time}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CredentialsScreen() {
  const { colors } = useTheme();
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const translateYAnims = useRef<Animated.Value[]>([]);
  const scaleAnims     = useRef<Animated.Value[]>([]);
  const opacityAnims   = useRef<Animated.Value[]>([]);

  const initAnims = useCallback((count: number) => {
    translateYAnims.current = Array.from({ length: count }, (_, i) => new Animated.Value(collapsedY(i) + 48));
    scaleAnims.current      = Array.from({ length: count }, () => new Animated.Value(0.88));
    opacityAnims.current    = Array.from({ length: count }, () => new Animated.Value(0));

    Animated.parallel(
      Array.from({ length: count }, (_, i) =>
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.parallel([
            Animated.spring(translateYAnims.current[i], { toValue: collapsedY(i), damping: 16, stiffness: 115, useNativeDriver: true }),
            Animated.spring(scaleAnims.current[i],      { toValue: collapsedScale(i), damping: 16, stiffness: 115, useNativeDriver: true }),
            Animated.timing(opacityAnims.current[i],    { toValue: 1, duration: 280, useNativeDriver: true }),
          ]),
        ])
      )
    ).start();
  }, []);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [creds, vps] = await Promise.all([
        walletService.listCredentials(),
        presentationService.list(),
      ]);
      const active = creds.filter((c) => {
        const status = (c.verifiableCredential.credentialSubject as Record<string, unknown>)?.status;
        return !status || status === 'Active';
      });
      const merged: WalletCard[] = [
        ...active.map((data): WalletCard => ({ kind: 'vc', data })),
        ...vps.map((data): WalletCard => ({ kind: 'vp', data })),
      ];
      setCards(merged);
      setExpanded(false);
      initAnims(merged.length);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncFromBackend = async () => {
    setSyncing(true);
    try {
      const identity = await walletService.getIdentity();
      await credentialService.fetchFromBackend(`did:ethr:sepolia:${identity.ethereumAddress}`);
      await load();
    } catch (error: unknown) {
      console.error('Sync error:', error instanceof Error ? error.message : error);
    } finally {
      setSyncing(false);
    }
  };

  const n = cards.length;

  const containerH = expanded
    ? n * CARD_H + Math.max(0, n - 1) * CARD_GAP
    : CARD_H + Math.min(Math.max(0, n - 1), 2) * CARD_PEEK;

  const toggleExpand = () => {
    if (n <= 1) return;
    const toExpanded = !expanded;
    LayoutAnimation.configureNext({ duration: 380, update: { type: LayoutAnimation.Types.spring, springDamping: 0.72 } });
    setExpanded(toExpanded);
    Animated.parallel(
      cards.flatMap((_, i) => [
        Animated.spring(translateYAnims.current[i], { toValue: toExpanded ? expandedY(i) : collapsedY(i), damping: 18, stiffness: 130, useNativeDriver: true }),
        Animated.spring(scaleAnims.current[i],      { toValue: toExpanded ? 1 : collapsedScale(i), damping: 18, stiffness: 130, useNativeDriver: true }),
        Animated.timing(opacityAnims.current[i],    { toValue: 1, duration: 150, useNativeDriver: true }),
      ])
    ).start();
  };

  const vcCount = cards.filter(c => c.kind === 'vc').length;
  const vpCount = cards.filter(c => c.kind === 'vp').length;
  const subtitle = n === 0
    ? 'No documents yet'
    : [vcCount > 0 && `${vcCount} credential${vcCount !== 1 ? 's' : ''}`,
       vpCount > 0 && `${vpCount} presentation${vpCount !== 1 ? 's' : ''}`]
        .filter(Boolean).join(' · ');

  let vpColorIndex = 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Wallet</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          style={[styles.syncBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, syncing && styles.syncBtnActive]}
          onPress={syncFromBackend} disabled={syncing}>
          {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.syncBtnText}>↻  Sync</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</Text>
        </View>
      ) : n === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.emptyIconText}>🎓</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Documents Yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Tap Sync to fetch your credentials{'\n'}from the accreditation platform.
          </Text>
          <TouchableOpacity
            style={[styles.emptySync, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            onPress={syncFromBackend} disabled={syncing}>
            {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.emptySyncText}>Sync Now</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={expanded}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.stackContainer, { height: containerH }]}>
            {cards.map((card, i) => {
              const colorIdx = card.kind === 'vp' ? vpColorIndex++ : 0;
              return (
                <Animated.View
                  key={card.kind === 'vc' ? card.data.hash : card.data.id + card.data.submittedAt}
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
                  ]}>
                  <WalletCardView card={card} onPress={toggleExpand} vpColorIndex={colorIdx} />
                </Animated.View>
              );
            })}
          </View>

          {n > 1 && (
            <TouchableOpacity style={styles.hint} onPress={toggleExpand}>
              <View style={[styles.hintPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.hintText, { color: colors.primary }]}>
                  {expanded ? '↑  Collapse' : '↓  Show all documents'}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingTop: 20, paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, marginTop: 2 },
  syncBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
    minWidth: 80, alignItems: 'center',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  syncBtnActive: { opacity: 0.75 },
  syncBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyIconText: { fontSize: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptySync: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  emptySyncText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 4, paddingBottom: 48 },
  stackContainer: { position: 'relative', width: CARD_W },
  cardAbsolute: { position: 'absolute', top: 0, left: 0 },
  card: {
    height: CARD_H, borderRadius: 20, padding: 20, overflow: 'hidden', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  cardCircle1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -80, right: -60 },
  cardCircle2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, bottom: -50, left: -30 },
  cardWatermark: { position: 'absolute', fontSize: 130, bottom: -18, right: -10, opacity: 0.25 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTypeSmall: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  cardType: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
  cardEUBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  cardEUStar: { fontSize: 10, color: '#FFD700', lineHeight: 12 },
  cardEULabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.8)', letterSpacing: 1, marginTop: 2 },
  cardHash: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end' },
  cardFooterLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  cardFooterValue: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  cardActivePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 5 },
  cardActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  cardActiveText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  hint: { alignItems: 'center', marginTop: 16 },
  hintPill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  hintText: { fontSize: 13, fontWeight: '600' },
});
