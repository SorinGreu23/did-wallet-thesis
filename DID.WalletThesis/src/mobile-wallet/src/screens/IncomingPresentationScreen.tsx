import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import authService from '../services/authService';
import zkpService from '../services/zkpService';
import chainVerifier, { VerificationResult } from '../services/chainVerifier';
import credentialIssuer from '../services/credentialIssuer';
import { PresentationResponse, ZkpProof, CredentialRef } from '../types/presentation';

// ─── Types ────────────────────────────────────────────────────────────────────

type ZkpStatus = { proof: ZkpProof; valid: boolean | null; checking: boolean };
type RefStatus = { ref: CredentialRef; result: VerificationResult | null; checking: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function circuitLabel(circuit: string): string {
  switch (circuit) {
    case 'ageVerification': return 'Age Verification';
    case 'graduationYearRange': return 'Graduation Year Range';
    case 'countryMembership': return 'EU Country Membership';
    default: return circuit;
  }
}

function truncate(str: string, len = 28): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function vcTypeForPurpose(purpose: string): string | null {
  if (purpose === 'master-application') return 'MasterStudentCard';
  if (purpose === 'job-application') return 'EmploymentProof';
  return null;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function IncomingPresentationScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const response: PresentationResponse = route.params?.response;

  const [zkpStatuses, setZkpStatuses] = useState<ZkpStatus[]>([]);
  const [refStatuses, setRefStatuses] = useState<RefStatus[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [overallValid, setOverallValid] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuedHash, setIssuedHash] = useState<string | null>(null);

  // ─── Run verification on mount ────────────────────────────────────────────

  useEffect(() => {
    if (!response) return;

    const initialZkp: ZkpStatus[] = (response.proofs ?? []).map((p) => ({
      proof: p,
      valid: null,
      checking: true,
    }));
    const initialRefs: RefStatus[] = (response.credentialRefs ?? []).map((r) => ({
      ref: r,
      result: null,
      checking: true,
    }));

    setZkpStatuses(initialZkp);
    setRefStatuses(initialRefs);

    // Verify ZKP proofs
    initialZkp.forEach((s, i) => {
      zkpService
        .verify(s.proof.circuit as any, s.proof.proof, s.proof.publicSignals)
        .then((valid) => {
          setZkpStatuses((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], valid, checking: false };
            return next;
          });
        })
        .catch(() => {
          setZkpStatuses((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], valid: false, checking: false };
            return next;
          });
        });
    });

    // Verify credential refs
    initialRefs.forEach((s, i) => {
      chainVerifier
        .verifyCredentialRef(s.ref)
        .then((result) => {
          setRefStatuses((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], result, checking: false };
            return next;
          });
        })
        .catch(() => {
          setRefStatuses((prev) => {
            const next = [...prev];
            next[i] = {
              ...next[i],
              result: {
                credentialType: s.ref.credentialType,
                credentialHash: s.ref.credentialHash,
                issuerAccreditationId: s.ref.issuerAccreditationId,
                trustChainValid: false,
                error: 'Verification failed',
              },
              checking: false,
            };
            return next;
          });
        });
    });
  }, [response]);

  // ─── Compute overall once all checks are done ─────────────────────────────

  useEffect(() => {
    const zkpDone = zkpStatuses.length === 0 || zkpStatuses.every((s) => !s.checking);
    const refDone = refStatuses.length === 0 || refStatuses.every((s) => !s.checking);

    if (zkpDone && refDone && (zkpStatuses.length > 0 || refStatuses.length > 0)) {
      const zkpAllValid = zkpStatuses.every((s) => s.valid === true);
      const refAllValid = refStatuses.every((s) => s.result?.trustChainValid === true);
      setOverallValid(zkpAllValid && refAllValid);
      setAllDone(true);
    }
  }, [zkpStatuses, refStatuses]);

  // ─── Issue credential ─────────────────────────────────────────────────────

  const handleIssue = useCallback(async () => {
    if (!response) return;

    const purpose = (route.params?.purpose as string) ?? '';
    const vcType = vcTypeForPurpose(purpose);
    if (!vcType) {
      Alert.alert('Nothing to issue', 'No credential type configured for this purpose.');
      return;
    }

    setIssuing(true);
    try {
      const profile = await authService.getWalletProfile();
      if (!profile) throw new Error('No issuer profile found');

      const issuerAccreditationId =
        (profile as any).accreditationId ??
        '0x0000000000000000000000000000000000000000000000000000000000000000';

      const expirationDate = new Date(
        Date.now() + 4 * 365 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { vcHash } = await credentialIssuer.issue({
        issuerDid: profile.did,
        holderDid: response.holderDid,
        credentialType: vcType,
        subject: { holderDid: response.holderDid, grantedVia: response.requestId },
        issuerAccreditationId,
        expirationDate,
      });

      setIssuedHash(vcHash);
    } catch (e: any) {
      Alert.alert('Issuance Failed', e.message ?? 'Could not issue credential');
    } finally {
      setIssuing(false);
    }
  }, [response, route.params?.purpose]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!response) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          No presentation response received.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.link, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const purpose = (route.params?.purpose as string) ?? '';
  const vcType = vcTypeForPurpose(purpose);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Incoming Presentation</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Verifying the holder's presentation.
      </Text>

      {/* Holder */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>HOLDER DID</Text>
        <Text style={[styles.mono, { color: colors.text }]} numberOfLines={2}>
          {truncate(response.holderDid, 50)}
        </Text>
      </View>

      {/* ZKP Proofs */}
      {zkpStatuses.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ZKP PROOFS</Text>
          {zkpStatuses.map((s, i) => (
            <View key={i} style={styles.checkRow}>
              {s.checking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.statusIcon}>{s.valid ? '✅' : '❌'}</Text>
              )}
              <Text style={[styles.checkLabel, { color: colors.text }]}>
                {circuitLabel(s.proof.circuit)}
              </Text>
              {!s.checking && (
                <Text style={[styles.checkStatus, { color: s.valid ? colors.success : '#e11d48' }]}>
                  {s.valid ? 'Valid' : 'Invalid'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Credential Refs */}
      {refStatuses.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CREDENTIAL REFERENCES</Text>
          {refStatuses.map((s, i) => (
            <View key={i} style={styles.checkRow}>
              {s.checking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.statusIcon}>
                  {s.result?.trustChainValid ? '✅' : '❌'}
                </Text>
              )}
              <Text style={[styles.checkLabel, { color: colors.text }]}>
                {s.ref.credentialType}
              </Text>
              {!s.checking && (
                <Text
                  style={[
                    styles.checkStatus,
                    { color: s.result?.trustChainValid ? colors.success : '#e11d48' },
                  ]}
                >
                  {s.result?.trustChainValid ? 'Trust chain valid' : s.result?.error ?? 'Invalid'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Overall result */}
      {allDone && (
        <View
          style={[
            styles.resultBox,
            { backgroundColor: overallValid ? colors.successLight : '#fce7f3', borderColor: overallValid ? colors.success : '#e11d48' },
          ]}
        >
          <Text
            style={[
              styles.resultText,
              { color: overallValid ? colors.success : '#be123c' },
            ]}
          >
            {overallValid ? 'Presentation Approved' : 'Presentation Rejected'}
          </Text>
        </View>
      )}

      {/* Issue credential */}
      {allDone && overallValid && vcType && !issuedHash && (
        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
          onPress={handleIssue}
          disabled={issuing}
          activeOpacity={0.85}
        >
          {issuing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnPrimaryText}>Issue {vcType}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Issued hash */}
      {issuedHash && (
        <View style={[styles.section, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
          <Text style={[styles.sectionLabel, { color: colors.success }]}>CREDENTIAL ISSUED</Text>
          <Text style={[styles.mono, { color: colors.text }]} numberOfLines={3} selectable>
            {issuedHash}
          </Text>
        </View>
      )}

      {/* Back */}
      <TouchableOpacity
        style={[styles.btnSecondary, { borderColor: colors.border }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Close</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingTop: 72, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  errorText: { fontSize: 14, marginBottom: 16 },
  link: { fontSize: 14, fontWeight: '600' },

  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  mono: { fontSize: 13, fontFamily: 'monospace' },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    minHeight: 28,
  },
  statusIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  checkLabel: { flex: 1, fontSize: 14 },
  checkStatus: { fontSize: 12, fontWeight: '600' },

  resultBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  resultText: { fontSize: 17, fontWeight: '700' },

  btnPrimary: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
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
