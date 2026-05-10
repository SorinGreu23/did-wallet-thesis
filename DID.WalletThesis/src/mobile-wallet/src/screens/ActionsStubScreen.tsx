import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import authService from '../services/authService';
import { AccountType, WalletProfile } from '../types/wallet';
import {
  encodePresentationRequest,
  PresentationRequest,
  Requirement,
} from '../types/presentation';

// ─── QR display (optional — react-native-qrcode-svg may not be installed yet) ─
let QRCode: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  QRCode = require('react-native-qrcode-svg').default;
} catch (_) {
  // Package not yet installed — falls back to text display
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  let hex = '';
  for (let i = 0; i < bytes * 2; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

function buildMasterRequest(verifierDid: string): PresentationRequest {
  return {
    id: randomUUID(),
    verifierDid,
    purpose: 'master-application',
    challenge: randomHex(16),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    requirements: [
      { kind: 'zkp', circuit: 'ageVerification', threshold: 18 } as Requirement,
      { kind: 'credential-ref', credentialType: 'BachelorDiploma', mustBeIssuedInEu: true } as Requirement,
    ],
  };
}

function buildJobRequest(verifierDid: string): PresentationRequest {
  return {
    id: randomUUID(),
    verifierDid,
    purpose: 'job-application',
    challenge: randomHex(16),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    requirements: [
      { kind: 'zkp', circuit: 'ageVerification', threshold: 18 } as Requirement,
      { kind: 'credential-ref', credentialType: 'BachelorDiploma', mustBeIssuedInEu: true } as Requirement,
    ],
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ActionRowProps {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  colors: any;
}

function ActionRow({ icon, label, description, onPress, colors }: ActionRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
        <Feather name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>{description}</Text>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── QR Request Screen (inline modal-like view) ───────────────────────────────

interface QrRequestViewProps {
  request: PresentationRequest;
  encoded: string;
  title: string;
  colors: any;
  onClose: () => void;
}

function QrRequestView({ request, encoded, title, colors, onClose }: QrRequestViewProps) {
  return (
    <ScrollView
      style={[styles.qrScroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.qrContent}
    >
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Show this QR code to the holder to scan.
      </Text>

      {/* QR code or fallback */}
      <View style={[styles.qrBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {QRCode ? (
          <QRCode value={encoded} size={220} color={colors.text} backgroundColor={colors.surface} />
        ) : (
          <Text style={[styles.qrFallbackLabel, { color: colors.textSecondary }]}>
            QR library not installed yet.{'\n'}Share the encoded string below:
          </Text>
        )}
      </View>

      {/* Encoded string + deep link for simulator testing */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ENCODED REQUEST (COPY &amp; PASTE)</Text>
        <Text style={[styles.mono, { color: colors.text }]} selectable numberOfLines={6}>
          {encoded}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await Clipboard.setStringAsync(encoded);
            Alert.alert('Copied!', 'Encoded request copied to clipboard.');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}
          activeOpacity={0.7}
        >
          <Feather name="copy" size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Tap to copy</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>REQUEST ID</Text>
        <Text style={[styles.mono, { color: colors.text }]} selectable>{request.id}</Text>
      </View>

      <TouchableOpacity
        style={[styles.btnSecondary, { borderColor: colors.border }]}
        onPress={onClose}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Paste + Navigate to Consent ─────────────────────────────────────────────

interface PasteRequestViewProps {
  colors: any;
  onClose: () => void;
  onSubmit: (encoded: string) => void;
}

function PasteRequestView({ colors, onClose, onSubmit }: PasteRequestViewProps) {
  const [value, setValue] = useState('');

  return (
    <ScrollView
      style={[styles.qrScroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.qrContent}
    >
      <Text style={[styles.title, { color: colors.text }]}>Paste Presentation Request</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Paste the eudi-pres://… string from the verifier's screen.
      </Text>

      <TextInput
        style={[
          styles.pasteInput,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
        value={value}
        onChangeText={setValue}
        placeholder="eudi-pres://…"
        placeholderTextColor={colors.textMuted}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[
          styles.btnPrimary,
          { backgroundColor: value.trim().startsWith('eudi-pres://') ? colors.primary : colors.border },
        ]}
        onPress={() => {
          if (value.trim().startsWith('eudi-pres://')) {
            onSubmit(value.trim());
          } else {
            Alert.alert('Invalid', 'The string must start with eudi-pres://');
          }
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.btnPrimaryText}>Review Request</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnSecondary, { borderColor: colors.border }]}
        onPress={onClose}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Foreign ID stub steps ────────────────────────────────────────────────────

interface ForeignIdViewProps {
  colors: any;
  onClose: () => void;
}

function ForeignIdView({ colors, onClose }: ForeignIdViewProps) {
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState('');

  if (step === 0) {
    return (
      <ScrollView
        style={[styles.qrScroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.qrContent}
      >
        <Text style={[styles.title, { color: colors.text }]}>Foreign ID Card</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Step 1 of 3 — Confirm destination country
        </Text>

        <TextInput
          style={[
            styles.pasteInput,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
          value={country}
          onChangeText={setCountry}
          placeholder="e.g. Germany"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
          onPress={() => country.trim() ? setStep(1) : Alert.alert('Required', 'Please enter a country')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnSecondary, { borderColor: colors.border }]}
          onPress={onClose}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === 1) {
    return (
      <ScrollView
        style={[styles.qrScroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.qrContent}
      >
        <Text style={[styles.title, { color: colors.text }]}>Foreign ID Card</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Step 2 of 3 — Capture national ID photo
        </Text>

        <View style={[styles.cameraStub, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="camera" size={40} color={colors.textMuted} />
          <Text style={[styles.cameraStubText, { color: colors.textSecondary }]}>
            Camera preview (demo stub)
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
          onPress={() => setStep(2)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Capture ID (Simulated)</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Step 2 — summary
  return (
    <ScrollView
      style={[styles.qrScroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.qrContent}
    >
      <Text style={[styles.title, { color: colors.text }]}>Foreign ID Card</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Step 3 of 3 — Presentation summary
      </Text>

      <View style={[styles.section, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
        <Text style={[styles.sectionLabel, { color: colors.success }]}>PRESENTATION BUILT</Text>
        <Text style={[styles.rowLabel, { color: colors.text }]}>Destination: {country}</Text>
        <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
          Age proof (≥ 16) included{'\n'}IdentityCard credential attached (full disclosure)
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
        onPress={() => {
          Alert.alert(
            'Submitted',
            `Your identity presentation for ${country} has been submitted.`,
            [{ text: 'Done', onPress: onClose }],
          );
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.btnPrimaryText}>Submit Presentation</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnSecondary, { borderColor: colors.border }]}
        onPress={onClose}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ActiveView =
  | null
  | 'paste-master'
  | 'paste-job'
  | 'foreign-id'
  | 'qr-master'
  | 'qr-job';

export default function ActionsStubScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [qrRequest, setQrRequest] = useState<PresentationRequest | null>(null);
  const [qrEncoded, setQrEncoded] = useState('');

  useEffect(() => {
    authService.getWalletProfile().then((p) => {
      if (p) {
        setProfile(p);
        setAccountType(p.accountType);
      }
    });
  }, []);

  const openQr = useCallback(
    (type: 'master' | 'job') => {
      if (!profile) return;
      const req = type === 'master' ? buildMasterRequest(profile.did) : buildJobRequest(profile.did);
      const encoded = encodePresentationRequest(req);
      setQrRequest(req);
      setQrEncoded(encoded);
      setActiveView(type === 'master' ? 'qr-master' : 'qr-job');
    },
    [profile],
  );

  const handlePasteSubmit = useCallback(
    (encoded: string) => {
      setActiveView(null);
      navigation.navigate('PresentationConsent', { encodedRequest: encoded });
    },
    [navigation],
  );

  // ─── Inline sub-views ───────────────────────────────────────────────────────

  if (activeView === 'foreign-id') {
    return <ForeignIdView colors={colors} onClose={() => setActiveView(null)} />;
  }

  if (activeView === 'paste-master' || activeView === 'paste-job') {
    return (
      <PasteRequestView
        colors={colors}
        onClose={() => setActiveView(null)}
        onSubmit={handlePasteSubmit}
      />
    );
  }

  if ((activeView === 'qr-master' || activeView === 'qr-job') && qrRequest) {
    return (
      <QrRequestView
        request={qrRequest}
        encoded={qrEncoded}
        title={activeView === 'qr-master' ? "Master's Application Request" : 'Job Application Request'}
        colors={colors}
        onClose={() => setActiveView(null)}
      />
    );
  }

  // ─── Main action list ───────────────────────────────────────────────────────

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.mainContent}
    >
      <Text style={[styles.title, { color: colors.text }]}>Actions</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {accountType === 'personal'
          ? 'Identity use-case flows for your personal wallet.'
          : accountType === 'university'
          ? 'Manage incoming applications and issue credentials.'
          : 'Manage job applications and issue employment credentials.'}
      </Text>

      <View style={styles.list}>
        {/* ── Personal ── */}
        {accountType === 'personal' && (
          <>
            <ActionRow
              icon="book"
              label="Apply for Master's Degree"
              description="Scan a university's presentation request"
              onPress={() => setActiveView('paste-master')}
              colors={colors}
            />
            <ActionRow
              icon="briefcase"
              label="Apply for a Job"
              description="Scan an enterprise's presentation request"
              onPress={() => setActiveView('paste-job')}
              colors={colors}
            />
            <ActionRow
              icon="globe"
              label="Request Foreign ID Card"
              description="Prepare a cross-border identity presentation"
              onPress={() => setActiveView('foreign-id')}
              colors={colors}
            />
          </>
        )}

        {/* ── University ── */}
        {accountType === 'university' && (
          <ActionRow
            icon="book"
            label="Request Master's Application"
            description="Generate a QR code for applicants to scan"
            onPress={() => openQr('master')}
            colors={colors}
          />
        )}

        {/* ── Enterprise ── */}
        {accountType === 'enterprise' && (
          <ActionRow
            icon="briefcase"
            label="Request Job Application"
            description="Generate a QR code for applicants to scan"
            onPress={() => openQr('job')}
            colors={colors}
          />
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  mainContent: { paddingTop: 72, paddingHorizontal: 24, paddingBottom: 48 },
  qrScroll: { flex: 1 },
  qrContent: { padding: 24, paddingTop: 72, paddingBottom: 48, gap: 12 },

  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 24 },

  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowDesc: { fontSize: 12, marginTop: 2 },

  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  mono: { fontSize: 12, fontFamily: 'monospace' },

  qrBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  qrFallbackLabel: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  pasteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 100,
    textAlignVertical: 'top',
  },

  cameraStub: {
    borderRadius: 14,
    borderWidth: 1,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderStyle: 'dashed',
  },
  cameraStubText: { fontSize: 14 },

  btnPrimary: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  btnSecondary: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnSecondaryText: { fontWeight: '600', fontSize: 15 },
});
