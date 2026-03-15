import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { StoredCredential } from "../services/credentialService";
import walletService from "../services/walletService";
import { COLORS } from "../constants/config";

export default function CredentialsScreen() {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [activeDid, setActiveDid] = useState<string | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const creds = await walletService.listCredentials();
      setCredentials(creds);
      const active = await walletService.getActiveDid();
      setActiveDid(active?.did ?? null);
    } catch (error) {
      console.error("Error loading credentials:", error);
    } finally {
      setLoading(false);
    }
  };

  const issueSampleCredential = async () => {
    setIssuing(true);
    try {
      const currentDid = await walletService.getActiveDid();

      if (!currentDid) {
        Alert.alert("No active DID", "Please create a DID and set it as active first");
        return;
      }

      // Issue a sample credential
      const credential = await walletService.issueCredentialWithActiveDid({
        type: ["VerifiableCredential", "ProfileCredential"],
        credentialSubject: {
          name: "Sorin Greu",
          role: "Software Developer",
          company: "UAIC",
          skills: ["React Native", "TypeScript", ".NET", "Angular"],
        },
        expirationDate: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });

      console.log("Issued credential:", credential);
      Alert.alert("Success", "Credential issued successfully!");
      await loadCredentials();
    } catch (error: any) {
      console.error("Error issuing credential:", error);
      Alert.alert("Error", error.message);
    } finally {
      setIssuing(false);
    }
  };

  const verifyCredential = async (hash: string) => {
    try {
      const credential = await walletService.getCredential(hash);
      if (!credential) return;

      const result = await walletService.verifyCredential(credential);

      if (result.verified) {
        Alert.alert("✅ Valid", "Credential signature is valid");
      } else {
        Alert.alert(
          "❌ Invalid",
          result.error || "Credential verification failed",
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Credentials</Text>
      <Text style={styles.subtitle}>Your Verifiable Credentials</Text>
      {activeDid && (
        <View style={styles.activeDidBanner}>
          <Text style={styles.activeDidLabel}>Active DID</Text>
          <Text style={styles.activeDidValue} numberOfLines={1}>{activeDid}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.issueButton}
        onPress={issueSampleCredential}
        disabled={issuing}
      >
        {issuing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Issue Sample Credential</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <ScrollView style={styles.credentialList}>
          {credentials.length === 0 ? (
            <Text style={styles.emptyText}>
              No credentials yet. Issue your first one!
            </Text>
          ) : (
            credentials.map((cred, index) => {
              const vc = cred.verifiableCredential;
              const subject = vc.credentialSubject as any;
              const types = (Array.isArray(vc.type) ? vc.type : [vc.type])
                .filter((t): t is string => t !== undefined && t !== null);

              return (
                <View key={cred.hash} style={styles.credCard}>
                  <Text style={styles.credLabel}>Credential #{index + 1}</Text>

                  <View style={styles.credType}>
                    {types.map((t: string, i: number) => (
                      <Text key={i} style={styles.typeTag}>
                        {t}
                      </Text>
                    ))}
                  </View>

                  {subject.name && (
                    <Text style={styles.credField}>
                      <Text style={styles.fieldLabel}>Name:</Text>{" "}
                      {subject.name}
                    </Text>
                  )}

                  {subject.role && (
                    <Text style={styles.credField}>
                      <Text style={styles.fieldLabel}>Role:</Text>{" "}
                      {subject.role}
                    </Text>
                  )}

                  {subject.company && (
                    <Text style={styles.credField}>
                      <Text style={styles.fieldLabel}>Company:</Text>{" "}
                      {subject.company}
                    </Text>
                  )}

                  <Text style={styles.credIssued}>
                    Issued: {new Date(vc.issuanceDate).toLocaleDateString()}
                  </Text>

                  <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={() => verifyCredential(cred.hash)}
                  >
                    <Text style={styles.verifyButtonText}>Verify ✓</Text>
                  </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
  },
  activeDidBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  activeDidLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  activeDidValue: {
    fontSize: 12,
    color: COLORS.text,
  },
  issueButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  credentialList: {
    flex: 1,
  },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 16,
    marginTop: 40,
  },
  credCard: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  credLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },
  credType: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  typeTag: {
    backgroundColor: COLORS.primary,
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    marginRight: 6,
    marginBottom: 6,
  },
  credField: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 6,
  },
  fieldLabel: {
    fontWeight: "600",
  },
  credIssued: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
  },
  verifyButton: {
    backgroundColor: "#10b981",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
