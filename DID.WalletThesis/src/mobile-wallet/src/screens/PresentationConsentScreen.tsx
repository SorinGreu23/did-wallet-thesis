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
import { keccak256, toUtf8Bytes } from 'ethers';
import { useTheme } from '../context/ThemeContext';
import authService from '../services/authService';
import credentialService from '../services/credentialService';
import zkpService from '../services/zkpService';
import presentationService from '../services/presentationService';
import {
  decodePresentationRequest,
  PresentationRequest,
  PresentationResponse,
  Requirement,
  ZkpProof,
  CredentialRef,
} from '../types/presentation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateDid(did: string, len = 30): string {
  if (did.length <= len) return did;
  return did.slice(0, len) + '…';
}

function purposeLabel(purpose: string): string {
  switch (purpose) {
    case 'master-application': return "Master's Degree Application";
    case 'foreign-id-card': return 'Foreign ID Card';
    case 'job-application': return 'Job Application';
    default: return purpose;
  }
}

function requirementLabel(req: Requirement): string {
  switch (req.kind) {
    case 'zkp':
      if (req.circuit === 'ageVerification') return `Age proof (≥ ${req.threshold} years)`;
      if (req.circuit === 'graduationYearRange') return `Graduation year proof (${req.minYear}–${req.maxYear})`;
      if (req.circuit === 'countryMembership') return 'EU country membership proof';
      return 'Zero-knowledge proof';
    case 'credential-ref':
      return `${req.credentialType} credential reference${req.mustBeIssuedInEu ? ' (EU-issued)' : ''}`;
    case 'full-disclosure':
      return `${req.credentialType} (full disclosure)`;
    default:
      return 'Unknown requirement';
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PresentationConsentScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [request, setRequest] = useState<PresentationRequest | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    try {
      const encoded: string = route.params?.encodedRequest ?? '';
      const decoded = decodePresentationRequest(encoded);
      setRequest(decoded);
    } catch (e: any) {
      setDecodeError(e.message ?? 'Failed to decode presentation request');
    }
  }, [route.params?.encodedRequest]);

  const buildZkpProof = useCallback(
    async (req: Requirement, profile: any): Promise<ZkpProof | null> => {
      if (req.kind !== 'zkp') return null;

      const currentYear = new Date().getFullYear();

      if (req.circuit === 'ageVerification') {
        const birthYear =
          (profile as any)?.birthDate
            ? parseInt((profile as any).birthDate.slice(0, 4), 10)
            : null;

        if (!birthYear) {
          throw new Error(
            'Your date of birth is not set. Please update it in Profile before proceeding.',
          );
        }

        const age = currentYear - birthYear;
        if (age < req.threshold) {
          throw new Error(
            `Age requirement not met: this request requires you to be at least ${req.threshold} years old (you are ${age}).`,
          );
        }

        const { proof, publicSignals } = await zkpService.prove('ageVerification', {
          birthYear: String(birthYear),
          currentYear: String(currentYear),
          threshold: String(req.threshold),
        });

        const valid = await zkpService.verify('ageVerification', proof, publicSignals);
        if (!valid) {
          throw new Error('Age proof verification failed. Cannot submit this presentation.');
        }

        return { circuit: 'ageVerification', proof, publicSignals };
      }

      if (req.circuit === 'graduationYearRange') {
        const graduationYear = (profile as any)?.graduationYear ?? null;

        if (!graduationYear) {
          throw new Error(
            'Your graduation year is not set. Please update it in Profile before proceeding.',
          );
        }

        if (graduationYear < req.minYear || graduationYear > req.maxYear) {
          throw new Error(
            `Graduation year requirement not met: must be between ${req.minYear} and ${req.maxYear} (yours is ${graduationYear}).`,
          );
        }

        const { proof, publicSignals } = await zkpService.prove('graduationYearRange', {
          graduationYear: String(graduationYear),
          minYear: String(req.minYear),
          maxYear: String(req.maxYear),
        });

        const valid = await zkpService.verify('graduationYearRange', proof, publicSignals);
        if (!valid) {
          throw new Error('Graduation year proof verification failed. Cannot submit this presentation.');
        }

        return { circuit: 'graduationYearRange', proof, publicSignals };
      }

      if (req.circuit === 'countryMembership') {
        const { proof, publicSignals } = await zkpService.prove('countryMembership', {
          countryCode: '276',
          merkleRoot: req.merkleRoot,
          pathElements: Array(10).fill('0'),
          pathIndices: Array(10).fill('0'),
        });

        const valid = await zkpService.verify('countryMembership', proof, publicSignals);
        if (!valid) {
          throw new Error('Country membership proof verification failed. Cannot submit this presentation.');
        }

        return { circuit: 'countryMembership', proof, publicSignals };
      }

      return null;
    },
    [],
  );

  const buildCredentialRef = useCallback(
    async (req: Requirement): Promise<CredentialRef | null> => {
      if (req.kind !== 'credential-ref') return null;

      try {
        const stored = await credentialService.listCredentials();
        const match = stored.find((c) =>
          (c.verifiableCredential.type as string[]).includes(req.credentialType),
        );

        if (match) {
          const issuerAccreditationId =
            (match.verifiableCredential.credentialSubject as any)?.issuerAccreditationId ?? '0x0000000000000000000000000000000000000000000000000000000000000000';
          return {
            credentialType: req.credentialType,
            credentialHash: match.hash,
            issuerAccreditationId,
          };
        }
      } catch (_) {
        // Fall through to placeholder
      }

      // Placeholder when no matching credential is found
      return {
        credentialType: req.credentialType,
        credentialHash: keccak256(toUtf8Bytes(`placeholder:${req.credentialType}`)),
        issuerAccreditationId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };
    },
    [],
  );

  const buildFullDisclosure = useCallback(async (req: Requirement) => {
    if (req.kind !== 'full-disclosure') return null;

    try {
      const stored = await credentialService.listCredentials();
      const match = stored.find((c) =>
        (c.verifiableCredential.type as string[]).includes(req.credentialType),
      );
      if (match) {
        return { credentialType: req.credentialType, credential: match.verifiableCredential };
      }
    } catch (_) {}

    return { credentialType: req.credentialType, credential: null };
  }, []);

  const handleApprove = useCallback(async () => {
    if (!request) return;

    setLoading(true);
    try {
      const profile = await authService.getWalletProfile();
      const holderDid = profile?.did ?? 'did:unknown';

      setStatusText('Building ZKP proofs…');

      const proofs: ZkpProof[] = [];
      const credentialRefs: CredentialRef[] = [];
      const fullDisclosures: Array<{ credentialType: string; credential: any }> = [];

      for (const req of request.requirements) {
        if (req.kind === 'zkp') {
          setStatusText(`Proving ${req.circuit}…`);
          const proof = await buildZkpProof(req, profile);
          if (proof) proofs.push(proof);
        } else if (req.kind === 'credential-ref') {
          setStatusText(`Looking up ${req.credentialType}…`);
          const ref = await buildCredentialRef(req);
          if (ref) credentialRefs.push(ref);
        } else if (req.kind === 'full-disclosure') {
          setStatusText(`Attaching ${req.credentialType}…`);
          const fd = await buildFullDisclosure(req);
          if (fd) fullDisclosures.push(fd);
        }
      }

      setStatusText('Signing response…');

      const responsePayload: Omit<PresentationResponse, 'signature'> = {
        requestId: request.id,
        holderDid,
        proofs,
        credentialRefs,
        fullDisclosures: fullDisclosures.length > 0 ? fullDisclosures : undefined,
        submittedAt: new Date().toISOString(),
      };

      const signature = keccak256(toUtf8Bytes(JSON.stringify(responsePayload)));

      const response: PresentationResponse = {
        ...responsePayload,
        signature,
      };

      if (request.callbackUrl) {
        setStatusText('Submitting to verifier…');
        await fetch(request.callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response),
        });
      }

      await presentationService.save({
        id: request.id,
        purpose: request.purpose,
        verifierDid: request.verifierDid,
        response,
        submittedAt: response.submittedAt,
      });

      setLoading(false);
      Alert.alert(
        'Presentation Submitted',
        'Your verifiable presentation has been successfully built and submitted.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      setLoading(false);
      setStatusText('');
      Alert.alert('Error', e.message ?? 'Failed to build presentation');
    }
  }, [request, buildZkpProof, buildCredentialRef, buildFullDisclosure, navigation]);

  const handleDecline = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (decodeError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Invalid Request</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{decodeError}</Text>
        <TouchableOpacity
          style={[styles.btnSecondary, { borderColor: colors.border }]}
          onPress={handleDecline}
        >
          <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <Text style={[styles.title, { color: colors.text }]}>Presentation Request</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Review what will be shared before approving.
      </Text>

      {/* Requested by */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>REQUESTED BY</Text>
        <Text style={[styles.sectionValue, { color: colors.text }]} numberOfLines={2}>
          {truncateDid(request.verifierDid)}
        </Text>
      </View>

      {/* Purpose */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>PURPOSE</Text>
        <Text style={[styles.sectionValue, { color: colors.text }]}>
          {purposeLabel(request.purpose)}
        </Text>
      </View>

      {/* What will be shared */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>WHAT WILL BE SHARED</Text>
        {request.requirements.map((req, i) => (
          <View key={i} style={styles.reqRow}>
            <View style={[styles.reqDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.reqText, { color: colors.text }]}>
              {requirementLabel(req)}
            </Text>
          </View>
        ))}
      </View>

      {/* Expiry */}
      <Text style={[styles.expiry, { color: colors.textMuted }]}>
        Request expires: {new Date(request.expiresAt).toLocaleString()}
      </Text>

      {/* Loading */}
      {loading && (
        <View style={[styles.loadingBox, { backgroundColor: colors.primaryLight }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.primary }]}>{statusText}</Text>
        </View>
      )}

      {/* Actions */}
      {!loading && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={handleApprove}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>Review &amp; Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border }]}
            onPress={handleDecline}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingTop: 72, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 24, paddingTop: 72 },

  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  errorText: { fontSize: 14, marginBottom: 24 },
  expiry: { fontSize: 12, marginTop: 8, marginBottom: 24 },

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
    marginBottom: 6,
  },
  sectionValue: { fontSize: 14, fontWeight: '500' },

  reqRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  reqDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  reqText: { flex: 1, fontSize: 14 },

  loadingBox: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  loadingText: { fontSize: 14, fontWeight: '500', flex: 1 },

  actions: { gap: 12 },
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
