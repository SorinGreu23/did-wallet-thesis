import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { StoredCredential } from "../services/credentialService";
import credentialService from "../services/credentialService";
import walletService from "../services/walletService";
import { COLORS } from "../constants/config";

export default function CredentialsScreen() {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const creds = await walletService.listCredentials();
      setCredentials(creds.filter(c => {
        const status = (c.verifiableCredential.credentialSubject as any)?.status;
        return !status || status === 'Active';
      }));
    } catch (error) {
      console.error("Error loading credentials:", error);
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
    } catch (error: any) {
      Alert.alert("Sync failed", error.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Credentials</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={syncFromBackend}
          disabled={syncing}
        >
          {syncing
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.syncButtonText}>Sync</Text>
          }
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>Credentials issued to your DID</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.list}>
          {credentials.length === 0 ? (
            <Text style={styles.emptyText}>
              No credentials yet. Tap Sync to fetch from the backend.
            </Text>
          ) : (
            credentials.map((cred, index) => {
              const vc = cred.verifiableCredential;
              const subject = vc.credentialSubject as any;
              const types = (Array.isArray(vc.type) ? vc.type : [vc.type])
                .filter((t): t is string => !!t && t !== "VerifiableCredential");

              return (
                <View key={cred.hash} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIndex}>#{index + 1}</Text>
                    <View style={[
                      styles.statusBadge,
                      subject.status === 'Active' ? styles.statusActive : styles.statusOther
                    ]}>
                      <Text style={styles.statusText}>{subject.status ?? 'Unknown'}</Text>
                    </View>
                  </View>

                  <View style={styles.typeRow}>
                    {types.map((t, i) => (
                      <Text key={i} style={styles.typeTag}>{t}</Text>
                    ))}
                  </View>

                  <Text style={styles.field}>
                    <Text style={styles.fieldLabel}>Issuer: </Text>
                    {(vc.issuer as any)?.id ?? vc.issuer}
                  </Text>

                  {subject.transactionHash && (
                    <Text style={styles.field} numberOfLines={1}>
                      <Text style={styles.fieldLabel}>TX: </Text>
                      {String(subject.transactionHash).slice(0, 20)}…
                    </Text>
                  )}

                  <Text style={styles.issuedAt}>
                    Issued: {new Date(vc.issuanceDate).toLocaleDateString()}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20, paddingTop: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  syncButton: {
    backgroundColor: COLORS.primary, paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 8, minWidth: 64, alignItems: 'center',
  },
  syncButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { flex: 1 },
  emptyText: { textAlign: 'center', color: '#9ca3af', fontSize: 15, marginTop: 40 },
  card: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardIndex: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusActive: { backgroundColor: '#d1fae5' },
  statusOther: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#065f46' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  typeTag: {
    backgroundColor: COLORS.primary, color: '#fff',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, fontSize: 11, marginRight: 6,
  },
  field: { fontSize: 13, color: COLORS.text, marginBottom: 4 },
  fieldLabel: { fontWeight: '600' },
  issuedAt: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
});
